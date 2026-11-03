"use client";

import * as React from "react";

const FADE = 48;

/**
 * Tracks whether a scroller has more content above or below, and returns the mask that fades those
 * edges out. Attach `ref` to the scrolling element and spread `style` on it. The ref is a callback,
 * so it also works for elements that mount later, like a popup's list.
 */
export function useScrollFade() {
  const [el, attach] = React.useState<HTMLElement | null>(null);
  const [edges, setEdges] = React.useState({ top: false, bottom: false });

  React.useEffect(() => {
    if (!el) return;
    const measure = () => {
      const top = el.scrollTop > 1;
      const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
      setEdges((prev) => (prev.top === top && prev.bottom === bottom ? prev : { top, bottom }));
    };
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    // The scroller's own size rarely changes, but its content does when panels switch.
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    const mutations = new MutationObserver(measure);
    mutations.observe(el, { childList: true, subtree: true });
    return () => {
      el.removeEventListener("scroll", measure);
      observer.disconnect();
      mutations.disconnect();
    };
  }, [el]);

  const mask = `linear-gradient(to bottom, ${edges.top ? "transparent 0, #000" : "#000 0, #000"} ${FADE}px, #000 calc(100% - ${FADE}px), ${edges.bottom ? "transparent" : "#000"} 100%)`;
  return { attach, style: { maskImage: mask, WebkitMaskImage: mask } as React.CSSProperties };
}
