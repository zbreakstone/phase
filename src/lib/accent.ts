"use client";

import * as React from "react";
import { toast } from "sonner";

/**
 * A pick on the color field: OKLCH hue (0-360) and chroma (0-0.3), or pure white/black via `k` (the hue is
 * kept so the dot stays in its column). Lightness comes from the hue, not the pick, so every swatch is vivid.
 */
export type Color = { h: number; c: number; k?: "white" | "black" };

/** A person's theme: the fill color, plus an optional color for text and icons on it. */
export type Accent = Color & { fg?: Color };

/** True when two picks would be (nearly) the same color, which would make the label vanish into the fill. */
export const sameColor = (a: Color, b: Color) => {
  if (a.k || b.k) return a.k === b.k;
  const dh = Math.min(Math.abs(a.h - b.h), 360 - Math.abs(a.h - b.h));
  return dh < 10 && Math.abs(a.c - b.c) < 0.04;
};

/**
 * Lightness that keeps a hue vivid rather than muddy: yellows and oranges need to be light (a dark yellow is
 * brown), blues and purples can sit darker. Used for the light theme and the picker's swatches.
 */
export const accentL = (h: number) => {
  const t = (1 + Math.cos(((h - 105) * Math.PI) / 180)) / 2;
  return +(0.54 + 0.26 * t ** 1.5).toFixed(3);
};

export const colorL = (c: Color) =>
  c.k ? (c.k === "white" ? 1 : 0) : accentL(c.h);
export const colorCss = (c: Color) =>
  c.k
    ? c.k === "white"
      ? "oklch(1 0 0)"
      : "oklch(0 0 0)"
    : `oklch(${accentL(c.h)} ${c.c} ${c.h})`;

/** The color a person sees for their accent. */
export const accentColor = (a: Accent) => colorCss(a);

const lightOn = 0.97;
const darkOn = 0.28;

/** Whether a light or dark label reads better on this background (OKLab L cubed ~ luminance). */
const labelL = (bgL: number) => {
  const bg = bgL ** 3 + 0.05;
  return bg / (darkOn ** 3 + 0.05) > (lightOn ** 3 + 0.05) / bg
    ? darkOn
    : lightOn;
};

/**
 * The label color on the accent. With a foreground dot it is exactly that color; without one it is a plain
 * light or dark neutral chosen for contrast.
 */
export const accentOn = (a: Accent) => {
  if (a.fg) return colorCss(a.fg);
  return labelL(colorL(a)) === lightOn
    ? "white"
    : `oklch(${darkOn} 0.03 ${a.h})`;
};

/** Approximate contrast between the accent and its label (OKLab L cubed stands in for luminance). */
export const accentContrast = (a: Accent) => {
  const bg = colorL(a) ** 3;
  const fg = (a.fg ? colorL(a.fg) : labelL(colorL(a))) ** 3;
  const [hi, lo] = bg > fg ? [bg, fg] : [fg, bg];
  return (hi + 0.05) / (lo + 0.05);
};

const parseColor = (p: unknown): Color | null => {
  const a = p as Color | null;
  if (!a || !Number.isFinite(a.h) || !Number.isFinite(a.c)) return null;
  return a.k === "white" || a.k === "black"
    ? { h: a.h, c: a.c, k: a.k }
    : { h: a.h, c: a.c };
};

export const parseAccent = (p: unknown): Accent | null => {
  const bg = parseColor(p);
  if (!bg) return null;
  const fg = parseColor((p as Accent).fg);
  return fg ? { ...bg, fg } : bg;
};

const KEY = "phase:accent";
const listeners = new Set<() => void>();
let cached: { raw: string | null; value: Accent | null } = {
  raw: null,
  value: null,
};

const read = (): Accent | null => {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(KEY);
  if (raw === cached.raw) return cached.value;
  let value: Accent | null = null;
  try {
    value = parseAccent(JSON.parse(raw ?? "null"));
  } catch {}
  cached = { raw, value };
  return value;
};

export const getAccent = read;

export const setAccent = (next: Accent | null) => {
  try {
    if (next) window.localStorage.setItem(KEY, JSON.stringify(next));
    else window.localStorage.removeItem(KEY);
  } catch {
    toast.error("Couldn't save your theme color on this device.", { id: "accent-local" });
  }
  listeners.forEach((l) => l());
};

export const subscribeAccent = (cb: () => void) => {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
};

/** The saved accent, or null for the default theme. */
export const useAccent = () =>
  React.useSyncExternalStore(subscribeAccent, read, () => null);

/** Mirror the accent onto <html> so CSS can retheme primary actions. Mount once. */
export const useApplyAccent = () => {
  const accent = useAccent();
  React.useEffect(() => {
    const root = document.documentElement;
    if (accent) {
      root.style.setProperty("--accent-h", String(accent.h));
      root.style.setProperty("--accent-c", String(accent.k ? 0 : accent.c));
      root.style.setProperty("--accent-l", String(colorL(accent)));
      root.style.setProperty("--accent-on", accentOn(accent));
      root.setAttribute("data-accent", "");
    } else {
      root.style.removeProperty("--accent-h");
      root.style.removeProperty("--accent-c");
      root.style.removeProperty("--accent-l");
      root.style.removeProperty("--accent-on");
      root.removeAttribute("data-accent");
    }
  }, [accent]);
};
