export type Theme = "system" | "light" | "dark";

export const THEME_KEY = "phase:theme";

export const readTheme = (): Theme => {
  try {
    const v = window.localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
};

/** Puts the chosen theme on <html>. "system" follows the OS and is re-applied when the OS changes. */
export const applyTheme = (theme: Theme) => {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
};

/** Runs before first paint so a light-mode visitor never sees a dark flash. */
export const THEME_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light"}catch(e){document.documentElement.classList.add("dark")}`;

export const THEME_EVENT = "phase:theme-change";

export const subscribeTheme = (onChange: () => void) => {
  window.addEventListener(THEME_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
};
