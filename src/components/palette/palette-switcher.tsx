"use client";

import * as React from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { KbdGroup } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { Hint } from "./hint";
import { useKeyShortcut } from "./use-key-shortcut";
import { getCloud } from "@/lib/cloud/client";
import { type PaletteSummary, listPalettes } from "@/lib/cloud/palettes";

const when = (ms: number) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(ms);

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
  useKeyShortcut("KeyP", () => setOpen(true));

  React.useEffect(() => {
    if (!open) return;
    const cloud = getCloud();
    if (!cloud) return;
    let canceled = false;
    listPalettes(cloud)
      .then((list) => {
        if (!canceled) setPalettes(list);
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
    <DropdownMenu open={open} onOpenChange={setOpen}>
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
              <DropdownMenuItem key={p.id} label={p.name} onClick={() => choose(p.id)} aria-current={p.id === currentId ? "true" : undefined} className="gap-2 py-1.5 pr-2 pl-2">
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
        <DropdownMenuItem onClick={onNew} className="gap-2 py-1.5 pl-2 font-medium">
          <Plus aria-hidden className="size-4 text-muted-foreground" />
          New palette
          <KbdGroup keys={["⌘", "N"]} size="sm" className="ml-auto" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
