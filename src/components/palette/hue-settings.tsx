"use client";

import * as React from "react";
import { Copy, Lock, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { solveForLuminance } from "@/lib/color/solve";
import { SPACES, type SpaceId } from "@/lib/color/spaces";
import type { GeneratedHue, HueConfig, HueDirection, ScaleConfig } from "@/lib/palette/types";
import { SliderField } from "./fields";
import { SourceEditor } from "./source-editor";

interface Props {
  generated: GeneratedHue;
  space: SpaceId;
  scale: ScaleConfig;
  onChange: (patch: Partial<HueConfig>) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}

function hueGradient(space: SpaceId, y: number, chroma: number): React.CSSProperties {
  const def = SPACES[space];
  const stops = Array.from({ length: 25 }, (_, i) => {
    const h = i * 15;
    return `${solveForLuminance(def, y, h, chroma).hex} ${((i / 24) * 100).toFixed(1)}%`;
  });
  return { background: `linear-gradient(to right, ${stops.join(", ")})` };
}

export function HueSettings({ generated, space, scale, onChange, onDuplicate, onRemove }: Props) {
  const hue = generated.hue;
  const def = SPACES[space];
  const ramp = generated.shades.filter((s) => !s.anchor);
  const first = ramp[0];
  const last = ramp[ramp.length - 1];
  const lockedLight = generated.source?.grade === first?.grade;
  const lockedDark = generated.source?.grade === last?.grade && ramp.length > 1;

  const lightGuide = React.useMemo(
    () => hueGradient(space, Math.min(first?.targetLuminance ?? 0.8, 0.8), Math.max(hue.chromaLight, def.chroma.max * 0.15)),
    [space, first?.targetLuminance, hue.chromaLight, def.chroma.max],
  );
  const darkGuide = React.useMemo(
    () => hueGradient(space, Math.max(last?.targetLuminance ?? 0.02, 0.06), Math.max(hue.chromaDark, def.chroma.max * 0.15)),
    [space, last?.targetLuminance, hue.chromaDark, def.chroma.max],
  );

  return (
    <div className="space-y-5">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor="hue-name" className="text-xs">
            Hue name
          </Label>
          <Input id="hue-name" value={hue.name} maxLength={32} onChange={(e) => onChange({ name: e.target.value })} className="h-8" />
        </div>
        <Button variant="outline" size="icon" aria-label="Duplicate hue" onClick={onDuplicate}>
          <Copy />
        </Button>
        <Button variant="outline" size="icon" aria-label="Remove hue" onClick={onRemove} className="text-destructive hover:text-destructive">
          <Trash2 />
        </Button>
      </div>

      <Group title="Source colour" hint="Optional. Build this hue around a specific colour.">
        <SourceEditor
          space={space}
          scale={scale}
          source={hue.source}
          analysis={generated.source}
          onChange={(source) => onChange({ source })}
        />
      </Group>

      <Group title={`Lightest end${first ? ` · step ${first.grade}` : ""}`} hint="Where the scale starts on the colour wheel.">
        {lockedLight ? <Locked /> : null}
        <SliderField id="hue-light" label="Hue" disabled={lockedLight} value={hue.hueLight} min={0} max={360} step={1} unit="°" onChange={(v) => onChange({ hueLight: v })} trackStyle={lightGuide} />
        <SliderField id="chroma-light" label={def.chroma.label} disabled={lockedLight} value={hue.chromaLight} min={0} max={def.chroma.max} step={def.chroma.step} decimals={def.chroma.decimals} onChange={(v) => onChange({ chromaLight: v })} />
      </Group>

      <Group title={`Darkest end${last ? ` · step ${last.grade}` : ""}`} hint="Where the scale finishes. Shift dark yellows toward orange and dark blues toward violet so they don't go muddy.">
        {lockedDark ? <Locked /> : null}
        <SliderField id="hue-dark" label="Hue" disabled={lockedDark} value={hue.hueDark} min={0} max={360} step={1} unit="°" onChange={(v) => onChange({ hueDark: v })} trackStyle={darkGuide} />
        <SliderField id="chroma-dark" label={def.chroma.label} disabled={lockedDark} value={hue.chromaDark} min={0} max={def.chroma.max} step={def.chroma.step} decimals={def.chroma.decimals} onChange={(v) => onChange({ chromaDark: v })} />
      </Group>

      <Group title="Between the ends" hint="Shades in between blend the two hues along this path.">
        <SliderField id="chroma-mid" label={`Peak ${def.chroma.label.toLowerCase()}`} value={hue.chromaMid} min={0} max={def.chroma.max} step={def.chroma.step} decimals={def.chroma.decimals} onChange={(v) => onChange({ chromaMid: v })} hint="Chroma at the middle of the scale." />
        <SliderField id="hue-bias" label="When the shift happens" value={hue.hueBias} min={-1} max={1} step={0.05} decimals={2} onChange={(v) => onChange({ hueBias: v })} startLabel="Early (light)" endLabel="Late (dark)" hint="Slide right to hold the lightest hue longer and change near the dark end." />
        <div className="space-y-1.5">
          <Label className="text-xs">Direction around the wheel</Label>
          <ToggleGroup
            value={[hue.hueDirection]}
            onValueChange={(v) => v[0] && onChange({ hueDirection: v[0] as HueDirection })}
            variant="outline"
            size="sm"
            spacing={0}
            aria-label="Hue direction"
            className="w-full"
          >
            <ToggleGroupItem value="shortest" className="flex-1 rounded-none">Shortest</ToggleGroupItem>
            <ToggleGroupItem value="increasing" className="flex-1 rounded-none">Increasing</ToggleGroupItem>
            <ToggleGroupItem value="decreasing" className="flex-1 rounded-none">Decreasing</ToggleGroupItem>
          </ToggleGroup>
          {def.interpolation === "rect" ? (
            <p className="text-[11px] text-muted-foreground">{def.label} blends on a straight a/b line, so direction doesn&apos;t apply.</p>
          ) : null}
        </div>
      </Group>
    </div>
  );
}

function Locked() {
  return (
    <Badge variant="outline" className="gap-1 rounded-none text-[11px] font-normal">
      <Lock className="size-3" />
      Set by the source colour. Remove it or pick another step to edit.
    </Badge>
  );
}

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3 border-t border-border pt-3">
      <legend className="sr-only">{title}</legend>
      <div>
        <h4 className="text-xs font-semibold tracking-wide text-foreground uppercase">{title}</h4>
        {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </fieldset>
  );
}
