import * as React from "react";
import { isTextEntry } from "./text-entry";

const DEFAULT_ITEMS = 'button, [role="combobox"]';

/**
 * Turns a container into one tab stop with arrow-key movement inside it (a "roving tabindex"), so a long row or list
 * of controls costs one Tab instead of one per item. Tab enters at the current item (the one focused last, else the
 * one marked `data-current="true"`, else the first) and leaves past the whole group.
 *
 * It works on the DOM rather than through props so it can wrap any triggers, tooltips and menus without them
 * knowing. Items that set their own tabindex (toggle groups) are corrected back, and text fields are left alone.
 * With `singleTabStop: false` only the arrow keys are added and every item stays in the Tab order (an accordion's
 * headers, where Tab should still step header, section, next header). Modified arrows (Alt+↑ to reorder, for example) pass through untouched.
 */
export function useRovingFocus<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
  { orientation = "horizontal", items = DEFAULT_ITEMS, enabled = true, singleTabStop = true }: { orientation?: "horizontal" | "vertical"; items?: string; enabled?: boolean; singleTabStop?: boolean } = {},
) {
  React.useEffect(() => {
    const root = ref.current;
    if (!root || !enabled) return;
    let active: HTMLElement | null = null;

    const list = () =>
      Array.from(root.querySelectorAll<HTMLElement>(items)).filter(
        (el) => !el.matches(":disabled") && el.getAttribute("aria-disabled") !== "true",
      );
    const sync = () => {
      const all = list();
      const focused = all.find((el) => el === document.activeElement);
      active = focused ?? (active && all.includes(active) ? active : null) ?? all.find((el) => el.dataset.current === "true") ?? all[0] ?? null;
      if (!singleTabStop) return;
      for (const el of all) {
        const want = el === active ? 0 : -1;
        if (el.tabIndex !== want) el.tabIndex = want;
      }
    };

    const onFocusIn = (e: FocusEvent) => {
      if (e.target instanceof HTMLElement && list().includes(e.target)) {
        active = e.target;
        sync();
      }
    };
    const [prev, next] = orientation === "vertical" ? ["ArrowUp", "ArrowDown"] : ["ArrowLeft", "ArrowRight"];
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.isComposing) return;
      if (![prev, next, "Home", "End"].includes(e.key) || isTextEntry(e.target)) return;
      const all = list();
      const at = all.findIndex((el) => el === e.target);
      if (at < 0) return;
      const to = e.key === prev ? at - 1 : e.key === next ? at + 1 : e.key === "Home" ? 0 : all.length - 1;
      const target = all[to];
      // Handled here, so a group that has its own arrow keys (a toggle group) never also moves focus.
      e.preventDefault();
      e.stopPropagation();
      if (target) target.focus();
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled", "aria-disabled", "data-current", "tabindex"] });
    root.addEventListener("focusin", onFocusIn);
    root.addEventListener("keydown", onKeyDown);
    return () => {
      observer.disconnect();
      root.removeEventListener("focusin", onFocusIn);
      root.removeEventListener("keydown", onKeyDown);
    };
  }, [ref, orientation, items, enabled, singleTabStop]);
}
