"use client";

import { Eye, SunMedium } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { VISIONS, type VisionId } from "@/lib/color/vision";
import type { Overlay } from "@/lib/palette/overlay";

/** Quick ways to look at the square differently: as equal-luminance grays, or as someone with color blindness would. */
export function ViewToolbar({ overlay, onOverlay }: { overlay: Overlay; onOverlay: (o: Overlay) => void }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
      <div className="flex items-center gap-2">
        <Toggle
          variant="outline"
          size="sm"
         
          pressed={overlay.grayscale}
          onPressedChange={(grayscale) => onOverlay({ ...overlay, grayscale })}
          aria-label="Show swatches as grays of equal luminance"
          title="Show each swatch as the gray with the same luminance, so you can check that steps line up across hues"
        >
          <SunMedium />
          Luminance
        </Toggle>
        <Select
          items={VISIONS.map((v) => ({ value: v.id, label: v.id === "normal" ? "Vision" : v.label }))}
          value={overlay.vision}
          onValueChange={(v) => v && onOverlay({ ...overlay, vision: v as VisionId, grayscale: false })}
        >
          <SelectTrigger size="sm" className="w-40" aria-label="Simulate color vision">
            <Eye />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VISIONS.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                <span className="flex flex-col">
                  <span>{v.label}</span>
                  {v.note ? <span className="text-[11px] text-muted-foreground">{v.note}</span> : null}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
