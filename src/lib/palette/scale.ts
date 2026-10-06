import type { ContrastRule, ScaleConfig } from "./types";
import { contrastFromLuminance } from "../color/contrast";

export const MIN_GRADES = 3;
export const MAX_GRADES = 16;

/** Steps run from 0 (white) to SCALE_MAX (black), named like Tailwind: 50, 100, 200 ... 900. */
export const SCALE_MAX = 1000;

export const GRADE_PRESETS: { id: string; label: string; grades: number[] }[] = [
  { id: "default", label: "50 to 900 (10 steps)", grades: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { id: "hundreds", label: "100 to 900 (9 steps)", grades: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { id: "fine", label: "Fine (13 steps)", grades: [50, 100, 150, 200, 300, 400, 500, 600, 700, 800, 850, 900, 950] },
];

export const RULE_PRESETS: { id: string; label: string; rules: Omit<ContrastRule, "id">[] }[] = [
  {
    id: "uswds",
    label: "400 / 500 / 700 (USWDS magic numbers)",
    rules: [
      { minDiff: 400, ratio: 3 },
      { minDiff: 500, ratio: 4.5 },
      { minDiff: 700, ratio: 7 },
    ],
  },
  {
    id: "relaxed",
    label: "Relaxed: 500 / 700 / 900",
    rules: [
      { minDiff: 500, ratio: 3 },
      { minDiff: 700, ratio: 4.5 },
      { minDiff: 900, ratio: 7 },
    ],
  },
  {
    id: "strict",
    label: "Strict: 400 / 500 / 600",
    rules: [
      { minDiff: 400, ratio: 3 },
      { minDiff: 500, ratio: 4.5 },
      { minDiff: 600, ratio: 6 },
    ],
  },
];

export const WHITE_Y = 1;
export const BLACK_Y = 0;

/**
 * Luminance for a grade when contrast is spread evenly from white (grade 0) to
 * black (grade 1000): (Y + 0.05) falls geometrically, so two grades N apart
 * always have a ratio of 21^(N/1000) no matter where they sit on the scale.
 */
export function uniformLuminance(grade: number): number {
  const hi = WHITE_Y + 0.05;
  const lo = BLACK_Y + 0.05;
  return hi * Math.pow(lo / hi, grade / SCALE_MAX) - 0.05;
}

/** Contrast guaranteed between any two grades `diff` apart on the uniform scale. */
export function uniformRatioForDiff(diff: number): number {
  return Math.pow(21, diff / SCALE_MAX);
}

/**
 * Katie Riley's final Envoy table ("Designing an accessible color scheme,
 * again", 2020), as contrast against white: [lightest allowed, darkest allowed].
 * It lightens the USWDS ranges from 600 down so dark shades stay vibrant.
 */
export const ENVOY_CONTRAST: Record<number, [number, number]> = {
  50: [1.07, 1.11],
  100: [1.18, 1.22],
  200: [1.5, 1.79],
  300: [2, 2.46],
  400: [3, 3.33],
  500: [4.5, 4.67],
  600: [5.5, 7],
  700: [8, 10],
  800: [11, 13],
  900: [15, 16],
};

const luminanceForWhiteContrast = (ratio: number) => (WHITE_Y + 0.05) / ratio - 0.05;

/** The same table as relative luminance windows. */
export const ENVOY_RANGES: Record<number, { min: number; max: number }> = Object.fromEntries(
  Object.entries(ENVOY_CONTRAST).map(([g, [light, dark]]) => [
    Number(g),
    { min: luminanceForWhiteContrast(dark), max: luminanceForWhiteContrast(light) },
  ]),
);

/** Contrast-space midpoint of a window, so the target sits evenly between its limits. */
function windowCentre({ min, max }: { min: number; max: number }): number {
  return Math.sqrt((min + 0.05) * (max + 0.05)) - 0.05;
}

/**
 * Envoy target for a step. Steps between the table's rows (150, 850 ...) are
 * interpolated in contrast space between their neighbours.
 */
export function envoyLuminance(grade: number): number {
  if (grade <= 0) return WHITE_Y;
  if (grade >= SCALE_MAX) return BLACK_Y;
  const exact = ENVOY_RANGES[grade];
  if (exact) return windowCentre(exact);
  const knots: [number, number][] = [
    [0, WHITE_Y],
    ...Object.entries(ENVOY_RANGES).map(([g, r]) => [Number(g), windowCentre(r)] as [number, number]),
    [SCALE_MAX, BLACK_Y],
  ];
  for (let i = 0; i < knots.length - 1; i++) {
    const [g0, y0] = knots[i];
    const [g1, y1] = knots[i + 1];
    if (grade > g0 && grade < g1) {
      const t = (grade - g0) / (g1 - g0);
      return (y0 + 0.05) * Math.pow((y1 + 0.05) / (y0 + 0.05), t) - 0.05;
    }
  }
  return uniformLuminance(grade);
}

export function targetLuminance(scale: ScaleConfig, grade: number): number {
  if (grade <= 0) return WHITE_Y;
  if (grade >= SCALE_MAX) return BLACK_Y;
  if (scale.luminanceMode === "custom") {
    const v = scale.customLuminance[String(grade)];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  if (scale.luminanceMode === "envoy") return envoyLuminance(grade);
  return uniformLuminance(grade);
}

/** Every grade the system reasons about. White (0) and black (1000) always anchor the ends. */
export function systemGrades(scale: ScaleConfig): number[] {
  const g = [...scale.grades].sort((a, b) => a - b);
  return [0, ...g, SCALE_MAX];
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
  if (parts.length === 0) return { ok: false, error: "Enter at least three steps, e.g. 100, 300, 500, 700, 900." };
  const nums = parts.map(Number);
  if (nums.some((n) => !Number.isInteger(n))) {
    return { ok: false, error: "Steps must be whole numbers separated by commas." };
  }
  if (nums.some((n) => n <= 0 || n >= SCALE_MAX)) {
    return { ok: false, error: "Steps must be between 1 and 999. 0 is white and 1000 is black." };
  }
  const unique = Array.from(new Set(nums)).sort((a, b) => a - b);
  if (unique.length !== nums.length) return { ok: false, error: "Each step can only appear once." };
  if (unique.length < MIN_GRADES) return { ok: false, error: `Use at least ${MIN_GRADES} steps.` };
  if (unique.length > MAX_GRADES) return { ok: false, error: `Use at most ${MAX_GRADES} steps.` };
  return { ok: true, grades: unique };
}
