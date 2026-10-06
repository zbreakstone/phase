"use client";

import * as React from "react";
import { Crosshair, Pin, PinOff, Scissors, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { parseHex } from "@/lib/color/convert";
import { colorFromCoords } from "@/lib/color/solve";
import { SPACES, type SpaceId } from "@/lib/color/spaces";
import { readableOn } from "@/lib/color/contrast";
import { coordsOf, type SourceAnalysis } from "@/lib/palette/source";
import type { ScaleConfig, SourceColor } from "@/lib/palette/types";

interface Props {
  space: SpaceId;
  scale: ScaleConfig;
  source: SourceColor | null | undefined;
  analysis: SourceAnalysis | null;
  onChange: (source: SourceColor | null) => void;
}

export function SourceEditor({ space, scale, source, analysis, onChange }: Props) {
  const def = SPACES[space];
  const [hexDraft, setHexDraft] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const hex = source?.hex ?? "";

  const applyHex = (text: string) => {
    const parsed = parseHex(text);
    if (!parsed) {
      setError("Use a hex colour such as #3b82f6 or 3b82f6.");
      return;
    }
    setError(null);
    setHexDraft(null);
    onChange({ grade: source?.grade ?? null, pinned: source?.pinned ?? false, hex: parsed });
  };

  return (
    <div className="space-y-3">
      <Tabs defaultValue="hex">
        <TabsList className="w-full">
          <TabsTrigger value="hex">Hex</TabsTrigger>
          <TabsTrigger value="coords">In {def.short}</TabsTrigger>
        </TabsList>
        <TabsContent value="hex" className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Input
              type="color"
              aria-label="Pick a source colour"
              value={hex || "#3b82f6"}
              onChange={(e) => applyHex(e.target.value)}
              className="h-8 w-10 shrink-0 cursor-pointer rounded-none p-0.5"
            />
            <Input
              aria-label="Source colour hex"
              placeholder="#3b82f6"
              value={hexDraft ?? hex}
              aria-invalid={error ? true : undefined}
              onChange={(e) => {
                setHexDraft(e.target.value);
                setError(parseHex(e.target.value) || e.target.value === "" ? null : "Use a hex colour such as #3b82f6 or 3b82f6.");
              }}
              onBlur={(e) => (e.target.value.trim() ? applyHex(e.target.value) : (setHexDraft(null), setError(null)))}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyHex((e.target as HTMLInputElement).value);
              }}
              className="h-8 font-mono"
            />
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </TabsContent>
        <TabsContent value="coords">
          <CoordsForm
            key={hex}
            space={space}
            hex={hex || "#3b82f6"}
            onApply={(h) => onChange({ grade: source?.grade ?? null, pinned: source?.pinned ?? false, hex: h })}
          />
        </TabsContent>
      </Tabs>

      {source && analysis ? (
        <>
          <Compare analysis={analysis} space={space} />
          <div className="space-y-1.5">
            <Label htmlFor="source-step" className="text-xs">
              Lands on step
            </Label>
            <Select
              items={[
                { value: "auto", label: "Nearest by luminance" },
                ...scale.grades.map((g) => ({ value: String(g), label: String(g) })),
              ]}
              value={source.grade === null || !scale.grades.includes(source.grade) ? "auto" : String(source.grade)}
              onValueChange={(v) => onChange({ ...source, grade: v === "auto" ? null : Number(v) })}
            >
              <SelectTrigger id="source-step" size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Nearest by luminance</SelectItem>
                {scale.grades.map((g) => (
                  <SelectItem key={g} value={String(g)}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-start justify-between gap-3 border border-border p-2.5">
            <div className="space-y-0.5">
              <Label htmlFor="source-pin" className="flex items-center gap-1.5 text-xs">
                {source.pinned ? <Pin className="size-3.5" /> : <PinOff className="size-3.5" />}
                Pin exact colour
              </Label>
              <p className="text-[11px] text-muted-foreground">
                {source.pinned
                  ? analysis.onStep
                    ? "Kept as entered. It already sits on the step, so contrast is unaffected."
                    : `Kept as entered, ${analysis.shift.toFixed(2)}:1 off the step's luminance target. Pairs with it may miss their rule; the grid shows which.`
                  : "Off: the colour is adjusted to the step's luminance so the guarantee holds."}
              </p>
            </div>
            <Switch id="source-pin" checked={source.pinned} onCheckedChange={(v) => onChange({ ...source, pinned: v })} />
          </div>
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => onChange(null)}>
            <X />
            Remove source colour
          </Button>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          Enter a brand colour and Phase builds this hue around it: the colour is moved to the nearest luminance step, and the rest of the scale is generated from your rules.
        </p>
      )}
    </div>
  );
}

function Compare({ analysis, space }: { analysis: SourceAnalysis; space: SpaceId }) {
  const def = SPACES[space];
  const { original, adjusted } = analysis;
  const fmt = (c: { L: number; C: number; h: number }) =>
    `${c.L.toFixed(def.lightnessMax > 1 ? 1 : 3)}  ${c.C.toFixed(def.chroma.decimals)}  ${Math.round(c.h)}°`;
  return (
    <div className="border border-border">
      <div className="grid grid-cols-2">
        <Swatch label="Original" hex={original.hex} detail={fmt(original)} />
        <Swatch label={analysis.pinned ? "Pinned (kept)" : "Adjusted"} hex={analysis.pinned ? original.hex : adjusted.hex} detail={analysis.pinned ? fmt(original) : fmt(adjusted)} />
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-t border-border p-2 text-xs">
        <Badge variant="secondary" className="gap-1 rounded-none font-mono">
          <Crosshair className="size-3" />
          step {analysis.grade}
        </Badge>
        <span className="text-muted-foreground">
          {analysis.onStep
            ? "Already on the step."
            : `Lightness moved to hit the step (${analysis.shift.toFixed(2)}:1 shift). Hue and chroma kept.`}
        </span>
        {adjusted.clipped && !analysis.pinned ? (
          <Badge variant="outline" className="gap-1 rounded-none text-amber-300">
            <Scissors className="size-3" />
            chroma reduced to fit sRGB
          </Badge>
        ) : null}
      </div>
      <p className="border-t border-border px-2 py-1 font-mono text-[10px] text-muted-foreground">
        {def.short} L C h · luminance {original.luminance.toFixed(3)} → {analysis.targetLuminance.toFixed(3)}
      </p>
    </div>
  );
}

function Swatch({ label, hex, detail }: { label: string; hex: string; detail: string }) {
  const fg = readableOn(hex);
  return (
    <div className="flex h-20 flex-col justify-between p-2" style={{ backgroundColor: hex, color: fg }}>
      <span className="text-[11px] font-semibold">{label}</span>
      <span className="font-mono text-[11px] leading-tight">
        {hex}
        <br />
        <span className="opacity-80">{detail}</span>
      </span>
    </div>
  );
}

function CoordsForm({ space, hex, onApply }: { space: SpaceId; hex: string; onApply: (hex: string) => void }) {
  const def = SPACES[space];
  const start = coordsOf(space, hex);
  const [L, setL] = React.useState(String(Number(start.L.toFixed(def.lightnessMax > 1 ? 1 : 3))));
  const [C, setC] = React.useState(String(Number(start.C.toFixed(def.chroma.decimals))));
  const [h, setH] = React.useState(String(Math.round(start.h)));
  const nums = [Number(L), Number(C), Number(h)];
  const valid = nums.every(Number.isFinite) && L.trim() !== "" && C.trim() !== "" && h.trim() !== "";
  const result = valid ? colorFromCoords(def, nums[0], nums[1], nums[2]) : null;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {[
          { id: "L", label: "L", v: L, set: setL, step: def.lightnessMax > 1 ? 1 : 0.01 },
          { id: "C", label: def.id === "hsluv" ? "S" : "C", v: C, set: setC, step: def.chroma.step },
          { id: "H", label: "H", v: h, set: setH, step: 1 },
        ].map((f) => (
          <div key={f.id} className="space-y-1">
            <Label htmlFor={`coord-${f.id}`} className="text-xs">
              {f.label}
            </Label>
            <Input id={`coord-${f.id}`} type="number" step={f.step} value={f.v} onChange={(e) => f.set(e.target.value)} className="h-8 font-mono" />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="size-8 shrink-0 border border-border" style={{ backgroundColor: result?.hex ?? "transparent" }} aria-hidden />
        <span className="font-mono text-xs">{result?.hex ?? "Enter three numbers"}</span>
        {result?.clipped ? <span className="text-[11px] text-amber-300">chroma reduced to fit sRGB</span> : null}
        <Button size="sm" className="ml-auto" disabled={!result} onClick={() => result && onApply(result.hex)}>
          Use colour
        </Button>
      </div>
    </div>
  );
}
