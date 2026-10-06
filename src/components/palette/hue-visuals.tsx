"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import type { SpaceId } from "@/lib/color/spaces";
import { generateHue, withFixedHue } from "@/lib/palette/generate";
import type { GeneratedHue, ScaleConfig, Shade } from "@/lib/palette/types";
import { cn } from "@/lib/utils";
import { ChromaChart, HueCurveChart } from "./hue-charts";

interface Props {
  generated: GeneratedHue;
  space: SpaceId;
  scale: ScaleConfig;
}

export function HueVisuals({ generated, space, scale }: Props) {
  const hue = generated.hue;
  const ramp = generated.shades.filter((s) => !s.anchor);
  const clipped = ramp.filter((s) => s.clipped).length;
  const fixed = React.useMemo(
    () => generateHue(space, scale, withFixedHue(hue)).shades.filter((s) => !s.anchor),
    [space, scale, hue],
  );
  const hasShift = Math.abs(hue.hueLight - hue.hueDark) > 0.5 || hue.hueBias !== 0 || !!generated.source;

  return (
    <div className="grid gap-px border border-border bg-border xl:grid-cols-[1fr_1fr_minmax(16rem,0.7fr)]">
      <Panel
        title="Hue curve"
        note="Hue angle at every step. Large dots are the two ends you set; the diamond is your source colour."
      >
        <HueCurveChart generated={generated} scale={scale} space={space} />
      </Panel>
      <Panel
        title="Chroma and gamut"
        note="The line is the chroma requested. Hatched space can't be shown in sRGB at that luminance, so chroma is reduced there at constant lightness and hue."
        footer={
          clipped > 0 ? (
            <Badge variant="outline" className="rounded-none border-red-500/50 text-red-300">
              {clipped} clipped step{clipped === 1 ? "" : "s"}
            </Badge>
          ) : (
            <Badge variant="outline" className="rounded-none">
              Every step fits inside sRGB
            </Badge>
          )
        }
      >
        <ChromaChart generated={generated} scale={scale} space={space} />
      </Panel>
      <Panel title="With and without the hue shift" note="Same luminance targets and chroma. The second strip holds the lightest hue all the way down.">
        <div className="space-y-3">
          <Strip label={hasShift ? "Your scale" : "Your scale (no shift set)"} shades={ramp} />
          <Strip label="One hue throughout" shades={fixed} muted />
        </div>
      </Panel>
    </div>
  );
}

function Panel({ title, note, footer, children }: { title: string; note: string; footer?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-2 bg-card p-3">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-[11px] text-muted-foreground">{note}</p>
      </div>
      {children}
      {footer}
    </section>
  );
}

function Strip({ label, shades, muted }: { label: string; shades: Shade[]; muted?: boolean }) {
  return (
    <div className="space-y-1">
      <p className={cn("text-xs font-medium", muted && "text-muted-foreground")}>{label}</p>
      <div className="flex">
        {shades.map((s) => (
          <div key={s.grade} className="h-12 flex-1" style={{ backgroundColor: s.hex }} title={`${s.grade} ${s.hex}`} />
        ))}
      </div>
    </div>
  );
}
