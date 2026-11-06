"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Hint } from "./hint";
import { useKeyShortcut } from "./use-key-shortcut";
import { getCloud } from "@/lib/cloud/client";
import { type PaletteSummary, listPalettes, loadLatest } from "@/lib/cloud/palettes";
import { generatePalette } from "@/lib/palette/generate";

const when = (ms: number) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(ms);

// Swatches already loaded, so reopening the menu shows them at once instead of filling in again.
const swatchCache = new Map<string, string[][]>();

/** A palette as a square of every swatch: one row per color, one column per step. The white and black ends are left out since every palette has them. */
function SwatchSquare({ rows, className }: { rows: string[][] | undefined; className: string }) {
  if (!rows) return <Skeleton aria-hidden className={className} />;
  const cols = Math.max(1, ...rows.map((r) => r.length));
  return (
    <span aria-hidden className={`${className} grid bg-muted`} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${Math.max(1, rows.length)}, 1fr)` }}>
      {rows.flatMap((row, r) => row.map((color, c) => <span key={`${r}-${c}`} style={{ backgroundColor: color }} />))}
    </span>
  );
}

interface Props {
  /** The saved palette being edited, if it has been saved yet. */
  currentId: string | null;
  /** Shown on the button. */
  currentName: string;
  /** Opens another palette. The editor decides whether leaving needs a confirmation. */
  onSwitch: (id: string) => void;
  /** Starts a new palette. */
  onNew: () => void;
}

/** The palette's name as a menu: pick another palette to open it, or start a new one. */
export function PaletteSwitcher({ currentId, currentName, onSwitch, onNew }: Props) {
  const [open, setOpen] = React.useState(false);
  const [palettes, setPalettes] = React.useState<PaletteSummary[] | null>(null);
  /** Every swatch's color by palette id, one row per color. A palette missing here is still loading, or its latest version couldn't be read. */
  const [swatches, setSwatches] = React.useState<Record<string, string[][]>>(() => Object.fromEntries(swatchCache));
  /** The palette under the pointer or keyboard focus, and where its preview goes: just right of the menu, level with the row. */
  const [peek, setPeek] = React.useState<{ id: string; top: number; left: number } | null>(null);
  useKeyShortcut("KeyP", () => setOpen(true));
  const peekId = React.useRef<string | null>(null);
  const peekAt = (id: string) => (e: React.SyntheticEvent<HTMLElement>) => {
    const row = e.currentTarget;
    const menu = row.closest<HTMLElement>("[data-slot=dropdown-menu-content]");
    if (!menu) return;
    peekId.current = id;
    // The menu grows into place as it opens, which skews measurements taken meanwhile, so measure again once it settles.
    // The menu's wrapper isn't scaled, so its edge is where the menu will end up.
    const place = () => {
      if (peekId.current !== id) return;
      setPeek({ id, top: row.getBoundingClientRect().top, left: (menu.parentElement ?? menu).getBoundingClientRect().right + 8 });
    };
    place();
    const running = menu.getAnimations();
    if (running.length) void Promise.all(running.map((a) => a.finished.catch(() => undefined))).then(place);
  };

  React.useEffect(() => {
    if (!open) return;
    const cloud = getCloud();
    if (!cloud) return;
    let canceled = false;
    listPalettes(cloud)
      .then((list) => {
        if (canceled) return;
        setPalettes(list);
        for (const p of list) {
          loadLatest(cloud, p.id)
            .then(({ state }) => {
              const colors = generatePalette(state.space, state.scale, state.hues, state.gamut).map((g) => g.shades.filter((shade) => !shade.anchor).map((shade) => shade.hex));
              swatchCache.set(p.id, colors);
              if (!canceled) setSwatches((prev) => ({ ...prev, [p.id]: colors }));
            })
            .catch(() => {
              // A palette without a readable version just keeps the placeholder.
            });
        }
      })
      .catch(() => {
        if (!canceled) setPalettes([]);
      });
    return () => {
      canceled = true;
    };
  }, [open]);

  const choose = (id: string) => {
    if (id !== currentId) onSwitch(id);
  };

  const label = currentName.trim() || "Untitled palette";

  // A menu rather than a popover, so the arrow keys, Home and End, and typing a name all move through the palettes.
  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          peekId.current = null;
          setPeek(null);
        }
      }}
    >
      <Hint label="Switch palette" shortcut={["P"]}>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              aria-label="Switch palette"
              className="min-w-0 border-0 bg-white pr-1.5 pl-2.5 text-sm text-foreground shadow-(--shadow-default) transition-[color,box-shadow] hover:bg-white hover:shadow-(--shadow-large) aria-expanded:bg-white aria-expanded:shadow-(--shadow-large) dark:bg-input/30 dark:hover:bg-input/30 dark:aria-expanded:bg-input/30"
            />
          }
        >
          <span className="truncate font-medium">{label}</span>
          <ChevronDown className="shrink-0" />
        </DropdownMenuTrigger>
      </Hint>
      <DropdownMenuContent align="start" className="w-72 gap-0 p-1">
        <div className="max-h-80 overflow-y-auto">
          {palettes === null ? (
            <div aria-busy="true" aria-label="Loading your palettes" className="space-y-1 p-1">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-9 rounded-md" />
              ))}
            </div>
          ) : palettes.length === 0 ? (
            <p className="p-3 text-center text-xs text-muted-foreground">No saved palettes yet.</p>
          ) : (
            palettes.map((p) => (
              <DropdownMenuItem key={p.id} label={p.name} onFocus={peekAt(p.id)} onClick={() => choose(p.id)} aria-current={p.id === currentId ? "true" : undefined} className="gap-2 py-1.5 pr-2 pl-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{p.name}</span>
                  <span className="block text-xs font-normal text-muted-foreground">Edited {when(p.updatedAt)}</span>
                </span>
                {p.id === currentId ? <Check aria-hidden className="size-3.5 shrink-0 text-muted-foreground" /> : null}
              </DropdownMenuItem>
            ))
          )}
        </div>
        {palettes?.length ? <DropdownMenuSeparator /> : null}
        <DropdownMenuItem onFocus={() => {
          peekId.current = null;
          setPeek(null);
        }} onClick={onNew} className="gap-2 py-1.5 pl-2 font-medium">
          <Plus aria-hidden className="size-4 text-muted-foreground" />
          New palette
        </DropdownMenuItem>
      </DropdownMenuContent>
      {open && peek
        ? createPortal(
            <div
              aria-hidden
              style={{ top: peek.top, left: peek.left }}
              className="animate-in fade-in slide-in-from-left-1 pointer-events-none fixed z-50 rounded-xl bg-popover p-1 shadow-(--shadow-large) duration-100 motion-reduce:animate-none"
            >
              <SwatchSquare rows={swatches[peek.id]} className="block size-40 overflow-hidden rounded-lg shadow-(--shadow-border)" />
            </div>,
            document.body,
          )
        : null}
    </DropdownMenu>
  );
}
