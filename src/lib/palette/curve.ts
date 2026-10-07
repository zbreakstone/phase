import { normHue, polarToRect, rectToPolar } from "../color/convert";
import type { SpaceDef } from "../color/spaces";
import type { HueConfig, HueDirection } from "./types";

export function hueDelta(from: number, to: number, direction: HueDirection): number {
  const raw = normHue(to) - normHue(from);
  if (direction === "increasing") return ((raw % 360) + 360) % 360;
  if (direction === "decreasing") return -((((-raw) % 360) + 360) % 360);
  let d = ((raw % 360) + 360) % 360;
  if (d > 180) d -= 360;
  return d;
}

export function shortestHueDelta(from: number, to: number): number {
  return hueDelta(from, to, "shortest");
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

/**
 * A source colour bends the curve so it passes exactly through the source's hue
 * and chroma at the grade it landed on, fading back to the endpoints either side.
 */
export interface SourceAnchor {
  grade: number;
  t: number;
  /** Hue offset applied at the anchor (degrees). */
  dh: number;
  /** Chroma offset applied at the anchor. */
  dc: number;
}

export function anchorWeight(anchor: SourceAnchor, t: number): number {
  const { t: tg } = anchor;
  if (tg <= 0) return 1 - t;
  if (tg >= 1) return t;
  return t <= tg ? t / tg : (1 - t) / (1 - tg);
}

/** The curve from the hue's own endpoints, ignoring any source colour. */
export function baseCurveAt(space: SpaceDef, h: HueConfig, t: number): CurvePoint {
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
  return { hue: mag < 1e-9 ? h.hueLight : hue, chroma: mag * scale };
}

/** Requested hue and chroma at position t (0 = lightest shade, 1 = darkest). */
export function curveAt(space: SpaceDef, h: HueConfig, t: number, anchor?: SourceAnchor | null): CurvePoint {
  const base = baseCurveAt(space, h, t);
  if (!anchor) return base;
  const w = anchorWeight(anchor, t);
  return {
    hue: normHue(base.hue + anchor.dh * w),
    chroma: Math.max(0, base.chroma + anchor.dc * w),
  };
}

export function positionFor(grade: number, grades: number[]): number {
  const min = Math.min(...grades);
  const max = Math.max(...grades);
  return max === min ? 0 : (grade - min) / (max - min);
}
