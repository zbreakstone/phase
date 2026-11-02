"use client";

import type { ScaleConfig } from "@/lib/palette/types";
import { TargetCurve } from "./scale-settings";

interface Props {
  scale: ScaleConfig;
  onChange: (scale: ScaleConfig) => void;
}

/**
 * The luminance targets, shown under the palette so dragging one can be watched live in the swatches
 * and the contrast report above. Controls for one step (add, rename, delete)
 * live on the steps themselves.
 */
export function ScalePanel({ scale, onChange }: Props) {
  return (
    <section aria-labelledby="scale-heading" className="space-y-3 border-t border-border pt-6 pb-8">
      <div className="space-y-1">
        <h2 id="scale-heading" className="text-sm font-semibold">
          Luminance targets
        </h2>
        <p className="text-xs text-muted-foreground">
          How bright each step is. The contrast rules that bound them are under Settings. To add, rename or delete a step, use the step numbers above the swatches.
        </p>
      </div>
      <TargetCurve scale={scale} referenceY={1} onChange={onChange} />
    </section>
  );
}
