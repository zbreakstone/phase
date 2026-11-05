"use client";

import * as React from "react";
import { morphGenerated } from "@/lib/palette/morph";
import type { GeneratedHue } from "@/lib/palette/types";

const DURATION = 700;

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

interface View {
  from: GeneratedHue[];
  to: GeneratedHue[];
  t: number;
}

/**
 * Follows `generated`, but when `arm()` was called just before it changes, glides from the old colors to the new ones
 * instead of jumping. Anything else (an edit, a slider) shows through immediately. Also says whether a glide is under way.
 */
export function useMorph(generated: GeneratedHue[]) {
  const [armed, setArmed] = React.useState(false);
  const [prev, setPrev] = React.useState(generated);
  const [view, setView] = React.useState<View | null>(null);

  // Decided while rendering, so the very first frame of the new palette is already the start of the glide.
  if (prev !== generated) {
    setPrev(generated);
    setArmed(false);
    if (armed && prev.length > 0 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) setView({ from: prev, to: generated, t: 0 });
  }

  const to = view?.to;
  React.useEffect(() => {
    if (!to) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / DURATION);
      setView((v) => (v && v.to === to ? (p >= 1 ? null : { ...v, t: easeInOut(p) }) : v));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);

  const arm = React.useCallback(() => setArmed(true), []);
  const gliding = view !== null && view.to === generated;
  const shown = React.useMemo(() => (gliding && view ? morphGenerated(view.from, view.to, view.t) : generated), [gliding, view, generated]);
  return [shown, arm, gliding] as const;
}
