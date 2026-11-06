"use client";

import * as React from "react";
import { useRovingFocus } from "./use-roving-focus";
import { GripVertical, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { displayShade, representativeShade, type Overlay } from "@/lib/palette/overlay";
import type { Gamut } from "@/lib/color/gamut";
import type { GeneratedHue } from "@/lib/palette/types";
import { cn } from "@/lib/utils";
import { AddColorPopover } from "./add-color";
import { CollapsibleSection } from "./panel-section";
import type { ColorActions } from "./color-label";

interface Props {
  generated: GeneratedHue[];
  overlay: Overlay;
  gamut: Gamut;
  actions: Pick<ColorActions, "onAddPreset" | "onAddHex">;
  onOpen: (hueId: string) => void;
  onReorder: (hueId: string, toIndex: number) => void;
}

/** Every color as a row: open it, drag it to reorder, or add another. Mirrors the rows in the square. */
export function ColorsList({
  generated,
  overlay,
  gamut,
  actions,
  onOpen,
  onReorder,
}: Props) {
  const listRef = React.useRef<HTMLUListElement>(null);
  useRovingFocus(listRef, { orientation: "vertical" });
  const [dragId, setDragId] = React.useState<string | null>(null);
  /** The slot (0…n) a drop would land in. */
  const [slot, setSlot] = React.useState<number | null>(null);

  const finish = () => {
    setDragId(null);
    setSlot(null);
  };

  return (
    <CollapsibleSection
      id="colors"
      title="Colors"
    >
      <ul
        ref={listRef}
        onDragOver={(e) => {
          if (dragId) e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (dragId && slot !== null) {
            const from = generated.findIndex((g) => g.hue.id === dragId);
            const to = slot > from ? slot - 1 : slot;
            if (from >= 0 && to !== from) onReorder(dragId, to);
          }
          finish();
        }}
      >
        {generated.map((g, i) => {
          const mid = representativeShade(g);
          return (
            <li
              key={g.hue.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                setDragId(g.hue.id);
              }}
              onDragEnd={finish}
              onDragOver={(e) => {
                if (!dragId) return;
                const rect = e.currentTarget.getBoundingClientRect();
                setSlot(e.clientY < rect.top + rect.height / 2 ? i : i + 1);
              }}
              className={cn(
                "group/row relative",
                dragId === g.hue.id && "opacity-40",
              )}
            >
              {slot === i && dragId ? (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 -top-px z-10 h-0.5 bg-primary"
                />
              ) : null}
              {slot === generated.length &&
              i === generated.length - 1 &&
              dragId ? (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 -bottom-px z-10 h-0.5 bg-primary"
                />
              ) : null}
              {/* Sits in the card's left gutter so names stay aligned with the headings, like Notion's block handle. */}
              <GripVertical
                aria-hidden
                className="pointer-events-none absolute top-1/2 -left-4.5 z-10 size-3.5 -translate-y-1/2 cursor-grab text-muted-foreground/0 group-hover/row:text-muted-foreground"
              />
              <button
                type="button"
                onClick={() => onOpen(g.hue.id)}
                onKeyDown={(e) => {
                  if (!e.altKey) return;
                  const to =
                    e.key === "ArrowUp"
                      ? i - 1
                      : e.key === "ArrowDown"
                        ? i + 1
                        : null;
                  if (to === null || to < 0 || to >= generated.length) return;
                  e.preventDefault();
                  onReorder(g.hue.id, to);
                }}
                title="Open (Alt + ↑ / ↓ to reorder)"
                className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span
                  aria-hidden
                  className="size-6 shrink-0 rounded-md ring-1 ring-foreground/15"
                  style={{ backgroundColor: displayShade(mid, overlay, gamut) }}
                />
                <span className="truncate">{g.hue.name || "Unnamed"}</span>
              </button>
            </li>
          );
        })}
      </ul>
        <AddColorPopover
          align="start"
          onAddPreset={(p) => actions.onAddPreset(p, generated.length)}
          onAddHex={(hex) => actions.onAddHex(hex, generated.length)}
          render={
            <Button variant="ghost" size="sm" className="-ml-2 mt-1" />
          }
        >
          <Plus />
          Add color
        </AddColorPopover>
    </CollapsibleSection>
  );
}
