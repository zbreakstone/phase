"use client";

import * as React from "react";
import { morphGenerated } from "@/lib/palette/morph";
import type { GeneratedHue } from "@/lib/palette/types";

const DURATION = 700;

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Follows `generated`, but when `arm()` was called just before it changes, glides from the old colors to the new ones
 * instead of jumping. Anything else (an edit, a slider) shows through immediately.
 */
export function useMorph(generated: GeneratedHue[]) {
  const armed = React.useRef(false);
  const [view, setView] = React.useState<{ from: GeneratedHue[]; to: GeneratedHue[]; t: number } | null>(null);
  const latest = React.useRef(generated);

  React.useLayoutEffect(() => {
    const from = latest.current;
    latest.current = generated;
    if (!armed.current || from === generated || from.length === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      armed.current = false;
      return;
    }
    armed.current = false;
    setView({ from, to: generated, t: 0 });
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / DURATION);
      setView(p >= 1 ? null : { from, to: generated, t: easeInOut(p) });
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [generated]);

  const arm = React.useCallback(() => {
    armed.current = true;
  }, []);
  const shown = React.useMemo(() => (view && view.to === generated ? morphGenerated(view.from, view.to, view.t) : generated), [view, generated]);
  return [shown, arm, view !== null && view.to === generated] as const;
}
