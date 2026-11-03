"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Redo2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ContrastReport } from "./contrast-report";
import { DEFAULT_GAMUT, type Gamut } from "@/lib/color/gamut";
import { type SpaceId } from "@/lib/color/spaces";
import { defaultState, hueFromPreset, hueFromSource, type HuePreset } from "@/lib/palette/defaults";
import { convertHue, generatePalette } from "@/lib/palette/generate";
import type { HueConfig, PaletteState, ScaleConfig, StepTweak } from "@/lib/palette/types";
import { encodeState, hashForState, stateFromHash } from "@/lib/palette/serialize";
import { validatePalette } from "@/lib/palette/validate";
import { useHistory } from "@/lib/palette/use-history";
import { MAX_GRADES, MIN_GRADES } from "@/lib/palette/scale";
import { addStepBetween, midpointGrade, removeStep, renameStep } from "@/lib/palette/steps";
import { setStepTweak } from "@/lib/palette/tweaks";
import { cloudEnabled, getCloud } from "@/lib/cloud/client";
import { createPalette, createShare, getShared, loadLatest, renamePalette, saveVersion } from "@/lib/cloud/palettes";
import { useSession } from "@/lib/cloud/use-session";
import { PAGE_WIDTH } from "./page-width";
import { getStorage } from "@/lib/storage";
import { ExportDialog } from "./export-dialog";
import { AddColorEnd } from "./color-label";
import { ColorsList } from "./colors-list";
import { CurvesPanel } from "./curves-panel";
import { HuePanel } from "./hue-panel";
import { PaletteSettings } from "./palette-settings";
import { PaletteSquare, type SquareMode } from "./palette-square";
import { StepPanel } from "./step-panel";
import { StepsEditor } from "./steps-editor";
import { ScrollFade } from "./scroll-fade";
import { DisplaySettings, type Panel } from "./display-settings";
import { ViewToolbar } from "./view-toolbar";
import { displayShade, type Overlay } from "@/lib/palette/overlay";
import { tweakAt } from "@/lib/palette/tweaks";
import { AccountMenu } from "./account-menu";
import { useApplyAccent } from "@/lib/accent";
import { ResetDialog } from "./reset-dialog";
import { SavesDialog, type CurrentPalette } from "./saves-dialog";
import { ScalePanel } from "./scale-panel";
import { ShareMenu, type ExportKind } from "./share-menu";
import { Hint } from "./hint";
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

