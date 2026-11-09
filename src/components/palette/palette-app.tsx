"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { Redo2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import type { Stepper } from "./crumbs";
import { toggleVariants } from "@/components/ui/toggle";
import { Skeleton } from "@/components/ui/skeleton";
import { DEFAULT_GAMUT, type Gamut } from "@/lib/color/gamut";
import { SPACES, type SpaceId } from "@/lib/color/spaces";
import { maxChromaAt } from "@/lib/color/solve";
import { defaultState, hueFromPreset, hueFromSource, type HuePreset } from "@/lib/palette/defaults";
import { convertHue, generatePalette } from "@/lib/palette/generate";
import type { HueConfig, PaletteState, ScaleConfig, Shade, StepTweak } from "@/lib/palette/types";
import { contentKey, hashForState, stateFromHash } from "@/lib/palette/serialize";
import { validatePalette } from "@/lib/palette/validate";
import { useHistory } from "@/lib/palette/use-history";
import { MAX_GRADES, MIN_GRADES } from "@/lib/palette/scale";
import { addStepBetween, midpointGrade, removeStep, renameStep } from "@/lib/palette/steps";
import { setStepTweak } from "@/lib/palette/tweaks";
import { cloudEnabled, getCloud } from "@/lib/cloud/client";
import { createPalette, createShare, deletePalette, getShared, loadLatest, renamePalette, saveVersion } from "@/lib/cloud/palettes";
import { useSession } from "@/lib/cloud/use-session";
import { PAGE_WIDTH } from "./page-width";
import { getStorage } from "@/lib/storage";
import { ExportDialog } from "./export-dialog";
import { AddColorEnd } from "./color-label";
import { SectionGroup, SectionTabs } from "./panel-section";
import { ColorsList } from "./colors-list";
import { PaletteChart } from "./palette-chart";
import { HuePanel } from "./hue-panel";
import { ContrastRulesSection, PaletteSettings } from "./palette-settings";
import { PaletteSquare, type SquareMode } from "./palette-square";
import { StepPanel } from "./step-panel";
import { StepsEditor } from "./steps-editor";
import { ScrollFade } from "./scroll-fade";
import { DisplaySettings } from "./display-settings";
import { ViewToolbar } from "./view-toolbar";
import { displayShade, representativeShade, type Overlay } from "@/lib/palette/overlay";
import { tweakAt } from "@/lib/palette/tweaks";
import { removeHueFromTokens } from "@/lib/palette/tokens";
import { AccountMenu } from "./account-menu";
import { TagsField } from "./tags-field";
import { TokensSection } from "./tokens-section";
import { useApplyAccent } from "@/lib/accent";
import { usePrefsSync, useViewPref } from "@/lib/prefs";
import { ResetDialog } from "./reset-dialog";
import { SavesDialog, type CurrentPalette } from "./saves-dialog";
import { ShareMenu, type ExportKind } from "./share-menu";
import { Hint } from "./hint";
import { useKeyShortcut } from "./use-key-shortcut";
import { focusRegion, useRegionShortcuts } from "./use-region-shortcuts";
import { useRovingFocus } from "./use-roving-focus";
import { useMorph } from "./use-morph";
import { PaletteSwitcher } from "./palette-switcher";
import { usePaletteActions } from "./use-palette-actions";
import { isPopupOpen, isTextEntry } from "./text-entry";

const AUTOSAVE_ID = "__autosave__";
const CURRENT_KEY = "phase:current:v1";
const NAME_KEY = "phase:name:v1";

/** Undo and redo restore the palette but leave your current swatch selected, as long as it still exists. */
const keepSelection = (restored: PaletteState, current: PaletteState): PaletteState =>
  restored.hues.some((h) => h.id === current.selectedHueId) ? { ...restored, selectedHueId: current.selectedHueId } : restored;

/** Remembers something across reloads. Private mode can refuse, and that only costs the memory. */
const remember = (write: () => void) => {
  try {
    write();
  } catch {
    // Not remembered; nothing else depends on it.
  }
};

interface PaletteAppProps {
  /** A short-link code to open as a read-only snapshot. */
  shareCode?: string;
  /** A saved palette to open at its latest version. */
  paletteId?: string;
  /** Start from the starter palette instead of the last autosave. */
  fresh?: boolean;
}

const LOGO_MASK = "[mask-image:url(/phase-lockup-white.png)] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain]";

/**
 * `--shadow-default` turned inward and traced around the letters rather than a box: the same hairline ring and the
 * same two soft drops, each cut from the logo's own outline. CSS shadows can't follow a mask, so it's an SVG filter.
 */
