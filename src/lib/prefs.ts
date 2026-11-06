"use client";

import * as React from "react";
import { toast } from "sonner";
import type { Session } from "@supabase/supabase-js";
import { getCloud } from "@/lib/cloud/client";
import { getAccent, parseAccent, setAccent, subscribeAccent, type Accent } from "@/lib/accent";
import { readTheme, saveTheme, subscribeTheme, type Theme } from "@/lib/theme";
import type { Against, Metric, Overlay } from "@/lib/palette/overlay";
import { VISIONS } from "@/lib/color/vision";

/** How a person likes to look at their palettes. Kept per person, never with the palette, so a shared link opens plainly. */
export interface ViewPrefs {
  mode?: "smooth" | "cells";
  grain?: boolean;
  /** Whether each color's white and black ends are drawn on the canvas. */
  ends?: boolean;
  overlay?: Overlay;
}

/** Everything remembered for a person: the view, plus the app's theme and accent color. Saved as one blob on the account. */
export interface Prefs extends ViewPrefs {
  theme?: Theme;
  accent?: Accent | null;
}

const METRICS: Metric[] = ["contrast", "apca", "luminance", "off"];
const AGAINST: Against[] = ["white", "black", "selected"];

const parseOverlay = (v: unknown): Overlay | undefined => {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  if (!METRICS.includes(o.metric as Metric) || !AGAINST.includes(o.against as Against)) return undefined;
  if (typeof o.grayscale !== "boolean" || !VISIONS.some((x) => x.id === o.vision)) return undefined;
  return { metric: o.metric as Metric, against: o.against as Against, grayscale: o.grayscale, vision: o.vision as Overlay["vision"] };
};

const parseView = (v: unknown): ViewPrefs => {
  if (!v || typeof v !== "object") return {};
  const o = v as Record<string, unknown>;
  const out: ViewPrefs = {};
  if (o.mode === "smooth" || o.mode === "cells") out.mode = o.mode;
  if (typeof o.grain === "boolean") out.grain = o.grain;
  if (typeof o.ends === "boolean") out.ends = o.ends;
  const overlay = parseOverlay(o.overlay);
  if (overlay) out.overlay = overlay;
  return out;
};

/** Reads a saved blob, keeping only the fields that make sense, so an old or hand-edited one can't break the app. */
export const parsePrefs = (v: unknown): Prefs | null => {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const out: Prefs = parseView(o);
  if (o.theme === "system" || o.theme === "light" || o.theme === "dark") out.theme = o.theme;
  if ("accent" in o) out.accent = parseAccent(o.accent);
  return out;
};

// The view preferences on this device. Theme and accent keep their own keys, which the first paint reads.
const VIEW_KEY = "phase:view";
const listeners = new Set<() => void>();
let cached: { raw: string | null; value: ViewPrefs } = { raw: null, value: {} };

const readView = (): ViewPrefs => {
  if (typeof window === "undefined") return cached.value;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(VIEW_KEY);
  } catch {}
  if (raw === cached.raw) return cached.value;
  let value: ViewPrefs = {};
  try {
    value = parseView(JSON.parse(raw ?? "null"));
  } catch {}
  cached = { raw, value };
  return value;
};

const writeView = (next: ViewPrefs) => {
  try {
    window.localStorage.setItem(VIEW_KEY, JSON.stringify(next));
  } catch {
    // Private mode: the choice holds for now but won't survive a reload.
    cached = { raw: JSON.stringify(next), value: next };
  }
  listeners.forEach((l) => l());
};

const subscribeView = (cb: () => void) => {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
};

const EMPTY: ViewPrefs = {};

/**
 * One view preference. When `remember` is off (someone viewing a shared link), it starts from the default and
 * changes stay on the page, so neither the owner's choices nor the viewer's leak across.
 */
export function useViewPref<K extends keyof ViewPrefs>(key: K, fallback: NonNullable<ViewPrefs[K]>, remember: boolean): [NonNullable<ViewPrefs[K]>, (v: NonNullable<ViewPrefs[K]>) => void] {
  const saved = React.useSyncExternalStore(subscribeView, readView, () => EMPTY);
  const [local, setLocal] = React.useState(fallback);
  const set = React.useCallback((v: NonNullable<ViewPrefs[K]>) => writeView({ ...readView(), [key]: v }), [key]);
  return remember ? [(saved[key] ?? fallback) as NonNullable<ViewPrefs[K]>, set] : [local, setLocal];
}

const collect = (): Prefs => ({ ...readView(), theme: readTheme(), accent: getAccent() });

const apply = (p: Prefs) => {
  const { theme, accent, ...view } = p;
  writeView({ ...readView(), ...view });
  if (theme) saveTheme(theme);
  if (accent !== undefined) setAccent(accent);
};

/**
 * Keeps the preferences on the signed-in account: the account's copy wins when someone signs in, and later
 * changes are saved back after a short pause. Signed out, they stay on this device. Mount once.
 */
export function usePrefsSync() {
  React.useEffect(() => {
    const cloud = getCloud();
    if (!cloud) return;
    let synced: string | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const save = async (next: Prefs) => {
      const { error } = await cloud.auth.updateUser({ data: { prefs: next } });
      if (error) toast.error(`Couldn't save your preferences: ${error.message}`, { id: "prefs-save" });
    };

    const pull = (session: Session | null) => {
      if (!session) {
        synced = null;
        return;
      }
      const meta = session.user.user_metadata ?? {};
      const saved = parsePrefs(meta.prefs);
      // Accounts from before the blob kept only the accent, at the top level.
      if (saved) apply(saved);
      else if (meta.accent) setAccent(parseAccent(meta.accent));
      const now = collect();
      synced = JSON.stringify(now);
      if (!saved) void save(now);
    };

    const onChange = () => {
      if (synced === null) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        const next = collect();
        const json = JSON.stringify(next);
        if (json === synced) return;
        synced = json;
        void save(next);
      }, 800);
    };

    let canceled = false;
    cloud.auth.getSession().then(({ data }) => {
      if (!canceled) pull(data.session);
    });
    const { data } = cloud.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") pull(session);
    });
    const stops = [subscribeView(onChange), subscribeTheme(onChange), subscribeAccent(onChange)];
    return () => {
      canceled = true;
      clearTimeout(timer);
      data.subscription.unsubscribe();
      stops.forEach((stop) => stop());
    };
  }, []);
}
