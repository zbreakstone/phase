import { hexToLinear, normHue, polarToRect, rectToPolar } from "../color/convert";
import { relativeLuminance } from "../color/contrast";
import { solveForLuminance } from "../color/solve";
import { SPACES, type SpaceDef, type SpaceId } from "../color/spaces";
import { targetLuminance } from "./scale";
import type { GeneratedHue, HueConfig, HueDirection, ScaleConfig, Shade } from "./types";

export function hueDelta(from: number, to: number, direction: HueDirection): number {
  const raw = normHue(to) - normHue(from);
  if (direction === "increasing") return ((raw % 360) + 360) % 360;
  if (direction === "decreasing") return -((((-raw) % 360) + 360) % 360);
  let d = ((raw % 360) + 360) % 360;
  if (d > 180) d -= 360;
  return d;
}

export function easeT(t: number, bias: number): number {
  return Math.pow(t, Math.pow(3, bias));
}

export function chromaCurve(h: HueConfig, t: number): number {
  const { chromaLight: a, chromaMid: b, chromaDark: c } = h;
  const v = 2 * (t - 0.5) * (t - 1) * a - 4 * t * (t - 1) * b + 2 * t * (t - 0.5) * c;
  return Math.max(0, v);
}

export interface CurvePoint {
  hue: number;
  chroma: number;
}

/** Requested hue and chroma at position t (0 = lightest shade, 1 = darkest). */
export function curveAt(space: SpaceDef, h: HueConfig, t: number): CurvePoint {
  const e = easeT(t, h.hueBias);
  const chroma = chromaCurve(h, t);
  if (space.interpolation === "polar") {
    const hue = normHue(h.hueLight + hueDelta(h.hueLight, h.hueDark, h.hueDirection) * e);
    return { hue, chroma };
  }
  const [la, lb] = polarToRect(h.chromaLight, h.hueLight);
  const [da, db] = polarToRect(h.chromaDark, h.hueDark);
  const a = la + (da - la) * e;
  const b = lb + (db - lb) * e;
  const [mag, hue] = rectToPolar(a, b);
  const linearChroma = h.chromaLight + (h.chromaDark - h.chromaLight) * t;
  const scale = linearChroma > 1e-9 ? chroma / linearChroma : 1;
  const fallbackHue = h.hueLight;
  return { hue: mag < 1e-9 ? fallbackHue : hue, chroma: mag * scale };
}

export function positionFor(grade: number, grades: number[]): number {
  const min = Math.min(...grades);
  const max = Math.max(...grades);
  return max === min ? 0 : (grade - min) / (max - min);
}

export function generateHue(spaceId: SpaceId, scale: ScaleConfig, hue: HueConfig): GeneratedHue {
  const space = SPACES[spaceId];
  const sorted = [...scale.grades].sort((a, b) => a - b);
  const shades: Shade[] = [];

  if (scale.includeAnchors) shades.push(anchorShade(0, "#ffffff", scale));

  for (const grade of sorted) {
    const t = positionFor(grade, sorted);
    const want = curveAt(space, hue, t);
    const targetY = targetLuminance(scale, grade);
    const solved = solveForLuminance(space, targetY, want.hue, want.chroma);
    shades.push({
      grade,
      hex: solved.hex,
      targetLuminance: targetY,
      luminance: relativeLuminance(solved.hex),
      anchor: false,
      requestedChroma: want.chroma,
      chroma: solved.chroma,
      hue: want.hue,
      clipped: solved.clipped,
    });
  }

  if (scale.includeAnchors) shades.push(anchorShade(100, "#000000", scale));
  return { hue, shades };
}

function anchorShade(grade: number, hex: string, scale: ScaleConfig): Shade {
  return {
    grade,
    hex,
    targetLuminance: targetLuminance(scale, grade),
    luminance: relativeLuminance(hex),
    anchor: true,
    requestedChroma: 0,
    chroma: 0,
    hue: 0,
    clipped: false,
  };
}

export function generatePalette(spaceId: SpaceId, scale: ScaleConfig, hues: HueConfig[]): GeneratedHue[] {
  return hues.map((h) => generateHue(spaceId, scale, h));
}

/** A copy of the hue with no shift: same chroma curve, but one hue throughout. */
export function withFixedHue(h: HueConfig): HueConfig {
  return { ...h, hueDark: h.hueLight, hueBias: 0 };
}

/**
 * Re-expresses a hue's endpoints in another colour space so that the two
 * scales start from the same colours and only differ in how they travel between them.
 */
export function convertHue(
  hue: HueConfig,
  scale: ScaleConfig,
  from: SpaceId,
  to: SpaceId,
): HueConfig {
  if (from === to) return hue;
  const sorted = [...scale.grades].sort((a, b) => a - b);
  const sample = (t: number) => {
    const grade = sorted.length ? sorted[0] + (sorted[sorted.length - 1] - sorted[0]) * t : 50;
    const want = curveAt(SPACES[from], hue, t);
    const solved = solveForLuminance(SPACES[from], targetLuminance(scale, grade), want.hue, want.chroma);
    const p = SPACES[to].fromLinear(hexToLinear(solved.hex));
    return { hue: p.h, chroma: p.C, achromatic: p.C < 1e-4 };
  };
  const light = sample(0);
  const mid = sample(0.5);
  const dark = sample(1);
  return {
    ...hue,
    hueLight: Math.round((light.achromatic ? hue.hueLight : light.hue) * 10) / 10,
    hueDark: Math.round((dark.achromatic ? hue.hueDark : dark.hue) * 10) / 10,
    hueDirection: "shortest",
    chromaLight: roundChroma(light.chroma, to),
    chromaMid: roundChroma(mid.chroma, to),
    chromaDark: roundChroma(dark.chroma, to),
  };
}

function roundChroma(c: number, space: SpaceId): number {
  const { step, max, decimals } = SPACES[space].chroma;
  return Number(Math.min(max, Math.round(c / step) * step).toFixed(decimals + 1));
}
