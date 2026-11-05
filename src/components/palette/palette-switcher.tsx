"use client";

import * as React from "react";
import { Check, ChevronDown, EllipsisVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { getCloud } from "@/lib/cloud/client";
import { type PaletteSummary, listPalettes } from "@/lib/cloud/palettes";
import { RenamePaletteDialog } from "./rename-palette-dialog";
import { usePaletteActions } from "./use-palette-actions";

const when = (ms: number) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(ms);

interface Props {
  /** The saved palette being edited, if it has been saved yet. */
  currentId: string | null;
  /** Shown on the button. */
  currentName: string;
  /** Opens another palette. The editor decides whether leaving needs a confirmation. */
  onSwitch: (id: string) => void;
  /** A palette was renamed from here, so the editor can keep its own copy of the name in step. */
  onRenamed: (id: string, name: string) => void;
  /** A palette was deleted from here. */
  onDeleted: (id: string) => void;
}

/** The palette's name as a menu: pick another palette to open it, or act on any of them. */
export function PaletteSwitcher({ currentId, currentName, onSwitch, onRenamed, onDeleted }: Props) {
  const [open, setOpen] = React.useState(false);
  const [palettes, setPalettes] = React.useState<PaletteSummary[] | null>(null);
  /** Bumped to load the list again after a duplicate, rename or delete. */
  const [reload, setReload] = React.useState(0);
  const [renaming, setRenaming] = React.useState<PaletteSummary | null>(null);
  const actions = usePaletteActions(() => setReload((n) => n + 1));

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
  }, [open, reload]);

  const choose = (id: string) => {
    setOpen(false);
    if (id !== currentId) onSwitch(id);
  };

  const label = currentName.trim() || "Untitled palette";

  const rows = (
    <ul className="max-h-80 overflow-y-auto">
      {palettes?.map((p) => (
        <li key={p.id} className="group/row relative">
          <button
            type="button"
            onClick={() => choose(p.id)}
            aria-current={p.id === currentId ? "true" : undefined}
            className="flex w-full items-center gap-2 rounded-md py-1.5 pr-10 pl-2 text-left hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{p.name}</span>
              <span className="block text-xs text-muted-foreground">Edited {when(p.updatedAt)}</span>
            </span>
            {p.id === currentId ? <Check aria-hidden className="size-3.5 shrink-0 text-muted-foreground" /> : null}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Actions for ${p.name}`}
                  className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground aria-expanded:bg-muted"
                />
              }
            >
              <EllipsisVertical />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => choose(p.id)}>Open</DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setOpen(false);
                  setRenaming(p);
                }}
              >
                Edit info
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void actions.copyLink(p)}>Copy link</DropdownMenuItem>
              <DropdownMenuItem onClick={() => void actions.duplicate(p)}>Duplicate</DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={async () => {
                  if (await actions.remove(p)) onDeleted(p.id);
                }}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
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
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 gap-0 p-1">
          {palettes === null ? (
            <div aria-busy="true" aria-label="Loading your palettes" className="space-y-1 p-1">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-9 rounded-md" />
              ))}
            </div>
          ) : palettes.length === 0 ? (
            <p className="p-3 text-center text-xs text-muted-foreground">No saved palettes yet.</p>
          ) : (
            rows
          )}
        </PopoverContent>
      </Popover>
      <RenamePaletteDialog
        name={renaming?.name ?? null}
        onClose={() => setRenaming(null)}
        onSubmit={async (name) => {
          if (!renaming) return;
          if (await actions.rename(renaming, name)) {
            onRenamed(renaming.id, name);
            setRenaming(null);
          }
        }}
      />
    </>
  );
}
