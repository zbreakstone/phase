import * as React from "react";
import { isPopupOpen, isTextEntry } from "./text-entry";

/**
 * Runs `run` when the key is pressed, unless you're typing in a field or a dialog, menu or popover is open. Plain
 * keys ignore Shift and the command keys; with `shift` the key needs Shift and nothing else. With `command` the key
 * needs ⌘ (or Ctrl) and nothing else, and it still works while typing in a field, since a command chord can't be typed
 * by accident. The physical key is used, so it works on any keyboard layout.
 */
export function useKeyShortcut(code: string, run: () => void, { shift = false, command = false, enabled = true }: { shift?: boolean; command?: boolean; enabled?: boolean } = {}) {
  const latest = React.useRef(run);
  React.useEffect(() => {
    latest.current = run;
  });
  React.useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || e.repeat || e.altKey || e.shiftKey !== shift || e.code !== code) return;
      if (command ? !(e.metaKey || e.ctrlKey) : e.metaKey || e.ctrlKey) return;
      if (!command && isTextEntry(e.target)) return;
      if (isPopupOpen('[data-slot="dialog-content"], [data-slot="popover-content"], [data-slot="select-content"], [role="menu"]')) return;
      e.preventDefault();
      latest.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [code, shift, command, enabled]);
}
