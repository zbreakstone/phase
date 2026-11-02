"use client";

import * as React from "react";
import Image from "next/image";
import { Eye, Redo2, SunMedium, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ContrastReport } from "./contrast-report";
import { DEFAULT_GAMUT, type Gamut } from "@/lib/color/gamut";
import { VISIONS, type VisionId } from "@/lib/color/vision";
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
import { createShare, getShared } from "@/lib/cloud/palettes";
import { getStorage } from "@/lib/storage";
import { ExportDialog } from "./export-dialog";
import { AddColorEnd } from "./color-label";
import { HuePanel } from "./hue-panel";
import { PaletteGrid, displayShade, type Against, type Metric, type Overlay } from "./palette-grid";
import { SavesDialog, type CurrentPalette } from "./saves-dialog";
import { ScalePanel } from "./scale-panel";
import { SettingsMenu } from "./settings-menu";
import { ShareMenu, type ExportKind } from "./share-menu";

const AUTOSAVE_ID = "__autosave__";
const CURRENT_KEY = "phase:current:v1";

/** Undo and redo restore the palette but leave your current swatch selected, as long as it still exists. */
const keepSelection = (restored: PaletteState, current: PaletteState): PaletteState =>
  restored.hues.some((h) => h.id === current.selectedHueId) ? { ...restored, selectedHueId: current.selectedHueId } : restored;

/** Text fields keep the browser's own undo; everything else (sliders, buttons, the page) undoes the palette. */
const isTextEntry = (el: EventTarget | null) => {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable || el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) return !["range", "checkbox", "radio", "button", "submit", "reset", "file", "color"].includes(el.type);
  return false;
};

export function PaletteApp({ shareCode }: { shareCode?: string } = {}) {
  const { state, edit: setState, silent: selectSilently, replace: loadState, undo, redo, canUndo, canRedo } = useHistory<PaletteState>(() => defaultState(), keepSelection);
  const [ready, setReady] = React.useState(false);
  const [grade, setGrade] = React.useState<number | null>(null);
  const [overlay, setOverlay] = React.useState<Overlay>({ metric: "contrast", against: "white", grayscale: false, vision: "normal" });
  const storage = React.useMemo(() => getStorage(), []);
  /** The cloud palette being edited, remembered across reloads so unsaved changes stay visible. */
  const [current, setCurrent] = React.useState<CurrentPalette | null>(null);
  const stateKey = React.useMemo(() => encodeState(state), [state]);

  React.useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const raw = window.localStorage.getItem(CURRENT_KEY);
        if (raw && !canceled) setCurrent(JSON.parse(raw) as CurrentPalette);
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
  }, [storage, shareCode, loadState]);

  const updateCurrent = React.useCallback((next: CurrentPalette | null) => {
    setCurrent(next);
    try {
      if (next) window.localStorage.setItem(CURRENT_KEY, JSON.stringify(next));
      else window.localStorage.removeItem(CURRENT_KEY);
    } catch {
      // Private mode: the pointer just won't survive a reload.
    }
  }, []);

  React.useEffect(() => {
    const onHashChange = () => {
      const shared = stateFromHash(window.location.hash);
      if (!shared) return;
      if (shared.ok) {
        loadState(shared.state);
        setGrade(null);
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
      if (isTextEntry(e.target) || document.querySelector('[data-slot="dialog-content"]')) return;
      e.preventDefault();
      if (isUndo) undo();
      else redo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  React.useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      storage.save({ id: AUTOSAVE_ID, name: "Autosave", updatedAt: Date.now(), state }).catch(() => undefined);
      if (cloudEnabled()) {
        // Short links replace the long ones, so keep the address bar clean (this also leaves a /s/code page).
        if (window.location.hash || window.location.pathname !== "/") window.history.replaceState(null, "", "/");
        return;
      }
      const hash = hashForState(state);
      // replaceState keeps the address bar shareable without filling history or firing hashchange.
      if (window.location.hash !== hash) window.history.replaceState(null, "", hash);
    }, 400);
    return () => clearTimeout(t);
  }, [state, ready, storage]);

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
  const selected = generated.find((g) => g.hue.id === state.selectedHueId) ?? generated[0] ?? null;

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
    if (added !== null) setGrade(added);
  };

  const removeStepAt = (removed: number) => {
    setState((s) => removeStep(s, removed));
    setGrade((g) => (g === removed ? null : g));
  };

  const renameStepTo = (from: number, to: number) => {
    setState((s) => renameStep(s, from, to));
    setGrade((g) => (g === from ? to : g));
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
    setGrade(null);
    toast.success("Back to the starter palette", { action: { label: "Undo", onClick: undo } });
  };

  const rules = [...state.scale.rules].sort((a, b) => a.minDiff - b.minDiff);

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-[88rem] items-center gap-3 px-4">
          <Image src="/phase-lockup-white.png" alt="Phase" width={276} height={90} priority className="h-6 w-auto" />
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center" role="group" aria-label="History">
              <Button variant="ghost" size="icon-sm" onClick={undo} disabled={!canUndo} aria-label="Undo" title="Undo (⌘Z)">
                <Undo2 />
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={redo} disabled={!canRedo} aria-label="Redo" title="Redo (⇧⌘Z)">
                <Redo2 />
              </Button>
            </div>
            <SavesDialog
              state={state}
              stateKey={stateKey}
              current={current}
              hasUnsaved={current !== null && current.savedKey !== stateKey}
              onCurrent={updateCurrent}
              onOpen={(loaded) => {
                setState({ ...loaded.state, gamut: loaded.state.gamut ?? DEFAULT_GAMUT });
                setGrade(null);
              }}
            />
            <SettingsMenu space={state.space} gamut={state.gamut} scale={state.scale} onSpace={setSpace} onGamut={setGamut} onScale={setScale} onReset={reset} />
            <ShareMenu disabled={!ready} onCopyLink={share} onExport={setExportKind} />
            <ExportDialog kind={exportKind} onClose={() => setExportKind(null)} state={state} generated={generated} />
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[88rem] flex-1 gap-8 p-4 lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_22rem] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden">
        <section className="-ml-4 min-w-0 space-y-3 pl-4 lg:overflow-y-auto">
          {!ready ? (
            <div className="space-y-3" aria-busy="true" aria-label="Loading your palette">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-72 w-full" />
            </div>
          ) : (
            <>
              <Toolbar overlay={overlay} onOverlay={setOverlay} />
              {generated.length === 0 ? (
                <div className="flex flex-col items-center gap-2 border border-dashed border-border p-12 text-center">
                  <p className="font-medium">No colors yet</p>
                  <p className="max-w-sm text-sm text-muted-foreground">Type a hex or pick a preset and a full scale from white to black appears.</p>
                  <AddColorEnd index={0} actions={colorActions} label="Add your first color" variant="secondary" />
                </div>
              ) : (
                <>
                  <PaletteGrid
                    generated={generated}
                    rules={state.scale.rules}
                    overlay={overlay}
                    gamut={state.gamut}
                    selectedHueId={selected?.hue.id ?? null}
                    selectedGrade={grade}
                    onSelect={(id, g) => {
                      selectSilently((s) => ({ ...s, selectedHueId: id }));
                      setGrade(g);
                    }}
                    onReorder={reorder}
                    steps={stepActions}
                    colors={colorActions}
                    onTweakStep={tweakStep}
                    onResetTweaks={resetTweaks}
                  />
                  {(overlay.metric === "contrast" || overlay.metric === "apca") && overlay.against === "selected" && grade === null ? (
                    <p className="text-xs text-muted-foreground">Click a swatch to compare every other swatch against it.</p>
                  ) : null}
                  <ContrastReport
                    report={report}
                    rules={rules}
                    gamut={state.gamut}
                    showApcaNote={overlay.metric === "apca"}
                    onSelect={(id, g) => {
                      selectSilently((s) => ({ ...s, selectedHueId: id }));
                      setGrade(g);
                    }}
                  />
                </>
              )}
              <ScalePanel scale={state.scale} onChange={setScale} />
            </>
          )}
        </section>

        <aside aria-label="Selected hue" className="min-w-0 pb-20 lg:overflow-y-auto lg:border-l lg:border-border lg:pl-8">
          {ready && selected ? (
            <HuePanel
              key={selected.hue.id}
              generated={selected}
              space={state.space}
              gamut={state.gamut}
              scale={state.scale}
              selectedGrade={grade}
              onSelectGrade={setGrade}
              onChange={(patch) => updateHue(selected.hue.id, patch)}
              display={(shade) => displayShade(shade, overlay, state.gamut)}
            />
          ) : ready ? (
            <p className="text-sm text-muted-foreground">Add a color to edit its hue and chroma here.</p>
          ) : null}
        </aside>
      </main>
    </div>
  );
}

