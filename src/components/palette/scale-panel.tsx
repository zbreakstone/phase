"use client";

import * as React from "react";
import { CircleAlert, CircleCheck, Plus, RotateCcw, Trash2, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
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
import { HelpTip } from "./fields";

interface Props {
  scale: ScaleConfig;
  onChange: (next: ScaleConfig) => void;
}

const toPos = (y: number) => Math.log((y + 0.05) / 1.05) / Math.log(0.05 / 1.05);
const fromPos = (p: number) => 1.05 * Math.pow(0.05 / 1.05, p) - 0.05;

export function ScalePanel({ scale, onChange }: Props) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <GradesCard scale={scale} onChange={onChange} />
        <RulesCard scale={scale} onChange={onChange} />
      </div>
      <LuminanceCard scale={scale} onChange={onChange} />
    </div>
  );
}

function GradesCard({ scale, onChange }: Props) {
  const [text, setText] = React.useState(scale.grades.join(", "));
  const [error, setError] = React.useState<string | null>(null);

  const gradesKey = scale.grades.join(", ");
  const [syncedKey, setSyncedKey] = React.useState(gradesKey);
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
    <Card size="sm">
      <CardHeader>
        <CardTitle>Grades</CardTitle>
        <CardDescription>
          Each shade gets a number from 0 (white) to 100 (black). The gap between two numbers is what decides how much contrast they have.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="grade-preset" className="text-sm">
            Preset
          </Label>
          <Select
            items={items}
            value={presetId}
            onValueChange={(v) => {
              const p = GRADE_PRESETS.find((x) => x.id === v);
              if (p) onChange({ ...scale, grades: [...p.grades], customLuminance: {} });
            }}
          >
            <SelectTrigger id="grade-preset" className="w-full">
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
          <Label htmlFor="grade-list" className="text-sm">
            Grade list
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
            className="font-mono"
          />
          {error ? (
            <p id="grade-error" className="flex items-start gap-1.5 text-xs text-destructive">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
              {error}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Comma separated, 3 to 16 whole numbers between 1 and 99. Press Enter to apply.</p>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <div className="space-y-0.5">
            <Label htmlFor="anchors" className="text-sm">
              Include white (0) and black (100)
            </Label>
            <p className="text-xs text-muted-foreground">Counts them in the contrast rules and exports them as tokens.</p>
          </div>
          <Switch id="anchors" checked={scale.includeAnchors} onCheckedChange={(v) => onChange({ ...scale, includeAnchors: v })} />
        </div>
      </CardContent>
    </Card>
  );
}

function RulesCard({ scale, onChange }: Props) {
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
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          Magic numbers
          <HelpTip>
            If two grades differ by at least the first number, their contrast ratio is guaranteed to be at least the second, whatever the hue.
          </HelpTip>
        </CardTitle>
        <CardDescription>
          Rules like &ldquo;50 or more apart reaches 4.5:1&rdquo; (WCAG 2 contrast). They&apos;re checked against every generated shade.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Select
          items={items}
          value={presetId}
          onValueChange={(v) => {
            if (v !== "custom") onChange({ ...scale, rules: makeRules(v as string) });
          }}
        >
          <SelectTrigger className="w-full" aria-label="Rule preset">
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
          <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            No rules yet. Add one to start enforcing contrast between grades.
          </p>
        ) : (
          <ul className="space-y-2">
            {feas.map(({ rule, uniformRatio, feasible }) => (
              <li key={rule.id} className="space-y-1">
                <div className="flex items-center gap-2">
                  <Input
                    aria-label="Minimum grade difference"
                    type="number"
                    min={1}
                    max={100}
                    value={rule.minDiff}
                    onChange={(e) => setRule(rule.id, { minDiff: Math.min(100, Math.max(1, Math.round(Number(e.target.value) || 1))) })}
                    className="h-8 w-16 font-mono"
                  />
                  <span className="text-sm text-muted-foreground">+ apart reaches</span>
                  <Input
                    aria-label="Minimum contrast ratio"
                    type="number"
                    min={1}
                    max={21}
                    step={0.1}
                    value={rule.ratio}
                    onChange={(e) => setRule(rule.id, { ratio: Math.min(21, Math.max(1, Number(e.target.value) || 1)) })}
                    className="h-8 w-20 font-mono"
                  />
                  <span className="text-sm text-muted-foreground">:1</span>
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
                <p className={`flex items-center gap-1.5 text-xs ${feasible ? "text-muted-foreground" : "text-destructive"}`}>
                  {feasible ? <CircleCheck className="size-3.5 text-emerald-600" /> : <TriangleAlert className="size-3.5" />}
                  {feasible
                    ? `A white-to-black scale gives ${uniformRatio.toFixed(2)}:1 at this gap.`
                    : `Impossible: grades ${rule.minDiff} apart can only reach ${uniformRatio.toFixed(2)}:1 between white and black.`}
                </p>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onChange({ ...scale, rules: [...scale.rules, { id: uid("rule"), minDiff: 50, ratio: 4.5 }] })}
            disabled={scale.rules.length >= 6}
          >
            <Plus />
            Add rule
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function LuminanceCard({ scale, onChange }: Props) {
  const grades = systemGrades(scale).filter((g) => g > 0 && g < 100);
  const violations = checkTargets(scale);
  const custom = scale.luminanceMode === "custom";

  const setY = (grade: number, y: number) =>
    onChange({
      ...scale,
      luminanceMode: "custom",
      customLuminance: { ...materialize(scale), [String(grade)]: Math.min(1, Math.max(0, y)) },
    });

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Luminance targets</CardTitle>
        <CardDescription>
          Every shade is solved to hit its target relative luminance, whatever its hue. The bar shows the window each grade may sit in without breaking a rule.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
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
            <ToggleGroupItem value="uniform">Even contrast steps</ToggleGroupItem>
            <ToggleGroupItem value="custom">Custom targets</ToggleGroupItem>
          </ToggleGroup>
          {custom ? (
            <Button variant="ghost" size="sm" onClick={() => onChange({ ...scale, luminanceMode: "uniform", customLuminance: {} })}>
              <RotateCcw />
              Reset
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          {custom
            ? "Drag a slider or type a luminance. Anything outside the green window breaks at least one rule."
            : "Each step multiplies contrast by the same factor, so the ratio between two grades depends only on how far apart they are."}
        </p>

        {violations.length > 0 ? (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>These targets break your rules</AlertTitle>
            <AlertDescription>
              <ul className="list-inside list-disc text-xs">
                {violations.slice(0, 3).map((v) => (
                  <li key={`${v.a}-${v.b}`}>
                    Grades {v.a} and {v.b} reach {v.actual.toFixed(2)}:1, need {v.required}:1.
                  </li>
                ))}
                {violations.length > 3 ? <li>and {violations.length - 3} more</li> : null}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="overflow-x-auto">
          <div className="min-w-[420px] space-y-1">
            <div className="grid grid-cols-[2.25rem_1fr_4.5rem_3.5rem] items-center gap-3 px-1 text-[11px] text-muted-foreground">
              <span>Grade</span>
              <span>Luminance (dark ← → light)</span>
              <span className="text-right">Luminance</span>
              <span className="text-right">vs white</span>
            </div>
            {grades.map((g) => (
              <LuminanceRow key={g} scale={scale} grade={g} custom={custom} onChange={(y) => setY(g, y)} />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function materialize(scale: ScaleConfig): Record<string, number> {
  const out: Record<string, number> = {};
  for (const g of scale.grades) out[String(g)] = scale.luminanceMode === "custom" ? targetLuminance(scale, g) : uniformLuminance(g);
  return out;
}

function LuminanceRow({ scale, grade, custom, onChange }: { scale: ScaleConfig; grade: number; custom: boolean; onChange: (y: number) => void }) {
  const y = targetLuminance(scale, grade);
  const range = feasibleRange(scale, grade);
  const inRange = y >= range.min - 1e-6 && y <= range.max + 1e-6;
  const left = (1 - toPos(range.min)) * 100;
  const right = (1 - toPos(range.max)) * 100;
  const [draft, setDraft] = React.useState<string | null>(null);

  return (
    <div className="grid grid-cols-[2.25rem_1fr_4.5rem_3.5rem] items-center gap-3 rounded-md px-1 py-1 hover:bg-muted/50">
      <span className="font-mono text-sm tabular-nums">{grade}</span>
      <div className="relative py-2">
        <div aria-hidden className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-muted" />
        <div
          aria-hidden
          className={`absolute top-1/2 h-2 -translate-y-1/2 rounded-full ${inRange ? "bg-emerald-500/35" : "bg-red-500/30"}`}
          style={{ left: `${left}%`, width: `${Math.max(1, right - left)}%` }}
        />
        <Slider
          aria-label={`Luminance target for grade ${grade}`}
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
        aria-label={`Luminance for grade ${grade}`}
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
        className="h-7 px-1.5 text-right font-mono text-xs tabular-nums"
      />
      <span className="text-right font-mono text-xs tabular-nums text-muted-foreground">{contrastFromLuminance(1, y).toFixed(2)}</span>
    </div>
  );
}
