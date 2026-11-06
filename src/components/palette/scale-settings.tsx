"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { makeRules, uid } from "@/lib/palette/defaults";
import {
  RULE_PRESETS,
  feasibleRange,
  maxRatioForDiff,
  ruleFeasibility,
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
  // Presets are read-only. Choosing Custom starts from the rules you were on and unlocks them.
  const [pickedCustom, setPickedCustom] = React.useState(false);
  const matched = RULE_PRESETS.find(
    (p) =>
      p.rules.length === scale.rules.length &&
      p.rules.every((r, i) => r.minDiff === scale.rules[i]?.minDiff && r.ratio === scale.rules[i]?.ratio),
  );
  const editable = pickedCustom || !matched;
  const presetId = editable ? "custom" : matched.id;
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
          if (v === "custom") {
            setPickedCustom(true);
            return;
          }
          setPickedCustom(false);
          onChange({ ...scale, rules: makeRules(v as string) });
        }}
      >
        <SelectTrigger size="sm" className="w-full" aria-label="Rule preset">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((i) => (
            <SelectItem key={i.value} value={i.value}>
              {i.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {scale.rules.length === 0 ? (
        <p className="border border-dashed border-border p-3 text-xs text-muted-foreground">
          {editable ? "No rules yet. Add one to start enforcing contrast between steps." : "This preset has no rules. Choose Custom rules to add some."}
        </p>
      ) : (
        <ul className="space-y-2">
          {feas.map(({ rule, uniformRatio }) => {
            const maxed = rule.ratio >= maxRatioForDiff(rule.minDiff);
            return (
              <li key={rule.id} className="space-y-1">
                {editable ? (
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
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="flex h-8 w-20 items-center rounded-lg bg-muted/50 px-2.5 font-mono text-xs">{rule.minDiff}</span>
                    <span className="text-xs text-muted-foreground">apart reach</span>
                    <span className="flex h-8 w-16 items-center rounded-lg bg-muted/50 px-2.5 font-mono text-xs">{rule.ratio}</span>
                    <span className="text-xs text-muted-foreground">:1</span>
                  </div>
                )}
                {editable && maxed ? (
                  <p className="text-[11px] text-muted-foreground">{uniformRatio.toFixed(2)}:1 is the most steps {rule.minDiff} apart can reach, so this is as high as it goes.</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {editable ? (
      <Button
        variant="outline"
        size="sm"
        onClick={() => onChange({ ...scale, rules: [...scale.rules, { id: uid("rule"), minDiff: 500, ratio: 4.5 }] })}
        disabled={scale.rules.length >= 6}
      >
        <Plus />
        Add rule
      </Button>
      ) : null}
    </div>
  );
}

function materialize(scale: ScaleConfig): Record<string, number> {
  const out: Record<string, number> = {};
  for (const g of scale.grades) out[String(g)] = targetLuminance(scale, g);
  return out;
}

/** True when any step sits somewhere other than where its starting look puts it. */
export function hasTargetOverrides(scale: ScaleConfig): boolean {
  return scale.luminanceMode === "custom" ? Object.keys(scale.customLuminance).length > 0 : scale.luminanceMode === "uniform";
}

export function resetTargets(scale: ScaleConfig): ScaleConfig {
  return { ...scale, luminanceMode: "envoy", customLuminance: {} };
}

/** Pins one step's luminance target. Every other step keeps following the rules. */
export function setStepTarget(scale: ScaleConfig, grade: number, y: number): ScaleConfig {
  return {
    ...scale,
    luminanceMode: "custom",
    customLuminance: { ...(scale.luminanceMode === "uniform" ? materialize(scale) : scale.customLuminance), [String(grade)]: Math.min(1, Math.max(0, y)) },
  };
}

export function isStepOverridden(scale: ScaleConfig, grade: number): boolean {
  return scale.luminanceMode === "uniform" || (scale.luminanceMode === "custom" && String(grade) in scale.customLuminance);
}

export function clearStepTarget(scale: ScaleConfig, grade: number): ScaleConfig {
  const base = scale.luminanceMode === "uniform" ? materialize(scale) : scale.customLuminance;
  const { [String(grade)]: _removed, ...rest } = base;
  void _removed;
  return Object.keys(rest).length === 0 ? resetTargets(scale) : { ...scale, luminanceMode: "custom", customLuminance: rest };
}

/** One step's luminance target: a slider inside the window the rules allow, with dots at the stops it snaps to, plus the exact value. */
export function StepTarget({ scale, grade, onChange }: { scale: ScaleConfig; grade: number; onChange: (y: number) => void }) {
  const y = targetLuminance(scale, grade);
  const range = feasibleRange(scale, grade);
  const inRange = y >= range.min - 1e-6 && y <= range.max + 1e-6;
  // Lighter is on the left, like the grid above: white (Y = 1) sits at 0 and black at 1.
  const left = toPos(range.max) * 100;
  const right = toPos(range.min) * 100;
  // Quick stops inside the allowed window: lightest, middle, darkest. The thumb snaps onto them.
  const stops = range.max - range.min > 1e-6 ? [toPos(range.max), (toPos(range.max) + toPos(range.min)) / 2, toPos(range.min)] : [toPos(range.min)];
  const SNAP = 0.012;
  const [draft, setDraft] = React.useState<string | null>(null);
  const pos = toPos(y);

  const id = `step-${grade}-luminance`;

  const commit = (raw: string) => {
    const n = Number(raw);
    if (raw.trim() !== "" && Number.isFinite(n)) onChange(Math.min(1, Math.max(0, n)));
    setDraft(null);
  };

  // Laid out exactly like the Adjustments sliders: label and field on one row, the bar below.
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="font-sans text-sm">
          Luminance
        </Label>
        <div
          onMouseDown={(e) => {
            if (e.target === e.currentTarget || !(e.target instanceof HTMLInputElement)) {
              e.preventDefault();
              e.currentTarget.querySelector("input")?.focus();
            }
          }}
          className="flex h-7 w-24 items-center rounded-lg bg-white shadow-(--shadow-default) transition-[color,box-shadow] focus-within:ring-3 focus-within:ring-ring/50 hover:shadow-(--shadow-large) dark:bg-input/30"
        >
          <Input
            id={id}
            aria-label={`Luminance for step ${grade}`}
            type="number"
            inputMode="decimal"
            min={0}
            max={1}
            step={0.001}
            value={draft ?? y.toFixed(3)}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit((e.target as HTMLInputElement).value);
            }}
            className="h-full min-w-0 flex-1 rounded-none bg-transparent px-2 text-left font-mono text-xs tabular-nums shadow-none hover:shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        </div>
      </div>
      <div className="relative flex h-5 items-center">
        {/* The bar, with the window the rules allow on it: green while the target sits inside, red when it doesn't. */}
        <div aria-hidden className="absolute inset-x-0 h-4 overflow-hidden rounded-full bg-muted shadow-(--shadow-default)">
          <div
            className={`absolute inset-y-0 rounded-full ${inRange ? "bg-emerald-500/40" : "bg-red-500/40"}`}
            style={{ left: `${left}%`, width: `${Math.max(1, right - left)}%` }}
          />
        </div>
        <Slider
          aria-label={`Luminance target for step ${grade}`}
          value={[pos]}
          min={0}
          max={1}
          step={0.002}
          marks={stops}
          // Center alignment puts the handle exactly at value% of the width, which is where the band and dots are drawn.
          thumbAlignment="center"
          getAriaValueText={(_, v) => {
            const luminance = fromPos(v);
            const snapped = stops.some((p) => Math.abs(p - v) < 1e-6);
            return `Luminance ${luminance.toFixed(3)}${snapped ? ", at a stop" : ""}`;
          }}
          onValueChange={(v, details) => {
            const raw = Array.isArray(v) ? v[0] : v;
            if (details.reason === "keyboard") {
              // Arrow keys move in small steps; landing on the first stop they cross lets keyboard users reach each one
              // exactly, and the next press carries on past it (so a stop never traps the thumb).
              const crossed = stops.filter((p) => (pos < p && raw >= p) || (pos > p && raw <= p)).sort((a, b) => Math.abs(a - pos) - Math.abs(b - pos))[0];
              onChange(fromPos(crossed ?? raw));
              return;
            }
            const near = stops.find((p) => Math.abs(p - raw) <= SNAP);
            onChange(fromPos(near ?? raw));
          }}
          className="relative [&_[data-slot=slider-range]]:hidden [&_[data-slot=slider-thumb]]:size-4 [&_[data-slot=slider-thumb]]:border-2 [&_[data-slot=slider-thumb]]:border-white [&_[data-slot=slider-thumb]]:shadow-(--shadow-default) [&_[data-slot=slider-track]]:bg-transparent"
        />
      </div>
    </div>
  );
}