function LogoInsetFilter({ id }: { id: string }) {
  const drop = (dy: number, blur: number, color: string, dark: string, n: number) => (
    <>
      <feOffset in="outside" dy={dy} result={`o${n}`} />
      <feGaussianBlur in={`o${n}`} stdDeviation={blur} result={`b${n}`} />
      <feFlood className={cn(color, dark)} />
      <feComposite operator="in" in2={`b${n}`} />
      <feComposite operator="in" in2="SourceAlpha" result={`s${n}`} />
    </>
  );
  return (
    <svg aria-hidden width={0} height={0} className="absolute">
      <filter id={id} x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
        <feComponentTransfer in="SourceAlpha" result="outside">
          <feFuncA type="table" tableValues="1 0" />
        </feComponentTransfer>
        <feMorphology in="SourceAlpha" operator="erode" radius={0.5} result="eroded" />
        <feComposite in="SourceAlpha" in2="eroded" operator="out" result="edge" />
        <feFlood className="[flood-color:#0000000f] dark:[flood-color:#ffffff12]" />
        <feComposite operator="in" in2="edge" result="s0" />
        {drop(1, 0.5, "[flood-color:#0000001a]", "dark:[flood-color:#0000]", 1)}
        {drop(1, 1, "[flood-color:#0000000d]", "dark:[flood-color:#0000]", 2)}
        <feMerge>
          <feMergeNode in="SourceGraphic" />
          <feMergeNode in="s0" />
          <feMergeNode in="s1" />
          <feMergeNode in="s2" />
        </feMerge>
      </filter>
    </svg>
  );
}

/**
 * The wordmark in a quiet gray: a mask over the white artwork, so one file serves light and dark. Given the palette's
 * colors, hovering lights it up with them swirling through the letters and a soft glow of the same colors behind.
 */
function Logo({ colors }: { colors?: string[] }) {
  // A soft round blob of each color, set around a ring on a square larger than the logo. The square turns, so the
  // colors orbit through the letters instead of sliding past.
  const fill = colors?.length
    ? {
        backgroundImage: colors
          .map((c, i) => {
            const a = (i / colors.length) * Math.PI * 2;
            return `radial-gradient(circle at ${(50 + Math.cos(a) * 28).toFixed(1)}% ${(50 + Math.sin(a) * 28).toFixed(1)}%, ${c}, ${c}00 38%)`;
          })
          .concat(`linear-gradient(${colors[0]}, ${colors[0]})`)
          .join(", "),
      }
    : null;
  const lit = "opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none";
  const swirl = (
    <span
      className="absolute top-1/2 left-1/2 aspect-square w-[130%] -translate-x-1/2 -translate-y-1/2 animate-[logo-swirl_8s_linear_infinite] motion-reduce:animate-none"
      style={fill ?? undefined}
    />
  );
  const inset = "phase-logo-inset";
  return (
    <span className="relative block">
      <LogoInsetFilter id={inset} />
      {fill ? (
        <span aria-hidden className={cn("pointer-events-none absolute inset-0 blur-md mix-blend-multiply dark:mix-blend-screen", lit, "group-hover:opacity-35 group-focus-visible:opacity-35")}>
          <span className={cn("absolute inset-0 overflow-hidden", LOGO_MASK)}>{swirl}</span>
        </span>
      ) : null}
      <span className="relative block" style={{ filter: `url(#${inset})` }}>
        <span role="img" aria-label="Phase" className={cn("block aspect-[276/90] h-7 bg-stone-300 dark:bg-stone-700", LOGO_MASK)} />
        {fill ? (
          <span aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden mix-blend-multiply dark:mix-blend-screen", LOGO_MASK, lit, "group-hover:opacity-55 group-focus-visible:opacity-55")}>
            {swirl}
          </span>
        ) : null}
      </span>
    </span>
  );
}

const DEFAULT_OVERLAY: Overlay = { metric: "contrast", against: "white", grayscale: false, vision: "normal" };

