"use client";

import { Contrast, Eye, SunMedium, SwatchBook } from "lucide-react";
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
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-4 px-2">
      <div className="min-w-0">
        <Crumbs items={crumbs} />
      </div>
      <div className="flex items-center gap-2">
        <Hint label="Show each swatch as the gray with the same luminance, so you can check that steps line up across hues">
          <Toggle
            variant="outline"
            size="sm"
            pressed={overlay.grayscale}
            onPressedChange={(grayscale) => onOverlay({ ...overlay, grayscale })}
            aria-label="Show swatches as grays of equal luminance"
          >
            <SunMedium />
            Luminance
          </Toggle>
        </Hint>
        <Select
          items={VISIONS.map((v) => ({
            value: v.id,
            label: v.id === "normal" ? "Vision" : v.label,
          }))}
          value={overlay.vision}
          onValueChange={(v) =>
            v &&
            onOverlay({ ...overlay, vision: v as VisionId, grayscale: false })
          }
        >
          <SelectTrigger
            size="sm"
            className="w-40"
            aria-label="Simulate color vision"
          >
            <Eye />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VISIONS.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                <span className="flex flex-col">
                  <span>{v.label}</span>
                  {v.note ? (
                    <span className="text-[11px] text-muted-foreground">
                      {v.note}
                    </span>
                  ) : null}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
          <Hint label="Smooth: colors melt into each other">
            <ToggleGroupItem value="smooth" aria-label="Smooth">
              <Contrast />
            </ToggleGroupItem>
          </Hint>
          <Hint label="Cells: every swatch stays crisp">
            <ToggleGroupItem value="cells" aria-label="Cells">
              <SwatchBook />
            </ToggleGroupItem>
          </Hint>
        </ToggleGroup>
      </div>
    </div>
  );
}
