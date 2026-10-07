import { type RGB, hexToLinear, luminanceOfLinear } from "../color/convert";
import type { Gamut } from "../color/gamut";
import { solveForLuminance } from "../color/solve";
import { SPACES, type SpaceId } from "../color/spaces";
import { curveAt, positionFor } from "./curve";
import { SCALE_MAX, targetLuminance } from "./scale";
import { analyzeSource, sourceAnchor } from "./source";
import type { GeneratedHue, HueConfig, ScaleConfig, Shade } from "./types";

export { chromaCurve, curveAt, easeT, hueDelta, positionFor } from "./curve";

export function generateHue(spaceId: SpaceId, scale: ScaleConfig, hue: HueConfig, gamut: Gamut = "srgb"): GeneratedHue {
  const space = SPACES[spaceId];
  const sorted = [...scale.grades].sort((a, b) => a - b);
  const shades: Shade[] = [];

  const source = analyzeSource(spaceId, scale, hue, gamut);
  const anchor = sourceAnchor(spaceId, scale, hue, source);

  shades.push(anchorShade(0, "#ffffff", scale));

  for (const grade of sorted) {
    const t = positionFor(grade, sorted);
    const want = curveAt(space, hue, t, anchor);
    const targetY = targetLuminance(scale, grade);
    const solved = solveForLuminance(space, targetY, want.hue, want.chroma, gamut);
    const isSource = source?.grade === grade;
    const pinned = isSource && source?.pinned === true;
    const hex = pinned ? source!.original.hex : solved.hex;
    const linear = pinned ? hexToLinear(hex) : solved.linear;
    shades.push({
      grade,
      hex,
      linear,
      targetLuminance: targetY,
      luminance: luminanceOfLinear(linear),
      anchor: false,
      requestedChroma: want.chroma,
      chroma: pinned ? source!.original.C : solved.chroma,
      hue: want.hue,
      clipped: pinned ? false : solved.clipped,
      oklch: oklchOf(linear),
      isSource,
      pinned,
    });
  }

  shades.push(anchorShade(SCALE_MAX, "#000000", scale));
  return { hue, shades, source, anchor };
}

function oklchOf(linear: RGB) {
  const { L, C, h } = SPACES.oklch.fromLinear(linear);
  return { L, C, h: C < 1e-4 ? 0 : h };
}

function anchorShade(grade: number, hex: string, scale: ScaleConfig): Shade {
  const linear = hexToLinear(hex);
  return {
    grade,
    hex,
    linear,
    targetLuminance: targetLuminance(scale, grade),
    luminance: luminanceOfLinear(linear),
    anchor: true,
    requestedChroma: 0,
    chroma: 0,
    hue: 0,
    clipped: false,
    oklch: oklchOf(linear),
  };
}

export function generatePalette(spaceId: SpaceId, scale: ScaleConfig, hues: HueConfig[], gamut: Gamut = "srgb"): GeneratedHue[] {
  return hues.map((h) => generateHue(spaceId, scale, h, gamut));
}

/** A copy of the hue with no shift: same chroma curve, but one hue throughout. */
export function withFixedHue(h: HueConfig): HueConfig {
  return { ...h, hueDark: h.hueLight, hueBias: 0, source: null };
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
  gamut: Gamut = "srgb",
): HueConfig {
  if (from === to) return hue;
  const sorted = [...scale.grades].sort((a, b) => a - b);
  const g = generateHue(from, scale, hue, gamut);
  const anchor = g.anchor;
  const sample = (t: number) => {
    const grade = sorted.length ? sorted[0] + (sorted[sorted.length - 1] - sorted[0]) * t : 50;
    const want = curveAt(SPACES[from], hue, t, anchor);
    const solved = solveForLuminance(SPACES[from], targetLuminance(scale, grade), want.hue, want.chroma, gamut);
    const p = SPACES[to].fromLinear(solved.linear);
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
