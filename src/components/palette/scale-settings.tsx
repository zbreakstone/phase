"use client";

import * as React from "react";
import { CircleAlert, CircleCheck, Plus, RotateCcw, Trash2, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { contrastFromLuminance } from "@/lib/color/contrast";
import { makeRules, uid } from "@/lib/palette/defaults";
import {
  GRADE_PRESETS,
  RULE_PRESETS,
  checkTargets,
  feasibleRange,
  parseGrades,
  ruleFeasibility,
  systemGrades,
  targetLuminance,
  uniformLuminance,
} from "@/lib/palette/scale";
import type { ContrastRule, ScaleConfig } from "@/lib/palette/types";

const toPos = (y: number) => Math.log((y + 0.05) / 1.05) / Math.log(0.05 / 1.05);
const fromPos = (p: number) => 1.05 * Math.pow(0.05 / 1.05, p) - 0.05;

interface ScaleProps {
  scale: ScaleConfig;
  onChange: (next: ScaleConfig) => void;
}

export function StepsSettings({ scale, onChange }: ScaleProps) {
  const gradesKey = scale.grades.join(", ");
  const [text, setText] = React.useState(gradesKey);
  const [syncedKey, setSyncedKey] = React.useState(gradesKey);
  const [error, setError] = React.useState<string | null>(null);
  if (syncedKey !== gradesKey) {
    setSyncedKey(gradesKey);
    setText(gradesKey);
    setError(null);
  }

  const apply = (value: string) => {
    const res = parseGrades(value);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setError(null);
    onChange({ ...scale, grades: res.grades, customLuminance: {} });
  };

  const presetId = GRADE_PRESETS.find((p) => p.grades.join() === scale.grades.join())?.id ?? "custom";
  const items = [...GRADE_PRESETS.map((p) => ({ value: p.id, label: p.label })), { value: "custom", label: "Custom list" }];

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="grade-preset" className="text-xs">
          Shade count
        </Label>
        <Select
          items={items}
          value={presetId}
          onValueChange={(v) => {
            const p = GRADE_PRESETS.find((x) => x.id === v);
            if (p) onChange({ ...scale, grades: [...p.grades], customLuminance: {} });
          }}
        >
          <SelectTrigger id="grade-preset" size="sm" className="w-full">
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
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="grade-list" className="text-xs">
          Step names
        </Label>
        <Input
          id="grade-list"
          value={text}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "grade-error" : undefined}
          onChange={(e) => {
            setText(e.target.value);
            const res = parseGrades(e.target.value);
            setError(res.ok ? null : res.error);
          }}
          onBlur={() => apply(text)}
          onKeyDown={(e) => {
            if (e.key === "Enter") apply(text);
          }}
          className="h-8 font-mono text-xs"
        />
        {error ? (
          <p id="grade-error" className="flex items-start gap-1.5 text-xs text-destructive">
            <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
            {error}
          </p>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            3 to 16 whole numbers from 1 to 999, Enter to apply. White (0) and black (1000) always bookend every hue.
          </p>
        )}
      </div>
    </div>
  );
}

