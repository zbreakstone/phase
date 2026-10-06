import { type RGB, linearToHex, luminanceOfLinear } from "./convert";
import type { SpaceDef } from "./spaces";

const GAMUT_EPS = 1e-6;

export function inGamut(rgb: RGB): boolean {
  return rgb.every((c) => c >= -GAMUT_EPS && c <= 1 + GAMUT_EPS);
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const clampRgb = (rgb: RGB): RGB => [clamp01(rgb[0]), clamp01(rgb[1]), clamp01(rgb[2])];

export interface SolvedColor {
  hex: string;
  /** Lightness coordinate in the chosen space that hit the target. */
  L: number;
  /** Chroma actually used, in the space's chroma units. */
  chroma: number;
  /** Chroma that was asked for. */
  requestedChroma: number;
  hue: number;
  /** True when the requested chroma did not fit inside sRGB and was reduced. */
  clipped: boolean;
}

/**
 * Finds the colour with the requested hue whose relative luminance equals `targetY`.
 * Chroma is reduced (never lightness or hue) when the request falls outside sRGB,
 * so the luminance target is always honoured.
 */
export function solveForLuminance(
  space: SpaceDef,
  targetY: number,
  hue: number,
  chroma: number,
): SolvedColor {
  const C = Math.max(0, chroma);

  const mapped = (L: number): { rgb: RGB; k: number } => {
    const full = space.toLinear(L, C, hue);
    if (inGamut(full)) return { rgb: full, k: 1 };
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 22; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(space.toLinear(L, C * mid, hue))) lo = mid;
      else hi = mid;
    }
    return { rgb: space.toLinear(L, C * lo, hue), k: lo };
  };

  const yOf = (L: number) => luminanceOfLinear(clampRgb(mapped(L).rgb));

  let lo = 0;
  let hi = space.lightnessMax;
  if (targetY <= 0) hi = 0;
  else if (targetY >= 1) lo = hi;
  for (let i = 0; i < 48 && hi - lo > 1e-9; i++) {
    const mid = (lo + hi) / 2;
    const y = yOf(mid);
    if (Math.abs(y - targetY) < 1e-9) {
      lo = hi = mid;
      break;
    }
    if (y < targetY) lo = mid;
    else hi = mid;
  }
  const L = (lo + hi) / 2;
  const { rgb, k } = mapped(L);
  const used = C * k;
  return {
    hex: linearToHex(rgb),
    L,
    chroma: used,
    requestedChroma: C,
    hue,
    clipped: C > 0 && k < 0.995,
  };
}

/** Largest chroma available inside sRGB for `hue` at luminance `targetY`. */
export function maxChromaAt(space: SpaceDef, targetY: number, hue: number): number {
  const cap = space.chroma.max * 1.5;
  return solveForLuminance(space, targetY, hue, cap).chroma;
}

/** Builds a displayable colour from coordinates in a space, shrinking chroma (never lightness) if it falls outside sRGB. */
export function colorFromCoords(
  space: SpaceDef,
  L: number,
  C: number,
  h: number,
): { hex: string; clipped: boolean } {
  const Lc = Math.min(space.lightnessMax, Math.max(0, L));
  const full = space.toLinear(Lc, Math.max(0, C), h);
  if (inGamut(full)) return { hex: linearToHex(full), clipped: false };
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(space.toLinear(Lc, C * mid, h))) lo = mid;
    else hi = mid;
  }
  return { hex: linearToHex(space.toLinear(Lc, C * lo, h)), clipped: true };
}
