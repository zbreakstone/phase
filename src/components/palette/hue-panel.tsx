"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { solveForLuminance } from "@/lib/color/solve";
import { contrastFromLuminance, readableOn } from "@/lib/color/contrast";
import { SPACES, type SpaceId } from "@/lib/color/spaces";
import type { GeneratedHue, HueConfig, ScaleConfig } from "@/lib/palette/types";
import { cn } from "@/lib/utils";
import { SliderField } from "./fields";
import { ChromaChart, HueCurveChart } from "./hue-charts";
import { SourceEditor } from "./source-editor";

interface Props {
  generated: GeneratedHue;
  space: SpaceId;
  scale: ScaleConfig;
  selectedGrade: number | null;
  onSelectGrade: (grade: number) => void;
  onChange: (patch: Partial<HueConfig>) => void;
  onRemove: () => void;
}

function hueGuide(space: SpaceId, y: number, chroma: number): React.CSSProperties {
  const def = SPACES[space];
  const stops = Array.from({ length: 25 }, (_, i) => `${solveForLuminance(def, y, i * 15, chroma).hex} ${((i / 24) * 100).toFixed(1)}%`);
  return { background: `linear-gradient(to right, ${stops.join(", ")})` };
}

export function HuePanel({ generated, space, scale, selectedGrade, onSelectGrade, onChange, onRemove }: Props) {
  const hue = generated.hue;
  const def = SPACES[space];
  const ramp = generated.shades.filter((s) => !s.anchor);
  const first = ramp[0];
  const last = ramp[ramp.length - 1];
  const lockedLight = generated.source?.grade === first?.grade;
  const lockedDark = generated.source?.grade === last?.grade && ramp.length > 1;
  const chosen = generated.shades.find((s) => s.grade === selectedGrade) ?? null;

  const lightGuide = React.useMemo(
    () => hueGuide(space, Math.min(first?.targetLuminance ?? 0.8, 0.8), Math.max(hue.chromaLight, def.chroma.max * 0.15)),
    [space, first?.targetLuminance, hue.chromaLight, def.chroma.max],
  );
  const darkGuide = React.useMemo(
    () => hueGuide(space, Math.max(last?.targetLuminance ?? 0.02, 0.06), Math.max(hue.chromaDark, def.chroma.max * 0.15)),
    [space, last?.targetLuminance, hue.chromaDark, def.chroma.max],
  );

  const setChroma = (value: number) => {
    const factor = hue.chromaMid > 1e-9 ? value / hue.chromaMid : 0;
    if (hue.chromaMid > 1e-9) {
      onChange({ chromaLight: hue.chromaLight * factor, chromaMid: value, chromaDark: hue.chromaDark * factor });
    } else {
      onChange({ chromaLight: value * 0.35, chromaMid: value, chromaDark: value * 0.75 });
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Input
          aria-label="Hue name"
          value={hue.name}
          maxLength={32}
          onChange={(e) => onChange({ name: e.target.value })}
          className="h-9 border-transparent bg-transparent px-1 text-lg font-semibold hover:border-input focus-visible:border-ring"
        />
        <Button variant="ghost" size="icon" aria-label={`Remove ${hue.name}`} onClick={onRemove} className="text-muted-foreground hover:text-destructive">
          <Trash2 />
        </Button>
      </div>

      <div className="space-y-1.5">
        <div className="flex">
          {generated.shades.map((s) => (
            <button
              key={s.grade}
              type="button"
              aria-label={`${hue.name} ${s.grade} ${s.hex}`}
              onClick={() => onSelectGrade(s.grade)}
              className={cn("relative h-10 flex-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset")}
              style={{ backgroundColor: s.hex, color: readableOn(s.hex) }}
            >
              {s.grade === selectedGrade ? <span aria-hidden className="absolute inset-0 border-2 border-white mix-blend-difference" /> : null}
            </button>
          ))}
        </div>
        <p className="h-4 font-mono text-[11px] text-muted-foreground">
          {chosen
            ? `${chosen.grade} · ${chosen.hex} · ${contrastFromLuminance(1, chosen.luminance).toFixed(2)}:1 on white · OKLCH ${chosen.oklch.L.toFixed(2)} ${chosen.oklch.C.toFixed(2)} ${Math.round(chosen.oklch.h)}°`
            : "Click a swatch for its details"}
        </p>
      </div>

      <SourceEditor source={hue.source} analysis={generated.source} onChange={(source) => onChange({ source })} />

      <section className="space-y-3 border-t border-border pt-4">
        <div>
          <h3 className="text-xs font-semibold tracking-wide uppercase">Hue</h3>
          <p className="text-[11px] text-muted-foreground">
            Tints start at the lightest hue and end at the darkest one, so yellows can turn orange instead of muddy olive.
          </p>
        </div>
        <HueCurveChart generated={generated} scale={scale} space={space} />
        <SliderField
          id="hue-light"
          label="Lightest shade"
          disabled={lockedLight}
          value={hue.hueLight}
          min={0}
          max={360}
          step={1}
          unit="°"
          onChange={(v) => onChange({ hueLight: v })}
          trackStyle={lightGuide}
        />
        <SliderField
          id="hue-dark"
          label="Darkest shade"
          disabled={lockedDark}
          value={hue.hueDark}
          min={0}
          max={360}
          step={1}
          unit="°"
          onChange={(v) => onChange({ hueDark: v })}
          trackStyle={darkGuide}
        />
        {lockedLight || lockedDark ? (
          <p className="text-[11px] text-muted-foreground">The base colour sets this end. Remove it or let it land on another step to edit.</p>
        ) : null}
      </section>

      <section className="space-y-3 border-t border-border pt-4">
        <div>
          <h3 className="text-xs font-semibold tracking-wide uppercase">Chroma</h3>
          <p className="text-[11px] text-muted-foreground">
            How colourful the scale is. Hatched areas can&apos;t be shown on screen; colours there are toned down automatically.
          </p>
        </div>
        <ChromaChart generated={generated} scale={scale} space={space} />
        <SliderField
          id="chroma"
          label="Colourfulness"
          disabled={lockedLight && lockedDark}
          value={hue.chromaMid}
          min={0}
          max={def.chroma.max}
          step={def.chroma.step}
          decimals={def.chroma.decimals}
          onChange={setChroma}
        />
      </section>
    </div>
  );
}
