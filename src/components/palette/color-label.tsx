"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { HuePreset } from "@/lib/palette/defaults";
import { cn } from "@/lib/utils";
import { AddColorPopover } from "./add-color";

export interface ColorActions {
  onRename: (hueId: string, name: string) => void;
  onRemove: (hueId: string) => void;
  /** `index` is where in the list the new color goes. */
  onAddPreset: (preset: HuePreset, index: number) => void;
  onAddHex: (hex: string, index: number) => void;
}

/**
 * A color's name at the start of its row. Clicking it selects the color and opens everything you can
 * do to the color as a whole: rename it or remove it. (Drag the grip beside it to reorder.)
 */
export function ColorName({
  hueId,
  name,
  selected,
  onSelect,
  actions,
}: {
  hueId: string;
  name: string;
  selected: boolean;
  onSelect: () => void;
  actions: Pick<ColorActions, "onRename" | "onRemove">;
}) {
  const [open, setOpen] = React.useState(false);
  const inputId = React.useId();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            onClick={onSelect}
            aria-pressed={selected}
            aria-label={`${name || "Unnamed"} color options`}
            className={cn(
              "flex h-full min-w-0 flex-1 items-center pr-2 text-left text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              selected ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          />
        }
      >
        <span className="truncate">{name || "Unnamed"}</span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60">
        <div className="space-y-1.5">
          <label htmlFor={inputId} className="text-xs font-medium">
            Color name
          </label>
          <Input
            id={inputId}
            value={name}
            maxLength={32}
            onChange={(e) => actions.onRename(hueId, e.target.value)}
            onFocus={(e) => e.target.select()}
            onKeyDown={(e) => {
              if (e.key === "Enter") setOpen(false);
            }}
            className="h-8 md:text-sm"
          />
        </div>
        <div className="border-t border-border pt-2.5">
          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={() => {
              setOpen(false);
              actions.onRemove(hueId);
            }}
          >
            <Trash2 />
            Remove color
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * A "+" on a boundary between rows (or above the first, or below the last), shown while you hover the
 * boundary, that adds a color at exactly that position. The strip is thin so it barely overlaps the
 * name above or below it.
 */
export function AddColorSlot({
  index,
  edge = "top",
  actions,
}: {
  /** Where in the list the new color goes. */
  index: number;
  /** Which edge of its row this strip sits on. */
  edge?: "top" | "bottom";
  actions: Pick<ColorActions, "onAddPreset" | "onAddHex">;
}) {
  const label = edge === "bottom" ? "Add a color at the bottom" : index === 0 ? "Add a color at the top" : "Add a color here";
  return (
    <div
      className={cn("group/addc absolute inset-x-0 z-30 flex h-3 items-center justify-center", edge === "top" ? "top-0 -translate-y-1/2" : "bottom-0 translate-y-1/2")}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <AddColorPopover
        onAddPreset={(p) => actions.onAddPreset(p, index)}
        onAddHex={(hex) => actions.onAddHex(hex, index)}
        align="center"
        render={
          <button
            type="button"
            aria-label={label}
            title="Add a color here"
            className="flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-sm transition-opacity group-hover/addc:opacity-100 hover:scale-110 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-expanded:opacity-100"
          />
        }
      >
        <Plus className="size-3" />
      </AddColorPopover>
    </div>
  );
}

/** A visible add button, for when there is no grid to hover over yet. */
export function AddColorEnd({ index, actions, label = "Add color", variant = "ghost" }: { index: number; actions: Pick<ColorActions, "onAddPreset" | "onAddHex">; label?: string; variant?: "ghost" | "secondary" }) {
  return (
    <AddColorPopover
      onAddPreset={(p) => actions.onAddPreset(p, index)}
      onAddHex={(hex) => actions.onAddHex(hex, index)}
      render={<Button variant={variant} size="sm" className="text-muted-foreground hover:text-foreground" />}
    >
      <Plus />
      {label}
    </AddColorPopover>
  );
}