export function RulesSettings({ scale, onChange }: ScaleProps) {
  const feas = ruleFeasibility(scale.rules);
  const setRule = (id: string, patch: Partial<ContrastRule>) =>
    onChange({ ...scale, rules: scale.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
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
        Two shades whose step names differ by at least the first number are guaranteed at least the second as a WCAG 2 contrast ratio, for any hue.
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
          {feas.map(({ rule, uniformRatio, feasible }) => (
            <li key={rule.id} className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Input
                  aria-label="Minimum step difference"
                  type="number"
                  min={1}
                  max={1000}
                  step={50}
                  value={rule.minDiff}
                  onChange={(e) => setRule(rule.id, { minDiff: Math.min(1000, Math.max(1, Math.round(Number(e.target.value) || 1))) })}
                  className="h-8 w-20 font-mono text-xs"
                />
                <span className="text-xs text-muted-foreground">+ apart ≥</span>
                <Input
                  aria-label="Minimum contrast ratio"
                  type="number"
                  min={1}
                  max={21}
                  step={0.1}
                  value={rule.ratio}
                  onChange={(e) => setRule(rule.id, { ratio: Math.min(21, Math.max(1, Number(e.target.value) || 1)) })}
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
              <p className={`flex items-center gap-1.5 text-[11px] ${feasible ? "text-muted-foreground" : "text-destructive"}`}>
                {feasible ? <CircleCheck className="size-3.5 text-emerald-400" /> : <TriangleAlert className="size-3.5" />}
                {feasible
                  ? `White to black gives ${uniformRatio.toFixed(2)}:1 at this gap.`
                  : `Impossible: steps ${rule.minDiff} apart reach at most ${uniformRatio.toFixed(2)}:1.`}
              </p>
            </li>
          ))}
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
  for (const g of scale.grades) out[String(g)] = scale.luminanceMode === "custom" ? targetLuminance(scale, g) : uniformLuminance(g);
  return out;
}

export function TargetCurve({ scale, referenceY, onChange }: ScaleProps & { referenceY: number }) {
  const grades = systemGrades(scale).filter((g) => g > 0 && g < 1000);
  const violations = checkTargets(scale);
  const custom = scale.luminanceMode === "custom";

  const setY = (grade: number, y: number) =>
    onChange({
      ...scale,
      luminanceMode: "custom",
      customLuminance: { ...materialize(scale), [String(grade)]: Math.min(1, Math.max(0, y)) },
    });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <ToggleGroup
          value={[scale.luminanceMode]}
          onValueChange={(v) => {
            if (v[0] === "uniform") onChange({ ...scale, luminanceMode: "uniform" });
            if (v[0] === "custom") onChange({ ...scale, luminanceMode: "custom", customLuminance: materialize(scale) });
          }}
          variant="outline"
          size="sm"
          spacing={0}
          aria-label="Luminance mode"
        >
          <ToggleGroupItem value="uniform" className="rounded-none">Even contrast</ToggleGroupItem>
          <ToggleGroupItem value="custom" className="rounded-none">Custom</ToggleGroupItem>
        </ToggleGroup>
        {custom ? (
          <Button variant="ghost" size="sm" onClick={() => onChange({ ...scale, luminanceMode: "uniform", customLuminance: {} })}>
            <RotateCcw />
            Reset
          </Button>
        ) : null}
      </div>
      <p className="text-[11px] text-muted-foreground">
        {custom
          ? "Drag a step or type a luminance. The band behind each slider is the window that keeps every rule intact."
          : "Each step multiplies contrast by the same factor, so ratio depends only on how far apart two steps are. Switch to Custom to move individual steps."}
      </p>

      {violations.length > 0 ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>These targets break your rules</AlertTitle>
          <AlertDescription>
            <ul className="list-inside list-disc text-xs">
              {violations.slice(0, 3).map((v) => (
                <li key={`${v.a}-${v.b}`}>
                  {v.a} and {v.b} reach {v.actual.toFixed(2)}:1, need {v.required}:1.
                </li>
              ))}
              {violations.length > 3 ? <li>and {violations.length - 3} more</li> : null}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-0.5">
        <div className="grid grid-cols-[2.25rem_1fr_3.75rem_3rem] items-center gap-2 px-1 text-[10px] text-muted-foreground">
          <span>Step</span>
          <span>dark ← luminance → light</span>
          <span className="text-right">Y</span>
          <span className="text-right">vs white</span>
        </div>
        {grades.map((g) => (
          <TargetRow key={g} scale={scale} grade={g} custom={custom} referenceY={referenceY} onChange={(y) => setY(g, y)} />
        ))}
      </div>
    </div>
  );
}

function TargetRow({ scale, grade, custom, referenceY, onChange }: { scale: ScaleConfig; grade: number; custom: boolean; referenceY: number; onChange: (y: number) => void }) {
  const y = targetLuminance(scale, grade);
  const range = feasibleRange(scale, grade);
  const inRange = y >= range.min - 1e-6 && y <= range.max + 1e-6;
  const left = (1 - toPos(range.min)) * 100;
  const right = (1 - toPos(range.max)) * 100;
  const [draft, setDraft] = React.useState<string | null>(null);

  return (
    <div className="grid grid-cols-[2.25rem_1fr_3.75rem_3rem] items-center gap-2 px-1 py-0.5 hover:bg-muted/40">
      <span className="font-mono text-xs tabular-nums">{grade}</span>
      <div className="relative py-1.5">
        <div aria-hidden className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 bg-muted" />
        <div
          aria-hidden
          className={`absolute top-1/2 h-2 -translate-y-1/2 ${inRange ? "bg-emerald-500/40" : "bg-red-500/40"}`}
          style={{ left: `${left}%`, width: `${Math.max(1, right - left)}%` }}
        />
        <Slider
          aria-label={`Luminance target for step ${grade}`}
          value={[1 - toPos(y)]}
          min={0}
          max={1}
          step={0.002}
          disabled={!custom}
          onValueChange={(v) => onChange(fromPos(1 - (Array.isArray(v) ? v[0] : v)))}
          className="relative [&_[data-slot=slider-track]]:bg-transparent [&_[data-slot=slider-range]]:bg-transparent"
        />
      </div>
      <Input
        aria-label={`Luminance for step ${grade}`}
        type="number"
        min={0}
        max={1}
        step={0.001}
        disabled={!custom}
        value={draft ?? y.toFixed(3)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => {
          const n = Number(e.target.value);
          if (e.target.value.trim() !== "" && Number.isFinite(n)) onChange(n);
          setDraft(null);
        }}
        className="h-7 px-1.5 text-right font-mono text-[11px] tabular-nums"
      />
      <span className="text-right font-mono text-[11px] tabular-nums text-muted-foreground">{contrastFromLuminance(referenceY, y).toFixed(2)}</span>
    </div>
  );
}
