import { linearToHex, type RGB } from "../color/convert";
import type { GeneratedHue, Shade } from "./types";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Hue angles take the short way round the wheel. */
const lerpHue = (a: number, b: number, t: number) => {
  const d = ((((b - a) % 360) + 540) % 360) - 180;
  return (a + d * t + 360) % 360;
};

/** The shade at the same relative position in a scale of a different length. */
const pick = (shades: Shade[], j: number, count: number) =>
  shades[count <= 1 ? 0 : Math.round((j * (shades.length - 1)) / (count - 1))];

function morphShade(a: Shade | undefined, b: Shade, t: number, limitOf: (s: Shade) => number): Shade {
  if (!a) return b;
  const linear = a.linear.map((c, i) => lerp(c, b.linear[i], t)) as RGB;
  return {
    ...b,
    linear,
    limit: lerp(limitOf(a), limitOf(b), t),
    hex: linearToHex(linear),
    targetLuminance: lerp(a.targetLuminance, b.targetLuminance, t),
    luminance: lerp(a.luminance, b.luminance, t),
    requestedChroma: lerp(a.requestedChroma, b.requestedChroma, t),
    chroma: lerp(a.chroma, b.chroma, t),
    hue: lerpHue(a.hue, b.hue, t),
    oklch: { L: lerp(a.oklch.L, b.oklch.L, t), C: lerp(a.oklch.C, b.oklch.C, t), h: lerpHue(a.oklch.h, b.oklch.h, t) },
  };
}

/**
 * A palette partway between two others, `t` from 0 (all of `from`) to 1 (all of `to`). Colors and steps are paired by
 * position, so palettes with different numbers of colors or steps still blend: the extra ones start from their nearest
 * neighbor. The result has `to`'s names, grades and structure.
 */
export function morphGenerated(from: GeneratedHue[], to: GeneratedHue[], t: number, limitOf: (s: Shade) => number): GeneratedHue[] {
  if (t >= 1 || from.length === 0) return to;
  return to.map((g, i) => {
    const src = from[Math.min(i, from.length - 1)];
    return { ...g, shades: g.shades.map((s, j) => morphShade(pick(src.shades, j, g.shades.length), s, t, limitOf)) };
  });
}
