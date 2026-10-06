"use client";

import * as React from "react";
import { Copy, Plus, Sparkles, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { solveForLuminance } from "@/lib/color/solve";
import { SPACES, type SpaceId } from "@/lib/color/spaces";
import { HUE_PRESETS, type HuePreset } from "@/lib/palette/defaults";
import { generateHue, withFixedHue } from "@/lib/palette/generate";
import type { GeneratedHue, HueConfig, HueDirection, ScaleConfig, Shade } from "@/lib/palette/types";
import { cn } from "@/lib/utils";
import { SliderField } from "./fields";
import { ChromaChart, HueCurveChart } from "./hue-charts";

interface Props {
  generated: GeneratedHue[];
  selected: GeneratedHue | null;
  space: SpaceId;
  scale: ScaleConfig;
  onSelect: (id: string) => void;
  onChange: (id: string, patch: Partial<HueConfig>) => void;
  onAdd: (preset: HuePreset) => void;
  onAddBlank: () => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
}

export function HueEditor({ generated, selected, space, scale, onSelect, onChange, onAdd, onAddBlank, onDuplicate, onRemove }: Props) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {generated.map((g) => {
          const mid = g.shades.filter((s) => !s.anchor)[Math.floor(g.shades.filter((s) => !s.anchor).length / 2)];
          const active = g.hue.id === selected?.hue.id;
          return (
            <Button
              key={g.hue.id}
              variant={active ? "default" : "outline"}
              size="sm"
              onClick={() => onSelect(g.hue.id)}
              aria-pressed={active}
            >
              <span className="size-3 rounded-full ring-1 ring-black/20" style={{ backgroundColor: mid?.hex }} />
              {g.hue.name}
            </Button>
          );
        })}
        <AddHueMenu onAdd={onAdd} onAddBlank={onAddBlank} />
      </div>

      {selected ? (
        <HueControls
          key={selected.hue.id}
          generated={selected}
          space={space}
          scale={scale}
          onChange={(patch) => onChange(selected.hue.id, patch)}
          onDuplicate={() => onDuplicate(selected.hue.id)}
          onRemove={() => onRemove(selected.hue.id)}
        />
      ) : null}
    </div>
  );
}

