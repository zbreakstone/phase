"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const FADE = 28;

/**
 * A scrolling panel whose top and bottom edges fade out while there is more content that way. The
 * fade is a mask on the inner scroller, so the outer element can keep its own background and shadow.
 */
export function ScrollFade({ className, innerClassName, children }: { className?: string; innerClassName?: string; children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [edges, setEdges] = React.useState({ top: false, bottom: false });

  React.useEffect(() => {
    const el = ref.current;
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
  }, []);

  const mask = `linear-gradient(to bottom, ${edges.top ? "transparent 0, #000" : "#000 0, #000"} ${FADE}px, #000 calc(100% - ${FADE}px), ${edges.bottom ? "transparent" : "#000"} 100%)`;

  return (
    <div className={cn("min-h-0 overflow-hidden", className)}>
      <div ref={ref} className="h-full overflow-y-auto" style={{ maskImage: mask, WebkitMaskImage: mask }}>
        <div className={innerClassName}>{children}</div>
      </div>
    </div>
  );
}
