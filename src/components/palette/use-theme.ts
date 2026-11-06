"use client";

import * as React from "react";
import { toast } from "sonner";
import { applyTheme, readTheme, saveTheme, subscribeTheme, type Theme } from "@/lib/theme";

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
    // Private mode: the choice applies now but won't survive a reload.
    if (!saveTheme(next)) toast.message("Couldn't remember your theme choice for next time.", { id: "theme-save" });
  }, []);

  return [theme, pickTheme];
}
