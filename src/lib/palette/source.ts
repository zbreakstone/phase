import { type RGB, hexToLinear, luminanceOfLinear } from "../color/convert";
import { contrastFromLuminance } from "../color/contrast";
import type { Gamut } from "../color/gamut";
import { solveForLuminance } from "../color/solve";
import { SPACES, type SpaceId } from "../color/spaces";
import { baseCurveAt, positionFor, shortestHueDelta, type SourceAnchor } from "./curve";
import { targetLuminance } from "./scale";
import type { HueConfig, ScaleConfig } from "./types";

export interface SourceCoords {
  hex: string;
  luminance: number;
  /** Lightness, chroma and hue in the active colour space. */
  L: number;
  C: number;
  h: number;
}

export interface SourceAnalysis {
  original: SourceCoords;
  /** The grade the source landed on. */
  grade: number;
  /** True when the grade was picked automatically as the nearest luminance step. */
  auto: boolean;
  targetLuminance: number;
  /** Same hue and chroma as the original, lightness solved to the step's luminance target. */
  adjusted: SourceCoords & { clipped: boolean };
  /** Contrast ratio between the original and the adjusted colour (1 = identical luminance). */
  shift: number;
  /** The original already sits on the step (within rounding). */
  onStep: boolean;
  pinned: boolean;
}

export function coordsOfLinear(spaceId: SpaceId, hex: string, linear: RGB): SourceCoords {
  const p = SPACES[spaceId].fromLinear(linear);
  return { hex, luminance: luminanceOfLinear(linear), L: p.L, C: p.C, h: p.h };
}

export function coordsOf(spaceId: SpaceId, hex: string): SourceCoords {
  return coordsOfLinear(spaceId, hex, hexToLinear(hex));
}

/** Nearest step in contrast terms, so dark steps are not favoured over light ones. */
export function nearestGrade(luminance: number, scale: ScaleConfig): number {
  let best = scale.grades[0];
  let bestD = Infinity;
  for (const g of scale.grades) {
    const d = Math.abs(Math.log((luminance + 0.05) / (targetLuminance(scale, g) + 0.05)));
    if (d < bestD) {
      bestD = d;
      best = g;
    }
  }
  return best;
}

export function analyzeSource(spaceId: SpaceId, scale: ScaleConfig, hue: HueConfig, gamut: Gamut = "srgb"): SourceAnalysis | null {
  const source = hue.source;
  if (!source || scale.grades.length === 0) return null;
  const space = SPACES[spaceId];
  const original = coordsOf(spaceId, source.hex);
  const manual = source.grade !== null && scale.grades.includes(source.grade);
  const grade = manual ? (source.grade as number) : nearestGrade(original.luminance, scale);
  const target = targetLuminance(scale, grade);
  const hueAngle = original.C < 1e-4 ? hue.hueLight : original.h;
  const solved = solveForLuminance(space, target, hueAngle, original.C, gamut);
  const adjustedCoords = coordsOfLinear(spaceId, solved.hex, solved.linear);
  const shift = contrastFromLuminance(original.luminance, adjustedCoords.luminance);
  return {
    original,
    grade,
    auto: !manual,
    targetLuminance: target,
    adjusted: { ...adjustedCoords, clipped: solved.clipped },
    shift,
    onStep: shift < 1.01,
    pinned: source.pinned,
  };
}

/** How the hue curve must bend so it passes through the source at its grade. */
export function sourceAnchor(
  spaceId: SpaceId,
  scale: ScaleConfig,
  hue: HueConfig,
  analysis: SourceAnalysis | null,
): SourceAnchor | null {
  if (!analysis) return null;
  const sorted = [...scale.grades].sort((a, b) => a - b);
  const t = positionFor(analysis.grade, sorted);
  const base = baseCurveAt(SPACES[spaceId], hue, t);
  const achromatic = analysis.original.C < 1e-4;
  return {
    grade: analysis.grade,
    t,
    dh: achromatic ? 0 : shortestHueDelta(base.hue, analysis.original.h),
    dc: analysis.original.C - base.chroma,
  };
}

export function hueFamilyName(h: number, c: number, chromaMax: number): string {
  if (c < chromaMax * 0.04) return "Gray";
  const names: [number, string][] = [
    [10, "Pink"],
    [40, "Red"],
    [80, "Orange"],
    [115, "Yellow"],
    [170, "Green"],
    [215, "Teal"],
    [270, "Blue"],
    [325, "Violet"],
    [345, "Pink"],
    [361, "Red"],
  ];
  return names.find(([max]) => h < max)![1];
}