export function AddHueMenu({ onAdd, onAddBlank, size = "sm" }: { onAdd: (p: HuePreset) => void; onAddBlank: () => void; size?: "sm" | "default" }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="secondary" size={size} />}>
        <Plus />
        Add hue
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Start from a preset</DropdownMenuLabel>
          {HUE_PRESETS.map((p) => (
            <DropdownMenuItem key={p.key} onClick={() => onAdd(p)}>
              <span className="size-3 rounded-full ring-1 ring-black/20" style={{ backgroundColor: p.swatch }} />
              {p.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onAddBlank}>
          <Sparkles />
          Blank hue
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function hueGradient(space: SpaceId, y: number, chroma: number): React.CSSProperties {
  const def = SPACES[space];
  const stops = Array.from({ length: 25 }, (_, i) => {
    const h = i * 15;
    return `${solveForLuminance(def, y, h, chroma).hex} ${((i / 24) * 100).toFixed(1)}%`;
  });
  return { background: `linear-gradient(to right, ${stops.join(", ")})` };
}

function HueControls({
  generated,
  space,
  scale,
  onChange,
  onDuplicate,
  onRemove,
}: {
  generated: GeneratedHue;
  space: SpaceId;
  scale: ScaleConfig;
  onChange: (patch: Partial<HueConfig>) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const hue = generated.hue;
  const def = SPACES[space];
  const ramp = generated.shades.filter((s) => !s.anchor);
  const first = ramp[0];
  const last = ramp[ramp.length - 1];
  const fixed = React.useMemo(() => generateHue(space, scale, withFixedHue(hue)).shades.filter((s) => !s.anchor), [space, scale, hue]);
  const hasShift = Math.abs(hue.hueLight - hue.hueDark) > 0.5 || hue.hueBias !== 0;

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
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="hue-name" className="text-sm">
            Hue name
          </Label>
          <Input id="hue-name" value={hue.name} maxLength={32} onChange={(e) => onChange({ name: e.target.value })} className="w-48" />
        </div>
        <Button variant="outline" size="sm" onClick={onDuplicate}>
          <Copy />
          Duplicate
        </Button>
        <Button variant="outline" size="sm" onClick={onRemove} className="text-destructive hover:text-destructive">
          <Trash2 />
          Remove
        </Button>
        {!hue.name.trim() ? <p className="text-sm text-destructive">Give this hue a name so exports are readable.</p> : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <EndpointCard
          title="Lightest end"
          grade={first?.grade}
          shade={first}
          explain="Where your scale starts. Pale tints of most hues drift in their own direction, so choose the hue that looks right in light backgrounds."
        >
          <SliderField id="hue-light" label="Hue" hint="Angle on the colour wheel for the lightest shade." value={hue.hueLight} min={0} max={360} step={1} unit="°" onChange={(v) => onChange({ hueLight: v })} trackStyle={lightGuide} />
          <SliderField id="chroma-light" label={def.chroma.label} hint="How colourful the lightest shade is. Light tints usually want low chroma." value={hue.chromaLight} min={0} max={def.chroma.max} step={def.chroma.step} decimals={def.chroma.decimals} onChange={(v) => onChange({ chromaLight: v })} />
        </EndpointCard>
        <EndpointCard
          title="Darkest end"
          grade={last?.grade}
          shade={last}
          explain="Where your scale finishes. Shifting dark yellow toward orange, or dark blue toward violet, keeps them from turning muddy or grey."
        >
          <SliderField id="hue-dark" label="Hue" hint="Angle on the colour wheel for the darkest shade." value={hue.hueDark} min={0} max={360} step={1} unit="°" onChange={(v) => onChange({ hueDark: v })} trackStyle={darkGuide} />
          <SliderField id="chroma-dark" label={def.chroma.label} hint="How colourful the darkest shade is. Dark colours can't hold as much chroma, so extra is clipped." value={hue.chromaDark} min={0} max={def.chroma.max} step={def.chroma.step} decimals={def.chroma.decimals} onChange={(v) => onChange({ chromaDark: v })} />
        </EndpointCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Between the ends</CardTitle>
            <CardDescription>Every shade in between blends the two hues along this path. Chroma passes through a peak in the middle.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <SliderField id="chroma-mid" label={`Peak ${def.chroma.label.toLowerCase()}`} hint="Chroma at the middle of the scale. Mid-tones can usually carry the most colour." value={hue.chromaMid} min={0} max={def.chroma.max} step={def.chroma.step} decimals={def.chroma.decimals} onChange={(v) => onChange({ chromaMid: v })} />
            <SliderField id="hue-bias" label="When the hue shift happens" hint="Slide left to change hue quickly near the light end, right to hold the light hue longer and change near the dark end." value={hue.hueBias} min={-1} max={1} step={0.05} decimals={2} onChange={(v) => onChange({ hueBias: v })} startLabel="Early (light shades)" endLabel="Late (dark shades)" />
            <div className="space-y-1.5">
              <Label className="text-sm">Direction around the wheel</Label>
              <ToggleGroup
                value={[hue.hueDirection]}
                onValueChange={(v) => v[0] && onChange({ hueDirection: v[0] as HueDirection })}
                variant="outline"
                size="sm"
                spacing={0}
                aria-label="Hue direction"
              >
                <ToggleGroupItem value="shortest">Shortest</ToggleGroupItem>
                <ToggleGroupItem value="increasing">Increasing °</ToggleGroupItem>
                <ToggleGroupItem value="decreasing">Decreasing °</ToggleGroupItem>
              </ToggleGroup>
              {def.interpolation === "rect" ? (
                <p className="text-xs text-muted-foreground">
                  {def.label} blends on a straight a/b line, so direction doesn&apos;t apply. Switch to a polar space to control it.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Compare with no hue shift</CardTitle>
            <CardDescription>Same chroma and the same luminance targets, but the lightest hue is held all the way down.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Strip label={hasShift ? "With your hue shift" : "Your scale"} shades={ramp} />
            <Strip label="One hue throughout" shades={fixed} muted />
            <p className="text-xs text-muted-foreground">
              {hasShift
                ? "Differences are most visible in the darkest third of the scale."
                : "Move the darkest-end hue away from the lightest-end hue to see how the shift changes the dark shades."}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Hue curve</CardTitle>
            <CardDescription>
              Hue angle for every grade. The big dots are the two endpoints you control, the small ones are the generated shades.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <HueCurveChart generated={generated} scale={scale} space={space} />
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle>Chroma and gamut</CardTitle>
            <CardDescription>
              The line is the chroma you asked for. Hatched space is colour a screen can&apos;t show at that luminance; shades that cross into it are reduced and ringed in red.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChromaChart generated={generated} scale={scale} space={space} />
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {ramp.some((s) => s.clipped) ? (
                <Badge variant="outline" className="border-red-600/40 text-red-700">
                  {ramp.filter((s) => s.clipped).length} clipped shade{ramp.filter((s) => s.clipped).length === 1 ? "" : "s"}
                </Badge>
              ) : (
                <Badge variant="outline">Everything fits inside sRGB</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EndpointCard({
  title,
  grade,
  shade,
  explain,
  children,
}: {
  title: string;
  grade?: number;
  shade?: Shade;
  explain: string;
  children: React.ReactNode;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="size-12 shrink-0 rounded-lg ring-1 ring-black/15" style={{ backgroundColor: shade?.hex }} aria-hidden />
          <div className="min-w-0">
            <CardTitle className="flex flex-wrap items-center gap-2">
              {title}
              {grade !== undefined ? <Badge variant="secondary" className="font-mono">grade {grade}</Badge> : null}
            </CardTitle>
            <p className="font-mono text-xs text-muted-foreground">{shade?.hex}</p>
          </div>
        </div>
        <CardDescription>{explain}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function Strip({ label, shades, muted }: { label: string; shades: Shade[]; muted?: boolean }) {
  return (
    <div className="space-y-1">
      <p className={cn("text-xs font-medium", muted && "text-muted-foreground")}>{label}</p>
      <div className="flex overflow-hidden rounded-md ring-1 ring-black/10">
        {shades.map((s) => (
          <div key={s.grade} className="h-10 flex-1" style={{ backgroundColor: s.hex }} title={`${s.grade} ${s.hex}`} />
        ))}
      </div>
    </div>
  );
}