function Toolbar({
  overlay,
  onOverlay,
}: {
  overlay: Overlay;
  onOverlay: (o: Overlay) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Show</span>
        <ToggleGroup
          value={[overlay.metric]}
          onValueChange={(v) => v[0] && onOverlay({ ...overlay, metric: v[0] as Metric })}
          variant="outline"
          size="sm"
          spacing={0}
          aria-label="What to show on each swatch"
        >
          <ToggleGroupItem value="contrast">Contrast</ToggleGroupItem>
          <ToggleGroupItem value="apca" title="APCA Lc, the WCAG 3 draft contrast model. Informational: WCAG 2 ratios still decide pass or fail.">APCA</ToggleGroupItem>
          <ToggleGroupItem value="luminance">Luminance</ToggleGroupItem>
          <ToggleGroupItem value="off">Off</ToggleGroupItem>
        </ToggleGroup>
      </div>
      {overlay.metric === "contrast" || overlay.metric === "apca" ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{overlay.metric === "apca" ? "text color" : "against"}</span>
          <ToggleGroup
            value={[overlay.against]}
            onValueChange={(v) => v[0] && onOverlay({ ...overlay, against: v[0] as Against })}
            variant="outline"
            size="sm"
            spacing={0}
            aria-label="Contrast against"
          >
            <ToggleGroupItem value="white">White</ToggleGroupItem>
            <ToggleGroupItem value="black">Black</ToggleGroupItem>
            <ToggleGroupItem value="selected">Selected</ToggleGroupItem>
          </ToggleGroup>
        </div>
      ) : null}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">View</span>
        <Toggle
          variant="outline"
          size="sm"
         
          pressed={overlay.grayscale}
          onPressedChange={(grayscale) => onOverlay({ ...overlay, grayscale })}
          aria-label="Show swatches as grays of equal luminance"
          title="Show each swatch as the gray with the same luminance, so you can check that steps line up across hues"
        >
          <SunMedium />
          Luminance
        </Toggle>
        <Select
          items={VISIONS.map((v) => ({ value: v.id, label: v.id === "normal" ? "Vision" : v.label }))}
          value={overlay.vision}
          onValueChange={(v) => v && onOverlay({ ...overlay, vision: v as VisionId, grayscale: false })}
        >
          <SelectTrigger size="sm" className="w-40" aria-label="Simulate color vision">
            <Eye />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VISIONS.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                <span className="flex flex-col">
                  <span>{v.label}</span>
                  {v.note ? <span className="text-[11px] text-muted-foreground">{v.note}</span> : null}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
