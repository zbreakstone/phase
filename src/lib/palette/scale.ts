import type { ContrastRule, ScaleConfig } from "./types";
import { contrastFromLuminance } from "../color/contrast";

export const MIN_GRADES = 3;
export const MAX_GRADES = 16;

export const GRADE_PRESETS: { id: string; label: string; grades: number[] }[] = [
  { id: "uswds", label: "USWDS (10 grades)", grades: [5, 10, 20, 30, 40, 50, 60, 70, 80, 90] },
  { id: "tens", label: "Tens (9 grades)", grades: [10, 20, 30, 40, 50, 60, 70, 80, 90] },
  { id: "fives", label: "Fine (every 5, 13 grades)", grades: [5, 10, 15, 20, 30, 40, 50, 60, 70, 80, 85, 90, 95] },
];

export const RULE_PRESETS: { id: string; label: string; rules: Omit<ContrastRule, "id">[] }[] = [
  {
    id: "uswds",
    label: "USWDS: 40 / 50 / 70",
    rules: [
      { minDiff: 40, ratio: 3 },
      { minDiff: 50, ratio: 4.5 },
      { minDiff: 70, ratio: 7 },
    ],
  },
  {
    id: "relaxed",
    label: "Relaxed: 50 / 70 / 90",
    rules: [
      { minDiff: 50, ratio: 3 },
      { minDiff: 70, ratio: 4.5 },
      { minDiff: 90, ratio: 7 },
    ],
  },
  {
    id: "strict",
    label: "Strict: 40 / 50 / 60 (AA large / AA / AAA-ish)",
    rules: [
      { minDiff: 40, ratio: 3 },
      { minDiff: 50, ratio: 4.5 },
      { minDiff: 60, ratio: 6 },
    ],
  },
];

export const WHITE_Y = 1;
export const BLACK_Y = 0;

/**
 * Luminance for a grade when contrast is spread evenly from white (grade 0) to
 * black (grade 100): (Y + 0.05) falls geometrically, so two grades N apart
 * always have a ratio of 21^(N/100) no matter where they sit on the scale.
 */
export function uniformLuminance(grade: number): number {
  const hi = WHITE_Y + 0.05;
  const lo = BLACK_Y + 0.05;
  return hi * Math.pow(lo / hi, grade / 100) - 0.05;
}

/** Contrast guaranteed between any two grades `diff` apart on the uniform scale. */
export function uniformRatioForDiff(diff: number): number {
  return Math.pow(21, diff / 100);
}

export function targetLuminance(scale: ScaleConfig, grade: number): number {
  if (grade <= 0) return WHITE_Y;
  if (grade >= 100) return BLACK_Y;
  if (scale.luminanceMode === "custom") {
    const v = scale.customLuminance[String(grade)];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return uniformLuminance(grade);
}

/** Every grade the system reasons about, anchors included when enabled. */
export function systemGrades(scale: ScaleConfig): number[] {
  const g = [...scale.grades].sort((a, b) => a - b);
  return scale.includeAnchors ? [0, ...g, 100] : g;
}

export function requiredRatio(diff: number, rules: ContrastRule[]): number | null {
  let best: number | null = null;
  for (const r of rules) {
    if (diff >= r.minDiff && (best === null || r.ratio > best)) best = r.ratio;
  }
  return best;
}

export interface TargetViolation {
  a: number;
  b: number;
  diff: number;
  required: number;
  actual: number;
}

/** Checks the luminance targets themselves against the rules (before any hue is applied). */
export function checkTargets(scale: ScaleConfig): TargetViolation[] {
  const grades = systemGrades(scale);
  const out: TargetViolation[] = [];
  for (let i = 0; i < grades.length; i++) {
    for (let j = i + 1; j < grades.length; j++) {
      const diff = grades[j] - grades[i];
      const required = requiredRatio(diff, scale.rules);
      if (required === null) continue;
      const actual = contrastFromLuminance(
        targetLuminance(scale, grades[i]),
        targetLuminance(scale, grades[j]),
      );
      if (actual + 1e-9 < required) {
        out.push({ a: grades[i], b: grades[j], diff, required, actual });
      }
    }
  }
  return out;
}

/**
 * The luminance window a grade can occupy without breaking any rule, given the
 * current luminance of every other grade. This is the same idea as the min/max
 * luminance table in the USWDS documentation, computed live.
 */
export function feasibleRange(scale: ScaleConfig, grade: number): { min: number; max: number } {
  let min = 0;
  let max = 1;
  for (const other of systemGrades(scale)) {
    if (other === grade) continue;
    const required = requiredRatio(Math.abs(other - grade), scale.rules);
    if (required === null) continue;
    const y = targetLuminance(scale, other);
    if (other < grade) {
      max = Math.min(max, (y + 0.05) / required - 0.05);
    } else {
      min = Math.max(min, required * (y + 0.05) - 0.05);
    }
  }
  return { min: Math.max(0, min), max: Math.min(1, max) };
}

export interface RuleFeasibility {
  rule: ContrastRule;
  /** Best ratio any white-to-black scale can promise for this gap. */
  uniformRatio: number;
  feasible: boolean;
}

export function ruleFeasibility(rules: ContrastRule[]): RuleFeasibility[] {
  return rules.map((rule) => {
    const uniformRatio = uniformRatioForDiff(rule.minDiff);
    return { rule, uniformRatio, feasible: uniformRatio + 1e-9 >= rule.ratio };
  });
}

export type GradeParseResult = { ok: true; grades: number[] } | { ok: false; error: string };

export function parseGrades(text: string): GradeParseResult {
  const parts = text
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return { ok: false, error: "Enter at least three grades, e.g. 10, 30, 50, 70, 90." };
  const nums = parts.map(Number);
  if (nums.some((n) => !Number.isInteger(n))) {
    return { ok: false, error: "Grades must be whole numbers separated by commas." };
  }
  if (nums.some((n) => n <= 0 || n >= 100)) {
    return { ok: false, error: "Grades must be between 1 and 99. Grade 0 is white and 100 is black." };
  }
  const unique = Array.from(new Set(nums)).sort((a, b) => a - b);
  if (unique.length !== nums.length) return { ok: false, error: "Each grade can only appear once." };
  if (unique.length < MIN_GRADES) return { ok: false, error: `Use at least ${MIN_GRADES} grades.` };
  if (unique.length > MAX_GRADES) return { ok: false, error: `Use at most ${MAX_GRADES} grades.` };
  return { ok: true, grades: unique };
}
