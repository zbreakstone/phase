"use client";

import type { ScaleConfig } from "@/lib/palette/types";
import { RulesSettings, TargetCurve } from "./scale-settings";

interface Props {
  scale: ScaleConfig;
  onChange: (scale: ScaleConfig) => void;
}

/**
 * The scale-wide settings, shown under the palette so changing a rule or a luminance target can be
 * watched live in the swatches and the contrast report above. Controls for one step (add, rename, delete)
 * live on the steps themselves.
 */
export function ScalePanel({ scale, onChange }: Props) {
  return (
    <section aria-labelledby="scale-heading" className="space-y-5 border-t border-border pt-6 pb-8">
      <div className="space-y-1">
        <h2 id="scale-heading" className="text-sm font-semibold">
          Scale and contrast rules
        </h2>
        <p className="text-xs text-muted-foreground">
          The defaults suit most projects. Change these only if you need stricter contrast. To add, rename or delete a step, use the step numbers above the swatches.
        </p>
      </div>
      <div className="grid gap-x-10 gap-y-8 xl:grid-cols-2">
        <Block title="Contrast rules">
          <RulesSettings scale={scale} onChange={onChange} />
        </Block>
        <Block title="Luminance targets">
          <TargetCurve scale={scale} referenceY={1} onChange={onChange} />
        </Block>
      </div>
    </section>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold tracking-wide uppercase">{title}</h3>
      {children}
    </section>
  );
}
