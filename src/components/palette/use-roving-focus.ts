import * as React from "react";
import { isTextEntry } from "./text-entry";

const DEFAULT_ITEMS = 'button, [role="combobox"]';

/**
 * Turns a container into one tab stop with arrow-key movement inside it (a "roving tabindex"), so a long row or list
 * of controls costs one Tab instead of one per item. Tab enters at the current item (the one focused last, else the
 * one marked `data-current="true"`, else the first) and leaves past the whole group.
 *
 * It works on the DOM rather than through props so it can wrap any triggers, tooltips and menus without them
 * knowing. Items that manage their own arrow keys (toggle groups) are left alone, and so are text fields.
 * Modified arrows (Alt+↑ to reorder, for example) pass through untouched.
 */
export function useRovingFocus<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
  { orientation = "horizontal", items = DEFAULT_ITEMS, enabled = true }: { orientation?: "horizontal" | "vertical"; items?: string; enabled?: boolean } = {},
) {
  React.useEffect(() => {
    const root = ref.current;
    if (!root || !enabled) return;
    let active: HTMLElement | null = null;

    const list = () =>
      Array.from(root.querySelectorAll<HTMLElement>(items)).filter(
        (el) => !el.matches(":disabled") && el.getAttribute("aria-disabled") !== "true" && !el.closest('[data-slot="toggle-group"]'),
      );
    const sync = () => {
      const all = list();
      const focused = all.find((el) => el === document.activeElement);
      active = focused ?? (active && all.includes(active) ? active : null) ?? all.find((el) => el.dataset.current === "true") ?? all[0] ?? null;
      for (const el of all) el.tabIndex = el === active ? 0 : -1;
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
      e.preventDefault();
      if (target) target.focus();
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled", "aria-disabled", "data-current"] });
    root.addEventListener("focusin", onFocusIn);
    root.addEventListener("keydown", onKeyDown);
    return () => {
      observer.disconnect();
      root.removeEventListener("focusin", onFocusIn);
      root.removeEventListener("keydown", onKeyDown);
    };
  }, [ref, orientation, items, enabled]);
}
