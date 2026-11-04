"use client";

import * as React from "react";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { contrastFromLuminance } from "@/lib/color/contrast";
import { makeRules, uid } from "@/lib/palette/defaults";
import {
  RULE_PRESETS,
  feasibleRange,
  maxRatioForDiff,
  ruleFeasibility,
  systemGrades,
  targetLuminance,
} from "@/lib/palette/scale";
import type { ContrastRule, ScaleConfig } from "@/lib/palette/types";

const toPos = (y: number) => Math.log((y + 0.05) / 1.05) / Math.log(0.05 / 1.05);
const fromPos = (p: number) => 1.05 * Math.pow(0.05 / 1.05, p) - 0.05;

interface ScaleProps {
  scale: ScaleConfig;
  onChange: (next: ScaleConfig) => void;
}

/** A number box that lets you type freely and only clamps when you leave it, so clearing or retyping never jumps. */
function NumberField({ value, onCommit, className, ...rest }: { value: number; onCommit: (n: number) => void; className?: string } & Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "onBlur" | "className">) {
  const [draft, setDraft] = React.useState<string | null>(null);
  const commit = () => {
    const n = Number(draft);
    if (draft !== null && draft.trim() !== "" && Number.isFinite(n)) onCommit(n);
    setDraft(null);
  };
  return (
    <Input
      {...rest}
      type="number"
      value={draft ?? String(value)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setDraft(null);
      }}
      className={className}
    />
  );
}

