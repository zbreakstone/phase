"use client";

import * as React from "react";

/**
 * The highlight behind a tab row's active tab, which glides to the next tab instead of jumping.
 * Render it inside a `relative` container whose tabs carry `data-active="true"` when chosen; pass something that
 * changes with the choice as `activeKey`. The first placement and any resize snap into place, only choices animate.
 * The tabs need `relative` so their labels sit above it.
 */
export function SlidingPill({ activeKey }: { activeKey: string | null }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  React.useLayoutEffect(() => {
    const pill = ref.current;
    const row = pill?.parentElement;
    if (!pill || !row) return;
    const place = (animate: boolean) => {
      const tab = row.querySelector<HTMLElement>('[data-active="true"]');
      if (!tab) {
        pill.style.opacity = "0";
        return;
      }
      pill.style.transition = animate ? "" : "none";
      pill.style.opacity = "1";
      pill.style.width = `${tab.offsetWidth}px`;
      pill.style.height = `${tab.offsetHeight}px`;
      pill.style.transform = `translate(${tab.offsetLeft}px, ${tab.offsetTop}px)`;
    };
    place(pill.dataset.placed === "1");
    pill.dataset.placed = "1";
    // An observer reports once as soon as it starts watching; that isn't a resize, so it mustn't cancel the glide.
    let started = false;
    const observer = new ResizeObserver(() => {
      if (started) place(false);
      started = true;
    });
    observer.observe(row);
    return () => observer.disconnect();
  }, [activeKey]);
  return (
    <span
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute top-0 left-0 rounded-md bg-muted opacity-0 transition-[transform,width] duration-200 ease-[cubic-bezier(0.645,0.045,0.355,1)] motion-reduce:transition-none"
    />
  );
}
