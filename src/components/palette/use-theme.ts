"use client";

import * as React from "react";
import { toast } from "sonner";
import { applyTheme, readTheme, subscribeTheme, THEME_EVENT, THEME_KEY, type Theme } from "@/lib/theme";

/** The app's light/dark choice: reads it, follows the system while it is "system", and remembers a pick. */
export function useTheme(): [Theme, (next: Theme) => void] {
  const theme = React.useSyncExternalStore(subscribeTheme, readTheme, () => "system" as Theme);

  React.useEffect(() => {
    if (theme !== "system") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => applyTheme("system");
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, [theme]);

  const pickTheme = React.useCallback((next: Theme) => {
    try {
      if (next === "system") window.localStorage.removeItem(THEME_KEY);
      else window.localStorage.setItem(THEME_KEY, next);
    } catch {
      // Private mode: the choice applies now but won't survive a reload.
      toast.message("Couldn't remember your theme choice for next time.", { id: "theme-save" });
    }
    applyTheme(next);
    window.dispatchEvent(new Event(THEME_EVENT));
  }, []);

  return [theme, pickTheme];
}