export function RulesSettings({ scale, onChange }: ScaleProps) {
  const feas = ruleFeasibility(scale.rules);
  const setRule = (id: string, patch: Partial<ContrastRule>) =>
    onChange({
      ...scale,
      rules: scale.rules.map((r) => {
        if (r.id !== id) return r;
        const next = { ...r, ...patch };
        // A ratio the gap can't reach is held at the most it can.
        return { ...next, ratio: Math.min(next.ratio, maxRatioForDiff(next.minDiff)) };
      }),
    });
  const presetId =
    RULE_PRESETS.find(
      (p) =>
        p.rules.length === scale.rules.length &&
        p.rules.every((r, i) => r.minDiff === scale.rules[i]?.minDiff && r.ratio === scale.rules[i]?.ratio),
    )?.id ?? "custom";
  const items = [...RULE_PRESETS.map((p) => ({ value: p.id, label: p.label })), { value: "custom", label: "Custom rules" }];

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground">
        Any two steps this far apart or more always reach at least this contrast, for every color. Luminance targets move to keep each rule true.
      </p>
      <Select
        items={items}
        value={presetId}
        onValueChange={(v) => {
          if (v !== "custom") onChange({ ...scale, rules: makeRules(v as string) });
        }}
      >
        <SelectTrigger size="sm" className="w-full" aria-label="Rule preset">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((i) => (
            <SelectItem key={i.value} value={i.value} disabled={i.value === "custom"}>
              {i.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {scale.rules.length === 0 ? (
        <p className="border border-dashed border-border p-3 text-xs text-muted-foreground">
          No rules yet. Add one to start enforcing contrast between steps.
        </p>
      ) : (
        <ul className="space-y-2">
          {feas.map(({ rule, uniformRatio }) => {
            const maxed = rule.ratio >= maxRatioForDiff(rule.minDiff);
            return (
              <li key={rule.id} className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <NumberField
                    aria-label="Minimum step difference"
                    min={1}
                    max={1000}
                    step={50}
                    value={rule.minDiff}
                    onCommit={(n) => setRule(rule.id, { minDiff: Math.min(1000, Math.max(1, Math.round(n))) })}
                    className="h-8 w-20 font-mono text-xs"
                  />
                  <span className="text-xs text-muted-foreground">apart reach</span>
                  <NumberField
                    aria-label="Minimum contrast ratio"
                    min={1}
                    max={21}
                    step={0.1}
                    value={rule.ratio}
                    onCommit={(n) => setRule(rule.id, { ratio: Math.max(1, Math.round(n * 100) / 100) })}
                    className="h-8 w-16 font-mono text-xs"
                  />
                  <span className="text-xs text-muted-foreground">:1</span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="ml-auto"
                    aria-label="Remove rule"
                    onClick={() => onChange({ ...scale, rules: scale.rules.filter((r) => r.id !== rule.id) })}
                  >
                    <Trash2 />
                  </Button>
                </div>
                {maxed ? (
                  <p className="text-[11px] text-muted-foreground">{uniformRatio.toFixed(2)}:1 is the most steps {rule.minDiff} apart can reach, so this is as high as it goes.</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onChange({ ...scale, rules: [...scale.rules, { id: uid("rule"), minDiff: 500, ratio: 4.5 }] })}
        disabled={scale.rules.length >= 6}
      >
        <Plus />
        Add rule
      </Button>
    </div>
  );
}

function materialize(scale: ScaleConfig): Record<string, number> {
  const out: Record<string, number> = {};
  for (const g of scale.grades) out[String(g)] = targetLuminance(scale, g);
  return out;
}

export function TargetCurve({ scale, referenceY, onChange }: ScaleProps & { referenceY: number }) {
  const grades = systemGrades(scale).filter((g) => g > 0 && g < 1000);
  const adjusted = scale.luminanceMode === "custom" ? Object.keys(scale.customLuminance).length > 0 : scale.luminanceMode === "uniform";

  const setY = (grade: number, y: number) =>
    onChange({
      ...scale,
      luminanceMode: "custom",
      customLuminance: { ...(scale.luminanceMode === "uniform" ? materialize(scale) : scale.customLuminance), [String(grade)]: Math.min(1, Math.max(0, y)) },
    });

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] text-muted-foreground">
          Starts from Katie Riley&apos;s Envoy ranges and moves only as far as your contrast rules need. Drag a step or type a luminance to override it. The green band is the range that keeps every rule true.
        </p>
        {adjusted ? (
          <Button variant="ghost" size="sm" className="shrink-0" onClick={() => onChange({ ...scale, luminanceMode: "envoy", customLuminance: {} })}>
            <RotateCcw />
            Reset
          </Button>
        ) : null}
      </div>

      <div className="space-y-0.5">
        <div className="grid grid-cols-[2.25rem_1fr_4.5rem_3rem] items-center gap-2 px-1 text-[10px] text-muted-foreground">
          <span>Step</span>
          <span className="flex justify-between">
            <span>← Lighter</span>
            <span>Darker →</span>
          </span>
          <span className="text-right" title="Relative luminance (WCAG Y): 1 is white, 0 is black. Contrast between two steps comes from the ratio of their luminance.">
            Luminance
          </span>
          <span className="text-right">vs white</span>
        </div>
        {grades.map((g) => (
          <TargetRow key={g} scale={scale} grade={g} referenceY={referenceY} onChange={(y) => setY(g, y)} />
        ))}
      </div>
    </div>
  );
}

function TargetRow({ scale, grade, referenceY, onChange }: { scale: ScaleConfig; grade: number; referenceY: number; onChange: (y: number) => void }) {
  const y = targetLuminance(scale, grade);
  const range = feasibleRange(scale, grade);
  const inRange = y >= range.min - 1e-6 && y <= range.max + 1e-6;
  // Lighter is on the left, like the grid above: white (Y = 1) sits at 0 and black at 1.
  const left = toPos(range.max) * 100;
  const right = toPos(range.min) * 100;
  // Quick stops inside the allowed window: lightest, middle, darkest.
  const stops = range.max - range.min > 1e-6 ? [toPos(range.max), (toPos(range.max) + toPos(range.min)) / 2, toPos(range.min)] : [toPos(range.min)];
  const SNAP = 0.012;
  const [draft, setDraft] = React.useState<string | null>(null);

  return (
    <div className="grid grid-cols-[2.25rem_1fr_4.5rem_3rem] items-center gap-2 px-1 py-0.5 hover:bg-muted/40">
      <span className="font-mono text-xs tabular-nums">{grade}</span>
      <div className="relative py-1.5">
        <div aria-hidden className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 bg-muted" />
        <div
          aria-hidden
          className={`absolute top-1/2 h-2 -translate-y-1/2 ${inRange ? "bg-emerald-500/40" : "bg-red-500/40"}`}
          style={{ left: `${left}%`, width: `${Math.max(1, right - left)}%` }}
        />
        {stops.map((p, i) => (
          <div key={i} aria-hidden className="pointer-events-none absolute top-1/2 h-3.5 w-px -translate-y-1/2 bg-foreground/50" style={{ left: `${p * 100}%` }} />
        ))}
        <Slider
          aria-label={`Luminance target for step ${grade}`}
          value={[toPos(y)]}
          min={0}
          max={1}
          step={0.002}
          // Center alignment puts the handle exactly at value% of the width, which is where the band and ticks are drawn.
          thumbAlignment="center"
          onValueChange={(v) => {
            const raw = Array.isArray(v) ? v[0] : v;
            const near = stops.find((p) => Math.abs(p - raw) <= SNAP);
            onChange(fromPos(near ?? raw));
          }}
          className="relative [&_[data-slot=slider-track]]:bg-transparent [&_[data-slot=slider-range]]:bg-transparent"
        />
      </div>
      <Input
        aria-label={`Luminance for step ${grade}`}
        type="number"
        min={0}
        max={1}
        step={0.001}
        value={draft ?? y.toFixed(3)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => {
          const n = Number(e.target.value);
          if (e.target.value.trim() !== "" && Number.isFinite(n)) onChange(n);
          setDraft(null);
        }}
        className="h-7 px-1.5 text-right font-mono text-[11px] tabular-nums md:text-[11px]"
      />
      <span className="text-right font-mono text-[11px] tabular-nums text-muted-foreground">{contrastFromLuminance(referenceY, y).toFixed(2)}</span>
    </div>
  );
}