export function PaletteApp({ shareCode, paletteId, fresh }: PaletteAppProps = {}) {
  const router = useRouter();
  const { session } = useSession();
  const { state, edit: setState, silent: selectSilently, replace: loadState, undo, redo, canUndo, canRedo } = useHistory<PaletteState>(() => defaultState(), keepSelection);
  const [ready, setReady] = React.useState(false);
  /** Which color and step fill the square. Both null is the resting state showing every color. */
  const [focus, setFocus] = React.useState<{ hueId: string | null; grade: number | null }>({ hueId: null, grade: null });
  const [mode, setMode] = React.useState<SquareMode>("smooth");
  const [resetOpen, setResetOpen] = React.useState(false);
  /** The version history takes over the sidebar, drawn into this element by the history menu. */
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [historySlot, setHistorySlot] = React.useState<HTMLElement | null>(null);
  const [grain, setGrain] = React.useState(true);
  const [panel, setPanel] = React.useState<Panel | null>(null);
  const [overlay, setOverlay] = React.useState<Overlay>({ metric: "contrast", against: "white", grayscale: false, vision: "normal" });
  const storage = React.useMemo(() => getStorage(), []);
  /** The cloud palette being edited, remembered across reloads so unsaved changes stay visible. */
  const [current, setCurrent] = React.useState<CurrentPalette | null>(null);
  /** The palette's name, edited in the header. A saved palette is renamed on its next save. */
  const [name, setName] = React.useState("");
  const stateKey = React.useMemo(() => encodeState(state), [state]);

  React.useEffect(() => {
    let canceled = false;
    (async () => {
      // A palette from the list, or a new one: neither starts from the last autosave.
      if (paletteId || fresh) {
        try {
          if (paletteId) {
            const cloud = getCloud();
            if (!cloud) throw new Error("Saved palettes aren't turned on here.");
            const loaded = await loadLatest(cloud, paletteId);
            if (canceled) return;
            loadState({ ...loaded.state, gamut: loaded.state.gamut ?? DEFAULT_GAMUT });
            const pointer: CurrentPalette = { id: loaded.paletteId, name: loaded.paletteName, versionId: loaded.versionId, savedKey: encodeState(loaded.state) };
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
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (isTextEntry(e.target) || isPopupOpen('[data-slot="dialog-content"], [data-slot="popover-content"], [data-slot="select-content"]')) return;
      up();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [up]);

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
    const dirty = current ? current.savedKey !== stateKey || trimmed !== current.name : stateKey !== encodeState(defaultState()) || trimmed !== "";
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
  const report = React.useMemo(() => validatePalette(generated, state.scale.rules), [generated, state.scale.rules]);
  // A removed color can't stay open, so fall back to the level above.
  const focused = focus.hueId ? (generated.find((g) => g.hue.id === focus.hueId) ?? null) : null;
  const focusShade = focused && focus.grade !== null ? (focused.shades.find((s) => s.grade === focus.grade) ?? null) : null;

  useApplyAccent();
  const openHue = (hueId: string) => {
    selectSilently((s) => ({ ...s, selectedHueId: hueId }));
    setFocus({ hueId, grade: null });
  };
  const openStep = (hueId: string, grade: number) => {
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
      return { ...s, hues, selectedHueId: s.selectedHueId === id ? next : s.selectedHueId };
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

  /** Back to every palette. Asks first when leaving would drop changes that were never saved. */
  const toList = () => {
    const unsaved = current !== null ? current.savedKey !== stateKey || name.trim() !== current.name : stateKey !== encodeState(defaultState());
    if (unsaved && !window.confirm("You have changes that aren't saved. Leave anyway?")) return;
    router.push("/");
  };
  const listCrumb = session ? [{ label: "Palettes", onClick: toList }] : [];

  // Esc at the top level goes back to Palettes, asking first when there is unsaved work. Inside a color or step it
  // steps up instead (handled above), and an open version history closes first.
  React.useEffect(() => {
    if (!session) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (isTextEntry(e.target) || isPopupOpen('[data-slot="dialog-content"], [data-slot="popover-content"], [data-slot="select-content"], [role="menu"]')) return;
      if (historyOpen) setHistoryOpen(false);
      else if (!focused) toList();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const rules = [...state.scale.rules].sort((a, b) => a.minDiff - b.minDiff);
  const reference = focusShade ?? null;
  const level = focused ? (focusShade ? "step" : "hue") : "all";
  const stepIndex = focused && focusShade ? focused.shades.findIndex((s) => s.grade === focusShade.grade) : -1;
  const goStep = (offset: number) => {
    const next = focused?.shades[stepIndex + offset];
    return next && focused ? () => openStep(focused.hue.id, next.grade) : null;
  };
  const openPanel: Panel | null = panel === "curves" && !focused ? null : panel;

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <header className="border-b border-border bg-white dark:bg-black">
        <div className={`${PAGE_WIDTH} grid h-14 grid-cols-[1fr_minmax(0,auto)_1fr] items-center gap-3`}>
          <Image src="/phase-lockup-white.png" alt="Phase" width={276} height={90} priority className="h-6 w-auto invert dark:invert-0" />
          <input
            aria-label="Palette name"
            value={name}
            maxLength={80}
            placeholder="Untitled palette"
            onChange={(e) => updateName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
            }}
            onFocus={(e) => e.currentTarget.select()}
            size={Math.max(12, name.length + 1)}
            className="h-8 field-sizing-content max-w-[min(24rem,40vw)] min-w-24 truncate rounded-md bg-transparent px-2 text-center text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="flex items-center justify-end gap-2">
            <div className="flex items-center" role="group" aria-label="History">
              <Hint label="Undo" shortcut={["⌘", "Z"]}>
                <Button variant="ghost" size="icon-sm" onClick={undo} disabled={!canUndo} aria-label="Undo">
                  <Undo2 />
                </Button>
              </Hint>
              <Hint label="Redo" shortcut={["⇧", "⌘", "Z"]}>
                <Button variant="ghost" size="icon-sm" onClick={redo} disabled={!canRedo} aria-label="Redo">
                  <Redo2 />
                </Button>
              </Hint>
            </div>
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
            <ResetDialog open={resetOpen} onOpenChange={setResetOpen} onReset={reset} />
            <ExportDialog kind={exportKind} onClose={() => setExportKind(null)} state={state} generated={generated} />
          </div>
        </div>
      </header>

      <main
        className={`${PAGE_WIDTH} lg:[container-type:size] grid w-full flex-1 gap-6 py-4 lg:h-[calc(100dvh-3.5rem)] lg:min-h-0 lg:flex-none lg:grid-cols-[auto_minmax(24rem,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:items-center lg:overflow-clip lg:[overflow-clip-margin:2.5rem] lg:py-0`}
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
                {/* The square is 16px taller than the sidebar, and the toolbar hangs above it so it never moves the square off center. */}
                <div className="relative mr-auto w-full lg:w-[min(100cqw-25.5rem,100cqh-9rem)]">
                  <PaletteSquare
                    generated={generated}
                    focusHueId={focused?.hue.id ?? null}
                    focusGrade={focusShade?.grade ?? null}
                    rules={state.scale.rules}
                    overlay={overlay}
                    gamut={state.gamut}
                    mode={mode}
                    grain={grain}
                    blend="mitchell"
                    reference={reference}
                    onOpenHue={openHue}
                    onOpenStep={openStep}
                  />
                  <div className="absolute inset-x-0 bottom-full mb-4">
                    <ViewToolbar
                      overlay={overlay}
                      onOverlay={setOverlay}
                      mode={mode}
                      onMode={setMode}
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
                {openPanel ? <div className="mt-16 space-y-6" /> : null}
                {openPanel === "curves" && focused ? <CurvesPanel generated={focused} scale={state.scale} space={state.space} gamut={state.gamut} /> : null}
                {openPanel === "report" ? (
                  <ContrastReport report={report} rules={rules} gamut={state.gamut} showApcaNote={overlay.metric === "apca"} onSelect={openStep} />
                ) : null}
                {openPanel === "targets" ? <ScalePanel scale={state.scale} onChange={setScale} /> : null}
              </>
            )}
          </div>
        </section>

        <aside aria-label={level === "all" ? "Palette settings" : level === "hue" ? "Color settings" : "Step settings"} className="min-w-0 pb-6 lg:h-[calc(min(100cqw-25.5rem,100cqh-9rem)-1rem)] lg:pb-0">
          {!ready ? null : (
            <ScrollFade className="rounded-3xl bg-white shadow-(--shadow-large) lg:h-full dark:bg-black" innerClassName={historyOpen ? "h-full" : "divide-y divide-border"}>
              {historyOpen ? (
                <div ref={setHistorySlot} className="h-full" />
              ) : (
                <>
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
                  onPrevious={goStep(-1)}
                  onNext={goStep(1)}
                  stepActions={stepActions}
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
                />
              ) : (
                <>
                  <PaletteSettings space={state.space} gamut={state.gamut} scale={state.scale} onSpace={setSpace} onGamut={setGamut} onScale={setScale} display={generated.length > 0 ? <DisplaySettings bare overlay={overlay} onOverlay={setOverlay} mode={mode} grain={grain} onGrain={setGrain} panel={openPanel} onPanel={setPanel} curvesDisabled={!focused} /> : null} />
                  <ColorsList generated={generated} overlay={overlay} gamut={state.gamut} actions={colorActions} onOpen={openHue} onReorder={reorder} />
                  <StepsEditor actions={stepActions} />
                </>
              )}
              {focused ? <DisplaySettings overlay={overlay} onOverlay={setOverlay} mode={mode} grain={grain} onGrain={setGrain} panel={openPanel} onPanel={setPanel} curvesDisabled={!focused} /> : null}
                </>
              )}
            </ScrollFade>
          )}
        </aside>
      </main>
    </div>
  );
}
