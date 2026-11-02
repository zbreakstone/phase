"use client";

import type { Gamut } from "@/lib/color/gamut";
import type { SpaceId } from "@/lib/color/spaces";
import type { GeneratedHue, ScaleConfig } from "@/lib/palette/types";
import { ChromaChart, HueCurveChart } from "./hue-charts";

interface Props {
  generated: GeneratedHue;
  scale: ScaleConfig;
  space: SpaceId;
  gamut: Gamut;
}

/** How one color's hue and chroma move from the lightest step to the darkest, under the square so you can watch them while you tune. */
export function CurvesPanel({ generated, scale, space, gamut }: Props) {
  const toned = generated.shades.filter((s) => !s.anchor && s.clipped).map((s) => s.grade);
  return (
    <section aria-labelledby="curves-heading" className="space-y-3 border-t border-border pt-6">
      <h2 id="curves-heading" className="text-sm font-semibold">
        Curves for {generated.hue.name || "Unnamed"}
      </h2>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-1.5">
          <h3 className="text-xs font-semibold tracking-wide uppercase">Hue</h3>
          <HueCurveChart generated={generated} scale={scale} space={space} gamut={gamut} />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-xs font-semibold tracking-wide uppercase">Chroma</h3>
          <ChromaChart generated={generated} scale={scale} space={space} gamut={gamut} />
          <p className="text-[11px] text-muted-foreground">Hatched areas can&apos;t be shown on screen; colors there are toned down automatically.</p>
        </div>
      </div>
      {toned.length > 0 ? (
        <p className="text-[11px] text-muted-foreground">
          {toned.length === 1 ? "Step" : "Steps"} {toned.join(", ")} {toned.length === 1 ? "is" : "are"} a little less colorful than asked, because screens can&apos;t show that much color at{" "}
          {toned.length === 1 ? "that" : "those"} lightness{toned.length === 1 ? "" : "es"}. Hue and contrast are unchanged.
        </p>
      ) : null}
    </section>
  );
}
