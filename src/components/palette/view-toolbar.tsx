"use client";

import * as React from "react";
import { Contrast, Eye, EyeOff, SwatchBook } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { VISIONS, type VisionId } from "@/lib/color/vision";
import type { Overlay } from "@/lib/palette/overlay";
import { Crumbs, type Crumb } from "./crumbs";
import type { SquareMode } from "./palette-square";
import { Hint } from "./hint";
import { isTextEntry } from "./text-entry";

type Lens = "luminance" | Exclude<VisionId, "normal">;

/** What the preview can show: equal-luminance grays first, then each color vision type. */
const LENSES: { id: Lens; label: string; note?: string }[] = [
  {
    id: "luminance",
    label: "Luminance",
    note: "Each swatch as the gray with the same luminance, to check steps line up across hues",
  },
  ...VISIONS.filter((v) => v.id !== "normal").map((v) => ({
    id: v.id as Lens,
    label: v.label,
    note: v.note,
  })),
];

/** Quick ways to look at the square differently: as equal-luminance grays, or as someone with color blindness would. */
export function ViewToolbar({
  overlay,
  onOverlay,
  crumbs,
  mode,
  onMode,
}: {
  overlay: Overlay;
  onOverlay: (o: Overlay) => void;
  crumbs: Crumb[];
  mode: SquareMode;
  onMode: (m: SquareMode) => void;
}) {
  // One switch turns the preview on and off; the dropdown picks the lens. The last lens is remembered while
  // the switch is off.
  const [last, setLast] = React.useState<Lens>("luminance");
  const active = overlay.grayscale || overlay.vision !== "normal";
  const lens: Lens = overlay.grayscale
    ? "luminance"
    : overlay.vision !== "normal"
      ? overlay.vision
      : last;
  const apply = (next: Lens | null) =>
    onOverlay({
      ...overlay,
      grayscale: next === "luminance",
      vision: next && next !== "luminance" ? next : "normal",
    });

  // / turns the preview on and off, [ and ] pick smooth or cells. Typing in a field or having a dialog open takes priority.
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key !== "/" && e.key !== "[" && e.key !== "]") return;
      if (isTextEntry(e.target)) return;
      if (document.querySelector('[data-slot="dialog-content"], [data-slot="select-content"], [role="menu"]')) return;
      e.preventDefault();
      if (e.key === "/") apply(active ? null : lens);
      else onMode(e.key === "[" ? "smooth" : "cells");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-4 px-2">
      <div className="min-w-0">
        <Crumbs items={crumbs} />
      </div>
      <div className="flex items-center gap-2">
        <Select
          items={LENSES.map((l) => ({ value: l.id, label: l.label }))}
          value={lens}
          onValueChange={(v) => {
            if (!v) return;
            setLast(v as Lens);
            apply(v as Lens);
          }}
        >
          <SelectTrigger
            size="sm"
            className="w-40"
            aria-label="Lens for the preview"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false} align="start" className="max-h-72 w-80">

            {LENSES.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                <span className="flex flex-col">
                  <span>{l.label}</span>
                  {l.note ? (
                    <span className="text-[11px] whitespace-normal text-muted-foreground">
                      {l.note}
                    </span>
                  ) : null}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Hint label="Toggle display mode (/)">
          <Toggle
            variant="outline"
            size="sm"
            pressed={active}
            onPressedChange={(on) => apply(on ? lens : null)}
            aria-label="Preview with a lens"
          >
            {active ? <Eye /> : <EyeOff />}
          </Toggle>
        </Hint>
      </div>
      <div className="flex justify-end">
        <ToggleGroup
          value={[mode]}
          onValueChange={(v) => v[0] && onMode(v[0] as SquareMode)}
          variant="outline"
          size="sm"
          spacing={0}
          aria-label="How the square is drawn"
        >
          <Hint label="Smooth: colors melt into each other ([)">
            <ToggleGroupItem value="smooth" aria-label="Smooth">
              <Contrast />
            </ToggleGroupItem>
          </Hint>
          <Hint label="Cells: every swatch stays crisp (])">
            <ToggleGroupItem value="cells" aria-label="Cells">
              <SwatchBook />
            </ToggleGroupItem>
          </Hint>
        </ToggleGroup>
      </div>
    </div>
  );
}
