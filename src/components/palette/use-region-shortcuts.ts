import * as React from "react";
import { isPopupOpen } from "./text-entry";

const TABBABLE = 'button, a[href], input, select, textarea, [role="combobox"], [role="slider"], [tabindex]';

/** The first thing in a region that Tab would land on, or the region itself when it only takes programmatic focus. */
export function entryPoint(region: HTMLElement) {
  const tabbable = Array.from(region.querySelectorAll<HTMLElement>(TABBABLE)).find(
    (el) => el.tabIndex >= 0 && !el.matches(":disabled") && el.getClientRects().length > 0,
  );
  return tabbable ?? (region.hasAttribute("tabindex") ? region : null);
}

/** Moves focus into the named region (see `data-region`), at the item Tab would reach first. */
export function focusRegion(name: string) {
  const region = document.querySelector<HTMLElement>(`[data-region="${name}"]`);
  (region ? entryPoint(region) : null)?.focus();
}

/**
 * F6 and Shift+F6 move between the page's major regions (anything marked `data-region`), the way desktop apps do, so
 * the keyboard can jump to a toolbar, the canvas or the sidebar and then drill in with the arrows or Tab. It works
 * from inside text fields too, since F6 isn't something you can type.
 */
export function useRegionShortcuts() {
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "F6" || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      if (isPopupOpen('[data-slot="dialog-content"], [data-slot="popover-content"], [data-slot="select-content"], [role="menu"]')) return;
      const regions = Array.from(document.querySelectorAll<HTMLElement>("[data-region]")).filter((r) => r.getClientRects().length > 0 && entryPoint(r));
      if (regions.length === 0) return;
      const here = regions.findIndex((r) => r.contains(document.activeElement));
      const step = e.shiftKey ? -1 : 1;
      const to = here < 0 ? (e.shiftKey ? regions.length - 1 : 0) : (here + step + regions.length) % regions.length;
      e.preventDefault();
      entryPoint(regions[to])?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