export function PaletteApp({ shareCode, paletteId, fresh }: PaletteAppProps = {}) {
  const router = useRouter();
  const { session } = useSession();
  const { state, edit: setState, silent: selectSilently, replace: loadState, undo, redo, canUndo, canRedo } = useHistory<PaletteState>(() => defaultState(), keepSelection);
  const [ready, setReady] = React.useState(false);
  /** Which color and step fill the square. Both null is the resting state showing every color. */
  const [focus, setFocus] = React.useState<{ hueId: string | null; grade: number | null }>({ hueId: null, grade: null });
  const [resetOpen, setResetOpen] = React.useState(false);
  /** The version history takes over the sidebar, drawn into this element by the history menu. */
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [historySlot, setHistorySlot] = React.useState<HTMLElement | null>(null);
  // How you like to look at palettes is remembered for you, but a shared link always opens in the default view.
  const keepView = !shareCode;
  const [mode, setMode] = useViewPref("mode", "smooth" as SquareMode, keepView);
  const [grain, setGrain] = useViewPref("grain", true, keepView);
  const [ends, setEnds] = useViewPref("ends", true, keepView);
  const [savedOverlay, setOverlay] = useViewPref("overlay", DEFAULT_OVERLAY, keepView);
  // Measuring against a step this palette doesn't have (deleted, or saved from another palette) falls back to white.
  const overlay = React.useMemo(
    () => (typeof savedOverlay.against === "number" && !state.scale.grades.includes(savedOverlay.against) ? { ...savedOverlay, against: "white" as const } : savedOverlay),
    [savedOverlay, state.scale.grades],
  );
  const storage = React.useMemo(() => getStorage(), []);
  /** The cloud palette being edited, remembered across reloads so unsaved changes stay visible. */
  const [current, setCurrent] = React.useState<CurrentPalette | null>(null);
  /** The palette's name, edited in the header. A saved palette is renamed on its next save. */
  const [name, setName] = React.useState("");
  const stateKey = React.useMemo(() => contentKey(state), [state]);

  React.useEffect(() => {
    let canceled = false;
    (async () => {
      // A palette from the list, or a new one: neither starts from the last autosave.
      if (paletteId || fresh) {
        // Coming back to a palette starts from its latest version with the history closed, not wherever it was left.
        setHistoryOpen(false);
        try {
          if (paletteId) {
            const cloud = getCloud();
            if (!cloud) throw new Error("Saved palettes aren't turned on here.");
            const loaded = await loadLatest(cloud, paletteId);
            if (canceled) return;
            loadState({ ...loaded.state, gamut: loaded.state.gamut ?? DEFAULT_GAMUT });
            const pointer: CurrentPalette = { id: loaded.paletteId, name: loaded.paletteName, versionId: loaded.versionId, savedKey: contentKey(loaded.state) };
            setCurrent(pointer);
            setName(pointer.name);
            remember(() => {
              window.localStorage.setItem(CURRENT_KEY, JSON.stringify(pointer));
              window.localStorage.setItem(NAME_KEY, pointer.name);
            });
          } else {
            loadState(defaultState());
            setCurrent(null);
            setName("");
            remember(() => {
              window.localStorage.removeItem(CURRENT_KEY);
              window.localStorage.removeItem(NAME_KEY);
            });
          }
        } catch (e) {
          if (!canceled) toast.error(e instanceof Error ? e.message : "Couldn't open that palette.", { id: "palette-open-failed" });
        }
        if (!canceled) setReady(true);
        return;
      }
      try {
        const raw = window.localStorage.getItem(CURRENT_KEY);
        const savedName = window.localStorage.getItem(NAME_KEY);
        if (raw && !canceled) {
          const pointer = JSON.parse(raw) as CurrentPalette;
          setCurrent(pointer);
          setName(savedName ?? pointer.name);
        } else if (savedName && !canceled) {
          setName(savedName);
        }
      } catch {
        // Unreadable pointer: treat the palette as unsaved.
      }
      let fromCode: PaletteState | null = null;
      if (shareCode) {
        try {
          const cloud = getCloud();
          if (!cloud) throw new Error("Short links aren't turned on here.");
          fromCode = await getShared(cloud, shareCode);
          if (!fromCode) toast.error("That link doesn't exist or was removed. Showing your own palette instead.");
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "That link couldn't be opened.");
        }
      }
      const shared = fromCode ? null : stateFromHash(window.location.hash);
      if (fromCode) {
        if (!canceled) {
          loadState({ ...fromCode, gamut: fromCode.gamut ?? DEFAULT_GAMUT });
          // A shared snapshot isn't one of your saved palettes.
          setCurrent(null);
          try {
            window.localStorage.removeItem(CURRENT_KEY);
          } catch {
            // Nothing to clear in private mode.
          }
        }
      } else if (shared?.ok) {
        loadState(shared.state);
      } else {
        if (shared) toast.error(shared.error);
        try {
          const saved = await storage.get(AUTOSAVE_ID);
          // Autosaves from before the gamut control have no gamut and were always sRGB.
          if (saved && !canceled) loadState({ ...saved.state, gamut: saved.state.gamut ?? DEFAULT_GAMUT });
        } catch {
          // Storage can be unavailable (private mode); start from the default palette.
        }
      }
      if (!canceled) setReady(true);
    })();
    return () => {
      canceled = true;
    };
  }, [storage, shareCode, paletteId, fresh, loadState]);

  const updateName = React.useCallback((next: string) => {
    setName(next);
    try {
      window.localStorage.setItem(NAME_KEY, next);
    } catch {
      // Private mode: the name just won't survive a reload.
    }
  }, []);

  const updateCurrent = React.useCallback((next: CurrentPalette | null) => {
    setCurrent(next);
    if (next) updateName(next.name);
    // Keep the address in step with the palette being edited, without remounting the editor.
    const { pathname } = window.location;
    if (next && !pathname.startsWith("/s/") && pathname !== `/p/${next.id}`) window.history.replaceState(null, "", `/p/${next.id}`);
    else if (!next && pathname.startsWith("/p/")) window.history.replaceState(null, "", "/");
    try {
      if (next) window.localStorage.setItem(CURRENT_KEY, JSON.stringify(next));
      else window.localStorage.removeItem(CURRENT_KEY);
    } catch {
      // Private mode: the pointer just won't survive a reload.
    }
  }, [updateName]);

  React.useEffect(() => {
    const onHashChange = () => {
      const shared = stateFromHash(window.location.hash);
      if (!shared) return;
      if (shared.ok) {
        loadState(shared.state);
        setFocus({ hueId: null, grade: null });
      } else {
        toast.error(shared.error);
      }
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [loadState]);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || !(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      const isUndo = key === "z" && !e.shiftKey;
      const isRedo = (key === "z" && e.shiftKey) || (key === "y" && !e.shiftKey && e.ctrlKey);
      if (!isUndo && !isRedo) return;
      if (isTextEntry(e.target) || isPopupOpen('[data-slot="dialog-content"]')) return;
      e.preventDefault();
      if (isUndo) undo();
      else redo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  const up = React.useCallback(() => setFocus((f) => (f.grade !== null ? { ...f, grade: null } : { hueId: null, grade: null })), []);

  React.useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      storage.save({ id: AUTOSAVE_ID, name: "Autosave", updatedAt: Date.now(), state }).catch(() =>
        toast.error("Couldn't autosave. Your latest changes may be lost if you close this tab.", { id: "autosave-failed" }),
      );
      if (cloudEnabled()) {
        // Short links replace the long ones, so keep the address bar clean. This also leaves a /s/code page,
        // but a saved palette keeps its own /p/id address.
        const { hash, pathname } = window.location;
        if (pathname.startsWith("/s/")) window.history.replaceState(null, "", "/");
        else if (hash) window.history.replaceState(null, "", pathname);
        return;
      }
      const hash = hashForState(state);
      // replaceState keeps the address bar shareable without filling history or firing hashchange.
      if (window.location.hash !== hash) window.history.replaceState(null, "", hash);
    }, 400);
    return () => clearTimeout(t);
  }, [state, ready, storage]);

  // Signed-in editing of a saved or new palette saves itself. A new palette is created soon after the
  // first change (including a name); after that, an unnamed version is added once you pause.
  // Named versions, added from the history menu, mark the moments worth keeping.
  const cloudSaving = React.useRef(false);
  const autosaves = Boolean(session) && ready && !shareCode && Boolean(paletteId || fresh || current);
  React.useEffect(() => {
    if (!autosaves) return;
    const trimmed = name.trim();
    const dirty = current ? current.savedKey !== stateKey || trimmed !== current.name : stateKey !== contentKey(defaultState()) || trimmed !== "";
    if (!dirty) return;
    const t = setTimeout(
      async () => {
        const cloud = getCloud();
        if (!cloud || cloudSaving.current) return;
        cloudSaving.current = true;
        try {
          if (!current) {
            const { paletteId: id, version } = await createPalette(cloud, trimmed, state);
            updateCurrent({ id, name: trimmed || "Untitled", versionId: version.id, savedKey: stateKey });
          } else {
            if (trimmed && trimmed !== current.name) await renamePalette(cloud, current.id, trimmed);
            const version = await saveVersion(cloud, current.id, state);
            updateCurrent({ ...current, name: trimmed || current.name, versionId: version.id, savedKey: stateKey });
          }
        } catch (e) {
          toast.error(e instanceof Error ? `Couldn't save your palette. ${e.message}` : "Couldn't save your palette.", { id: "cloud-autosave-failed" });
        } finally {
          cloudSaving.current = false;
        }
      },
      current ? 10_000 : 1_500,
    );
    return () => clearTimeout(t);
  }, [autosaves, current, name, state, stateKey, updateCurrent]);

  const [exportKind, setExportKind] = React.useState<ExportKind | null>(null);

  const share = async () => {
    let url = `${window.location.origin}${window.location.pathname}${hashForState(state)}`;
    let short = false;
    const cloud = cloudEnabled() ? getCloud() : null;
    if (cloud) {
      const { data } = await cloud.auth.getSession();
      if (data.session) {
        try {
          url = `${window.location.origin}/s/${await createShare(cloud, state)}`;
          short = true;
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Couldn't make a short link.");
          return;
        }
      } else {
        toast.message("Sign in to get short links. Copying the long link for now.");
      }
    }
    if (!cloud) window.history.replaceState(null, "", hashForState(state));
    try {
      await navigator.clipboard.writeText(url);
      toast.success(short ? `Short link copied: ${url}` : "Link copied. Anyone who opens it sees this exact palette.");
    } catch {
      toast.message("Copy this link from the address bar to share your palette.");
    }
  };

  const generated = React.useMemo(() => generatePalette(state.space, state.scale, state.hues, state.gamut), [state.space, state.scale, state.hues, state.gamut]);
  const limitOf = React.useCallback((s: Shade) => maxChromaAt(SPACES[state.space], s.targetLuminance, s.hue, state.gamut), [state.space, state.gamut]);
  /** What the square and chart draw: `generated`, or partway to it while switching palettes. */
  const [shown, armMorph, morphing] = useMorph(generated, limitOf);
  const report = React.useMemo(() => validatePalette(generated, state.scale.rules), [generated, state.scale.rules]);
  // A removed color can't stay open, so fall back to the level above.
  const focused = focus.hueId ? (generated.find((g) => g.hue.id === focus.hueId) ?? null) : null;
  const focusShade = focused && focus.grade !== null ? (focused.shades.find((s) => s.grade === focus.grade) ?? null) : null;
  const renderSettings = (danger: React.ReactNode) => (
    <DisplaySettings overlay={overlay} onOverlay={setOverlay} grades={state.scale.grades} extra={danger} />
  );

  useApplyAccent();
  usePrefsSync();
  // Where the keyboard lands on the canvas when you come back to a level.
  const [lastGrade, setLastGrade] = React.useState<number | null>(null);
  const actionsRef = React.useRef<HTMLDivElement>(null);
  useRovingFocus(actionsRef);
  const panelRef = React.useRef<HTMLDivElement>(null);
  useRegionShortcuts();
  const openHue = (hueId: string) => {
    selectSilently((s) => ({ ...s, selectedHueId: hueId }));
    setFocus({ hueId, grade: null });
  };
  const openStep = (hueId: string, grade: number) => {
    setLastGrade(grade);
    selectSilently((s) => ({ ...s, selectedHueId: hueId }));
    setFocus({ hueId, grade });
  };

  const setSpace = (space: SpaceId) =>
    setState((s) => (space === s.space ? s : { ...s, space, hues: s.hues.map((h) => convertHue(h, s.scale, s.space, space, s.gamut)) }));
  const setGamut = (gamut: Gamut) => setState((s) => (gamut === s.gamut ? s : { ...s, gamut }));
  const setScale = (scale: ScaleConfig) => setState((s) => ({ ...s, scale }));
  const updateHue = (id: string, patch: Partial<HueConfig>) =>
    setState((s) => ({ ...s, hues: s.hues.map((h) => (h.id === id ? { ...h, ...patch } : h)) }));

  const uniqueName = (base: string, hues: HueConfig[]) => {
    let name = base;
    let n = 2;
    while (hues.some((h) => h.name.toLowerCase() === name.toLowerCase())) name = `${base} ${n++}`;
    return name;
  };

  const insertHue = (hues: HueConfig[], hue: HueConfig, index: number) => [...hues.slice(0, index), hue, ...hues.slice(index)];

  const addPreset = (preset: HuePreset, index: number) =>
    setState((s) => {
      const hue = hueFromPreset(preset, s.space, s.scale, uniqueName(preset.name, s.hues));
      return { ...s, hues: insertHue(s.hues, hue, index), selectedHueId: hue.id };
    });

  const addFromHex = (hex: string, index: number) =>
    setState((s) => {
      const draft = hueFromSource(hex, s.space);
      const hue = { ...draft, name: uniqueName(draft.name, s.hues) };
      return { ...s, hues: insertHue(s.hues, hue, index), selectedHueId: hue.id };
    });

  const remove = (id: string) =>
    setState((s) => {
      const idx = s.hues.findIndex((h) => h.id === id);
      const hues = s.hues.filter((h) => h.id !== id);
      const next = hues[Math.min(idx, hues.length - 1)]?.id ?? null;
      return removeHueFromTokens({ ...s, hues, selectedHueId: s.selectedHueId === id ? next : s.selectedHueId }, id);
    });

  const reorder = (id: string, toIndex: number) =>
    setState((s) => {
      const from = s.hues.findIndex((h) => h.id === id);
      if (from < 0 || from === toIndex) return s;
      const hues = [...s.hues];
      const [moved] = hues.splice(from, 1);
      hues.splice(toIndex, 0, moved);
      return { ...s, hues };
    });

  const addStep = (lower: number, upper: number) => {
    const added = midpointGrade(lower, upper);
    setState((s) => addStepBetween(s, lower, upper));
    // Land on the new step so it can be tuned straight away.
    if (added !== null) setFocus((f) => (f.hueId && f.grade !== null ? { ...f, grade: added } : f));
  };

  const removeStepAt = (removed: number) => {
    setState((s) => removeStep(s, removed));
    setFocus((f) => (f.grade === removed ? { ...f, grade: null } : f));
  };

  const renameStepTo = (from: number, to: number) => {
    setState((s) => renameStep(s, from, to));
    setFocus((f) => (f.grade === from ? { ...f, grade: to } : f));
  };

  const stepLimit = state.scale.grades.length >= MAX_GRADES ? "max" : state.scale.grades.length <= MIN_GRADES ? "min" : null;
  const stepActions = { stepLimit, grades: state.scale.grades, onAddStep: addStep, onRemoveStep: removeStepAt, onRenameStep: renameStepTo } as const;
  const colorActions = {
    onRename: (id: string, name: string) => updateHue(id, { name }),
    onRemove: remove,
    onAddPreset: addPreset,
    onAddHex: addFromHex,
  };

  const tweakStep = (hueId: string, grade: number, patch: Partial<StepTweak>) =>
    setState((s) => ({ ...s, hues: s.hues.map((h) => (h.id === hueId ? { ...h, ...setStepTweak(h, grade, patch) } : h)) }));
  const resetTweaks = (hueId: string, grade?: number) =>
    setState((s) => ({
      ...s,
      hues: s.hues.map((h) => (h.id !== hueId ? h : { ...h, ...(grade === undefined ? { stepTweaks: undefined } : setStepTweak(h, grade, { dh: 0, dc: 0 })) })),
    }));

  const reset = () => {
    setState(defaultState());
    setFocus({ hueId: null, grade: null });
    toast.success("Back to the starter palette", { action: { label: "Undo", onClick: undo } });
  };

  /** False when leaving would drop changes that were never saved and you decline. */
  const confirmLeave = () => {
    const unsaved = current !== null ? current.savedKey !== stateKey || name.trim() !== current.name : stateKey !== contentKey(defaultState());
    return !unsaved || window.confirm("You have changes that aren't saved. Leave anyway?");
  };
  /** Deletes the saved palette and moves on to the most recent remaining one (or a new palette), skipping the unsaved-changes prompt. */
  const deleteCurrent = async () => {
    const cloud = getCloud();
    if (!cloud || !current) return;
    try {
      await deletePalette(cloud, current.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete that palette.");
      return;
    }
    toast.success(`Deleted ${current.name}`);
    router.push("/");
  };
  /** Opens another saved palette in place, so the colors can glide from this one's to that one's. */
  const switchTo = async (id: string) => {
    const cloud = getCloud();
    if (!cloud) return;
    try {
      const loaded = await loadLatest(cloud, id);
      armMorph();
      setHistoryOpen(false);
      setFocus({ hueId: null, grade: null });
      loadState({ ...loaded.state, gamut: loaded.state.gamut ?? DEFAULT_GAMUT });
      updateCurrent({ id: loaded.paletteId, name: loaded.paletteName, versionId: loaded.versionId, savedKey: contentKey(loaded.state) });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't open that palette.");
    }
  };
  /** Starts a blank palette, asking first when leaving would drop changes that were never saved. */
  const newPalette = () => {
    if (!confirmLeave()) return;
    if (!fresh) {
      router.push("/p/new");
      return;
    }
    // Already on the new-palette page, where pushing the same route would do nothing (and a palette saved from here
    // only changes the address, not the page), so start over in place.
    setHistoryOpen(false);
    setFocus({ hueId: null, grade: null });
    loadState(defaultState());
    setCurrent(null);
    setName("");
    remember(() => {
      window.localStorage.removeItem(CURRENT_KEY);
      window.localStorage.removeItem(NAME_KEY);
    });
    if (window.location.pathname !== "/p/new") window.history.replaceState(null, "", "/p/new");
  };
  useKeyShortcut("KeyN", newPalette, { command: true, enabled: !!session });
  const { duplicate } = usePaletteActions(() => {});
  /** Saves a copy of the last saved version, under "<name> copy". */
  const duplicateCurrent = () => (current ? duplicate({ id: current.id, name: current.name, updatedAt: Date.now() }) : undefined);
  const listCrumb = session
    ? [
        {
          label: "Palettes",
          render: (
            <PaletteSwitcher
              currentId={current?.id ?? null}
              currentName={name}
              onSwitch={(id) => {
                if (confirmLeave()) void switchTo(id);
              }}
              onNew={() => {
                newPalette();
              }}
            />
          ),
        },
      ]
    : [];

  // Esc inside a color or step steps up a level, and an open version history closes first.
  const onEscape = React.useRef<(e: KeyboardEvent) => void>(() => {});
  onEscape.current = (e) => {
    if (e.key !== "Escape" || e.defaultPrevented) return;
    if (isPopupOpen('[data-slot="dialog-content"], [data-slot="popover-content"], [data-slot="select-content"], [role="menu"]')) return;
    // Esc in a text field just leaves the field (so it never feels stuck); the next Esc navigates.
    if (isTextEntry(e.target)) {
      (e.target as HTMLElement).blur();
      return;
    }
    // One step per press: close history, else go up a level inside a color or step.
    if (historyOpen) setHistoryOpen(false);
    else if (focused) up();
  };
  // Subscribed once, so this listener keeps its place at the front of the capture phase instead of being re-added behind others on every render.
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => onEscape.current(e);
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  const level = focused ? (focusShade ? "step" : "hue") : "all";
  // With the ends hidden, the arrows step only through the colors the user controls.
  const steps = focused ? focused.shades.filter((s) => ends || !s.anchor || s.grade === focusShade?.grade) : [];
  const stepIndex = focusShade ? steps.findIndex((s) => s.grade === focusShade.grade) : -1;
  const goStep = (offset: number) => {
    const next = steps[stepIndex + offset];
    return next && focused ? () => openStep(focused.hue.id, next.grade) : null;
  };
  const hueIndex = focused ? generated.findIndex((g) => g.hue.id === focused.hue.id) : -1;
  const goHue = (offset: number) => {
    const next = generated[hueIndex + offset];
    return next ? () => openHue(next.hue.id) : null;
  };
  const stepper: Stepper | undefined =
    focused && focusShade ? { axis: "horizontal", label: "steps", onPrevious: goStep(-1), onNext: goStep(1) } : focused ? { axis: "vertical", label: "colors", onPrevious: goHue(-1), onNext: goHue(1) } : undefined;
  // Arrows move along the row of steps or the list of colors, unless a slider or tab strip has focus and wants them.
  const arrowsBusy = () => Boolean(document.activeElement?.closest('[role="slider"], [role="tab"], input[type="range"]'));
  const [prevKey, nextKey] = stepper?.axis === "vertical" ? ["ArrowUp", "ArrowDown"] : ["ArrowLeft", "ArrowRight"];
  useKeyShortcut(prevKey, () => !arrowsBusy() && stepper?.onPrevious?.(), { enabled: !!stepper?.onPrevious });
  useKeyShortcut(nextKey, () => !arrowsBusy() && stepper?.onNext?.(), { enabled: !!stepper?.onNext });
  // Opening or leaving a level moves the keyboard onto the canvas, so the arrows and Enter work straight away. It
  // only takes focus that is up for grabs (nothing focused, or focus on the canvas or navigation it replaces).
  React.useEffect(() => {
    if (!ready) return;
    const frame = requestAnimationFrame(() => {
      const at = document.activeElement;
      if (!at || at === document.body || at.closest('[data-region="canvas"], [data-region="navigate"]')) focusRegion("canvas");
    });
    return () => cancelAnimationFrame(frame);
  }, [level, ready]);

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <main
        className={`${PAGE_WIDTH} lg:[container-type:size] grid w-full flex-1 gap-6 py-4 lg:relative lg:h-dvh lg:min-h-0 lg:flex-none lg:grid-cols-[auto_minmax(24rem,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:items-center lg:overflow-clip lg:[overflow-clip-margin:2.5rem] lg:py-0`}
      >
        <section aria-label="Palette" className="flex min-w-0 flex-col lg:h-full lg:overflow-y-auto lg:-mx-10 lg:px-10 lg:py-6">
          <div className="my-auto space-y-6">
            {!ready ? (
              <div aria-busy="true" aria-label="Loading your palette" className="mr-auto">
                <Skeleton className="aspect-square w-full rounded-3xl lg:w-[min(100cqw-25.5rem,100cqh-9rem)]" />
              </div>
            ) : generated.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-border p-12 text-center">
                <p className="font-medium">No colors yet</p>
                <p className="max-w-sm text-sm text-muted-foreground">Type a hex or pick a preset and a full scale from white to black appears.</p>
                <AddColorEnd index={0} actions={colorActions} label="Add your first color" variant="secondary" />
              </div>
            ) : (
              <>
                {/* The square and the sidebar are the same height, and the toolbar hangs above the square so it never moves the square off center. */}
                <div className="relative mr-auto w-full lg:w-[min(100cqw-25.5rem,100cqh-9rem)]">
                  <div>
                  <PaletteSquare
                    generated={shown}
                    focusHueId={focused?.hue.id ?? null}
                    focusGrade={focusShade?.grade ?? null}
                    rules={state.scale.rules}
                    overlay={overlay}
                    failures={report.failures}
                    gamut={state.gamut}
                    mode={mode}
                    grain={grain}
                    ends={ends}
                    blend="mitchell"
                    onOpenHue={openHue}
                    onOpenStep={openStep}
                    currentHueId={state.selectedHueId}
                    currentGrade={lastGrade}
                  />
                  </div>
                  <div className="animate-in fade-in absolute inset-x-0 bottom-full mb-4 duration-300 fill-mode-backwards [animation-delay:200ms] motion-reduce:animate-none">
                    <ViewToolbar
                      overlay={overlay}
                      onOverlay={setOverlay}
                      mode={mode}
                      onMode={setMode}
                      grain={grain}
                      onGrain={setGrain}
                      ends={ends}
                      onEnds={setEnds}
                      stepper={stepper}
                      crumbs={
                        focused && focusShade
                          ? [...listCrumb, { label: "All colors", onClick: up }, { label: focused.hue.name || "Unnamed", onClick: () => openHue(focused.hue.id) }, { label: `${focused.hue.name || "Unnamed"} ${focusShade.grade}` }]
                          : focused
                            ? [...listCrumb, { label: "All colors", onClick: up }, { label: focused.hue.name || "Unnamed" }]
                            : [...listCrumb, { label: "All colors" }]
                      }
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        <aside aria-label={level === "all" ? "Palette settings" : level === "hue" ? "Color settings" : "Step settings"} className="relative min-w-0 pb-6 lg:h-[min(100cqw-25.5rem,100cqh-9rem)] lg:pb-0">
        <div ref={actionsRef} role="toolbar" aria-label="Palette actions" data-region="actions" className="animate-in fade-in mb-3 flex items-center justify-between gap-2 px-2 duration-300 fill-mode-backwards [animation-delay:200ms] motion-reduce:animate-none lg:absolute lg:inset-x-0 lg:bottom-full lg:mb-4">
          <div className="flex items-center gap-2">
          <div className="flex items-center gap-2" role="group" aria-label="History">
            <Hint label="Undo" shortcut={["⌘", "Z"]}>
              {/* A disabled button gets no pointer events, so the tooltip hangs off a wrapper instead. */}
              <span className={cn("inline-flex", !canUndo && "cursor-not-allowed")}>
                <button type="button" className={toggleVariants({ variant: "outline", size: "sm" })} onClick={undo} disabled={!canUndo} aria-label="Undo">
                  <Undo2 />
                </button>
              </span>
            </Hint>
            <Hint label="Redo" shortcut={["⇧", "⌘", "Z"]}>
              {/* A disabled button gets no pointer events, so the tooltip hangs off a wrapper instead. */}
              <span className={cn("inline-flex", !canRedo && "cursor-not-allowed")}>
                <button type="button" className={toggleVariants({ variant: "outline", size: "sm" })} onClick={redo} disabled={!canRedo} aria-label="Redo">
                  <Redo2 />
                </button>
              </span>
            </Hint>
          </div>
          </div>
          <div className="flex items-center gap-2">
          <SavesDialog
            open={historyOpen}
            onOpenChange={setHistoryOpen}
            slot={historySlot}
            state={state}
            name={name}
            stateKey={stateKey}
            current={current}
            hasUnsaved={current !== null && (current.savedKey !== stateKey || name.trim() !== current.name)}
            onCurrent={updateCurrent}
            onOpen={(loaded) => {
              setState({ ...loaded.state, gamut: loaded.state.gamut ?? DEFAULT_GAMUT });
              setFocus({ hueId: null, grade: null });
            }}
          />
          <ShareMenu disabled={!ready} onCopyLink={share} onExport={setExportKind} />
          <AccountMenu onSignedOut={() => updateCurrent(null)} />
          </div>
          <ResetDialog open={resetOpen} onOpenChange={setResetOpen} onReset={reset} />
          <ExportDialog kind={exportKind} onClose={() => setExportKind(null)} state={state} generated={generated} />
        </div>
          {!ready ? null : (
            <div ref={panelRef} data-region="panel" className="animate-in fade-in slide-in-from-bottom-2 flex min-h-0 flex-col overflow-hidden rounded-3xl bg-white shadow-(--shadow-default) duration-300 fill-mode-backwards [animation-delay:150ms] motion-reduce:animate-none lg:h-full dark:bg-black">
            {historyOpen || generated.length === 0 ? null : (
              <div className="shrink-0 border-b border-border">
                <PaletteChart generated={shown} calm={morphing} focusId={focused?.hue.id ?? null} focusGrade={focusShade?.grade ?? null} space={state.space} gamut={state.gamut} />
              </div>
            )}
            {historyOpen ? (
              <ScrollFade className="min-h-0 flex-1" innerClassName="h-full">
                <div ref={setHistorySlot} className="h-full" />
              </ScrollFade>
            ) : (
              <SectionGroup key={focused ? "focus" : "all"} defaultOpen={focused ? "details" : "colors"}>
                <SectionTabs />
                <ScrollFade className="min-h-0 flex-1">
              {focused && focusShade ? (
                <StepPanel
                  key={`${focused.hue.id}:${focusShade.grade}`}
                  generated={focused}
                  shade={focusShade}
                  gamut={state.gamut}
                  tweak={tweakAt(focused.hue, focusShade.grade)}
                  onTweak={(patch) => tweakStep(focused.hue.id, focusShade.grade, patch)}
                  onResetStep={() => resetTweaks(focused.hue.id, focusShade.grade)}
                  onResetAll={() => resetTweaks(focused.hue.id)}
                  overlay={overlay}
                  tags={<TagsField id="step-tags" state={state} at={{ hueId: focused.hue.id, grade: focusShade.grade }} onApply={setState} />}
                  stepActions={stepActions}
                  settings={renderSettings}
                />
              ) : focused ? (
                <HuePanel
                  key={focused.hue.id}
                  generated={focused}
                  space={state.space}
                  gamut={state.gamut}
                  onChange={(patch) => updateHue(focused.hue.id, patch)}
                  onRemove={() => remove(focused.hue.id)}
                  onResetTweaks={() => resetTweaks(focused.hue.id)}
                  onOpenStep={(g) => openStep(focused.hue.id, g)}
                  display={(shade) => displayShade(shade, overlay, state.gamut)}
                  overlay={overlay}
                  tags={<TagsField id="color-tags" state={state} at={{ hueId: focused.hue.id, grade: null }} onApply={setState} />}
                  settings={renderSettings}
                />
              ) : (
                <>
                  <ColorsList generated={generated} overlay={overlay} gamut={state.gamut} actions={colorActions} onOpen={openHue} onReorder={reorder} />
                  <StepsEditor actions={stepActions} scale={state.scale} onScale={setScale} overlay={overlay} />
                  <ContrastRulesSection scale={state.scale} onScale={setScale} />
                  <TokensSection state={state} generated={generated} display={(shade) => displayShade(shade, overlay, state.gamut)} onApply={setState} />
                  <PaletteSettings space={state.space} gamut={state.gamut} onSpace={setSpace} onGamut={setGamut} onDelete={current ? () => void deleteCurrent() : undefined} name={current?.name} paletteName={name} onPaletteName={updateName} onDuplicate={current ? () => void duplicateCurrent() : undefined} display={generated.length > 0 ? <DisplaySettings bare overlay={overlay} onOverlay={setOverlay} grades={state.scale.grades} /> : null} />
                </>
              )}
                </ScrollFade>
              </SectionGroup>
            )}
            </div>
          )}
        </aside>
        <footer className="flex justify-center py-6 lg:pointer-events-none lg:absolute lg:inset-x-0 lg:bottom-0 lg:h-[calc((100cqh-min(100cqw-25.5rem,100cqh-9rem))/2)] lg:items-center lg:py-0">
          {/* On hover the logo lights up with the palette on screen, so it changes with every palette. */}
          {(() => {
            // Grays would only dull the gradient, so they're left out unless the palette has nothing else.
            const tones = generated.map(representativeShade);
            const vivid = tones.filter((t) => t.chroma >= 0.04);
            const colors = ready ? (vivid.length ? vivid : tones).map((t) => t.hex) : undefined;
            return session ? (
              <Hint label="New palette" shortcut={["⌘", "N"]}>
                <button type="button" onClick={newPalette} aria-label="New palette" className="group pointer-events-auto relative isolate rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Logo colors={colors} />
                </button>
              </Hint>
            ) : (
              <span className="group pointer-events-auto relative isolate rounded-md">
                <Logo colors={colors} />
              </span>
            );
          })()}
        </footer>
      </main>
    </div>
  );
}
