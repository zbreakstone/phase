"use client";

import * as React from "react";
import { Layers, Link2, Palette as PaletteIcon, Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { parseHex } from "@/lib/color/convert";
import { SPACES, SPACE_ORDER, type SpaceId } from "@/lib/color/spaces";
import { HUE_PRESETS, defaultState, hueFromPreset, hueFromSource, uid, type HuePreset } from "@/lib/palette/defaults";
import { convertHue, generatePalette } from "@/lib/palette/generate";
import { checkTargets, targetLuminance } from "@/lib/palette/scale";
import { decodeState, encodeState } from "@/lib/palette/serialize";
import type { ContrastReference, HueConfig, PaletteState, ScaleConfig } from "@/lib/palette/types";
import { validatePalette } from "@/lib/palette/validate";
import { relativeLuminance } from "@/lib/color/contrast";
import { getStorage } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { AddHueMenu } from "./add-hue-menu";
import { ContrastMatrix } from "./contrast-matrix";
import { ExportPanel } from "./export-panel";
import { GuaranteeBanner } from "./guarantee-banner";
import { HueSettings } from "./hue-settings";
import { HueVisuals } from "./hue-visuals";
import { PaletteGrid } from "./palette-grid";
import { AUTOSAVE_ID, SavedDialog } from "./saved-dialog";
import { ReferenceSettings, RulesSettings, StepsSettings, TargetCurve } from "./scale-settings";

type Pane = "canvas" | "settings";

export function PaletteApp() {
  const [state, setState] = React.useState<PaletteState>(() => defaultState());
  const [ready, setReady] = React.useState(false);
  const [pane, setPane] = React.useState<Pane>("canvas");
  const storage = React.useMemo(() => getStorage(), []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const m = /[#&]p=([^&]+)/.exec(window.location.hash);
      if (m) {
        const res = decodeState(m[1]);
        if (res.ok) {
          if (!cancelled) {
            setState(res.state);
            toast.success("Loaded the palette from the shared link");
          }
        } else {
          toast.error(res.error);
        }
        history.replaceState(null, "", window.location.pathname + window.location.search);
      } else {
        try {
          const saved = await storage.get(AUTOSAVE_ID);
          if (saved && !cancelled) setState(saved.state);
        } catch {
          // Storage can be unavailable (private mode); start from the default palette.
        }
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [storage]);

  React.useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      storage.save({ id: AUTOSAVE_ID, name: "Autosave", updatedAt: Date.now(), state }).catch(() => undefined);
    }, 400);
    return () => clearTimeout(t);
  }, [state, ready, storage]);

  const generated = React.useMemo(() => generatePalette(state.space, state.scale, state.hues), [state.space, state.scale, state.hues]);
  const report = React.useMemo(() => validatePalette(generated, state.scale.rules), [generated, state.scale.rules]);
  const targetIssues = React.useMemo(() => checkTargets(state.scale).length, [state.scale]);
  const selected = generated.find((g) => g.hue.id === state.selectedHueId) ?? generated[0] ?? null;
  const referenceHex = state.reference.mode === "black" ? "#000000" : state.reference.mode === "custom" ? state.reference.hex : "#ffffff";
  const referenceY = relativeLuminance(referenceHex);

  const setSpace = (space: SpaceId) =>
    setState((s) => (space === s.space ? s : { ...s, space, hues: s.hues.map((h) => convertHue(h, s.scale, s.space, space)) }));
  const setScale = (scale: ScaleConfig) => setState((s) => ({ ...s, scale }));
  const setReference = (reference: ContrastReference) => setState((s) => ({ ...s, reference }));
  const select = (id: string) => setState((s) => ({ ...s, selectedHueId: id }));
  const updateHue = (id: string, patch: Partial<HueConfig>) =>
    setState((s) => ({ ...s, hues: s.hues.map((h) => (h.id === id ? { ...h, ...patch } : h)) }));

  const uniqueName = (base: string, hues: HueConfig[]) => {
    let name = base;
    let n = 2;
    while (hues.some((h) => h.name.toLowerCase() === name.toLowerCase())) name = `${base} ${n++}`;
    return name;
  };

  const addHue = (preset: HuePreset) =>
    setState((s) => {
      const hue = hueFromPreset(preset, s.space, s.scale, uniqueName(preset.name, s.hues));
      return { ...s, hues: [...s.hues, hue], selectedHueId: hue.id };
    });

  const addBlank = () =>
    setState((s) => {
      const base = HUE_PRESETS.find((p) => p.key === "teal")!;
      const hue = hueFromPreset(base, s.space, s.scale, uniqueName("Custom", s.hues));
      return { ...s, hues: [...s.hues, hue], selectedHueId: hue.id };
    });

  const addFromColour = (hex: string) =>
    setState((s) => {
      const draft = hueFromSource(hex, s.space);
      const hue = { ...draft, name: uniqueName(draft.name, s.hues) };
      return { ...s, hues: [...s.hues, hue], selectedHueId: hue.id };
    });

  const duplicate = (id: string) =>
    setState((s) => {
      const src = s.hues.find((h) => h.id === id);
      if (!src) return s;
      const copy = { ...src, id: uid("hue"), name: uniqueName(`${src.name} copy`, s.hues) };
      return { ...s, hues: [...s.hues, copy], selectedHueId: copy.id };
    });

  const remove = (id: string) =>
    setState((s) => {
      const idx = s.hues.findIndex((h) => h.id === id);
      const hues = s.hues.filter((h) => h.id !== id);
      const next = hues[Math.min(idx, hues.length - 1)]?.id ?? null;
      return { ...s, hues, selectedHueId: s.selectedHueId === id ? next : s.selectedHueId };
    });

  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}#p=${encodeState(state)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied. Anyone who opens it gets this exact palette.");
    } catch {
      toast.error("Couldn't access the clipboard.");
    }
  };

  const reset = () => {
    setState(defaultState());
    toast.success("Back to the starter palette");
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="z-30 shrink-0 border-b border-border bg-card">
        <div className="flex h-12 items-center gap-3 px-3 sm:px-4">
          <div className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex size-6 items-center justify-center bg-primary text-primary-foreground">
              <Layers className="size-3.5" />
            </span>
            Phase
          </div>
          <p className="hidden text-xs text-muted-foreground md:block">Contrast-safe colour scales in {SPACES[state.space].label}</p>
          <div className="ml-auto flex items-center gap-2">
            <AddHueMenu onAdd={addHue} onAddBlank={addBlank} />
            <SavedDialog state={state} onOpen={(s) => setState(s)} />
            <Button variant="outline" size="sm" className="rounded-none" onClick={share}>
              <Link2 />
              <span className="hidden sm:inline">Share</span>
            </Button>
            <Button variant="ghost" size="sm" className="rounded-none" onClick={reset} aria-label="Reset to starter palette">
              <RotateCcw />
              <span className="hidden lg:inline">Reset</span>
            </Button>
          </div>
        </div>
        <div className="border-t border-border p-1.5 lg:hidden">
          <ToggleGroup
            value={[pane]}
            onValueChange={(v) => v[0] && setPane(v[0] as Pane)}
            variant="outline"
            size="sm"
            spacing={0}
            className="w-full"
            aria-label="Workspace panel"
          >
            <ToggleGroupItem value="canvas" className="flex-1 rounded-none">
              Palette
            </ToggleGroupItem>
            <ToggleGroupItem value="settings" className="flex-1 rounded-none">
              Settings
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <main className={cn("min-h-0 min-w-0 overflow-y-auto", pane === "settings" && "hidden lg:block")}>
          {!ready ? (
            <LoadingState />
          ) : generated.length === 0 ? (
            <div className="space-y-4 p-3 sm:p-4">
              <EmptyPalette onAdd={addHue} onAddBlank={addBlank} />
              <ExportPanel state={state} generated={generated} />
            </div>
          ) : (
            <div className="space-y-4 p-3 sm:p-4">
              <GuaranteeBanner report={report} rules={state.scale.rules} hueCount={generated.length} />
              <CanvasSection
                title="Palette"
                note={`Hues are columns, steps are rows. Each cell shows hex, WCAG ratio against ${state.reference.mode === "custom" ? referenceHex : state.reference.mode}, and OKLCH L C h. ΔL shows how evenly hues read at that step.`}
              >
                <PaletteGrid
                  generated={generated}
                  space={state.space}
                  referenceHex={referenceHex}
                  selectedHueId={selected?.hue.id ?? null}
                  onSelect={select}
                  addColumn={<AddHueMenu variant="column" onAdd={addHue} onAddBlank={addBlank} />}
                />
              </CanvasSection>
              {selected ? (
                <CanvasSection title={`Curves for ${selected.hue.name || "this hue"}`} note="Click a column name in the grid to inspect another hue.">
                  <HueVisuals generated={selected} space={state.space} scale={state.scale} />
                </CanvasSection>
              ) : null}
              <CanvasSection
                title="Contrast checks"
                note="Every cell is checked against the magic-number rules. A pass means the gap was promised and delivered."
              >
                <ContrastMatrix generated={generated} rules={state.scale.rules} selectedHueId={selected?.hue.id ?? null} />
              </CanvasSection>
              <CanvasSection title="Export" note="Exported as final sRGB values. Every hue includes white (0) and black (1000).">
                <ExportPanel state={state} generated={generated} />
              </CanvasSection>
            </div>
          )}
        </main>

        <aside
          aria-label="Settings"
          className={cn("min-h-0 overflow-y-auto border-l border-border bg-card", pane === "canvas" && "hidden lg:block")}
        >
          <SettingsSection title="Colour space">
            <SpaceSettings space={state.space} onChange={setSpace} />
          </SettingsSection>

          <SettingsSection title={selected ? `Hue · ${selected.hue.name || "Unnamed"}` : "Hues"}>
            <AddFromColour onAdd={addFromColour} />
            {selected ? (
              <HueSettings
                key={selected.hue.id}
                generated={selected}
                space={state.space}
                scale={state.scale}
                onChange={(patch) => updateHue(selected.hue.id, patch)}
                onDuplicate={() => duplicate(selected.hue.id)}
                onRemove={() => remove(selected.hue.id)}
              />
            ) : (
              <p className="text-xs text-muted-foreground">No hues yet. Add one from a colour above, or use Add hue in the header.</p>
            )}
          </SettingsSection>

          <SettingsSection title="Steps and reference">
            <StepsSettings scale={state.scale} onChange={setScale} />
            <ReferenceSettings reference={state.reference} onChange={setReference} />
          </SettingsSection>

          <SettingsSection title="Magic numbers">
            <RulesSettings scale={state.scale} onChange={setScale} />
          </SettingsSection>

          <SettingsSection title="Target contrast curve" status={targetIssues > 0 ? "Breaks rules" : undefined}>
            <TargetCurve scale={state.scale} referenceY={referenceY} onChange={setScale} />
          </SettingsSection>

          <p className="border-t border-border p-4 text-[11px] leading-relaxed text-muted-foreground">
            Method: each step is solved to a WCAG relative-luminance target, then hue and chroma follow your curve in {SPACES[state.space].label}. Chroma that
            doesn&apos;t fit sRGB is reduced at constant lightness and hue. Contrast is verified on the final 8-bit hex values.
          </p>
        </aside>
      </div>
    </div>
  );
}

function CanvasSection({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

function SettingsSection({ title, status, children }: { title: string; status?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 border-b border-border p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold tracking-wide uppercase">{title}</h2>
        {status ? <span className="text-[11px] text-destructive">{status}</span> : null}
      </div>
      {children}
    </section>
  );
}

function SpaceSettings({ space, onChange }: { space: SpaceId; onChange: (s: SpaceId) => void }) {
  const def = SPACES[space];
  const items = SPACE_ORDER.map((id) => ({ value: id, label: SPACES[id].label }));
  return (
    <div className="space-y-2">
      <Select items={items} value={space} onValueChange={(v) => onChange(v as SpaceId)}>
        <SelectTrigger size="sm" className="w-full" aria-label="Colour space">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((i) => (
            <SelectItem key={i.value} value={i.value}>
              {i.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-[11px] text-muted-foreground">{def.description}</p>
      <p className="text-[11px] text-muted-foreground">
        Display gamut: sRGB (hex). Switching space keeps each hue&apos;s endpoint colours and changes how the scale travels between them.
      </p>
    </div>
  );
}

function AddFromColour({ onAdd }: { onAdd: (hex: string) => void }) {
  const [text, setText] = React.useState("#3b82f6");
  const parsed = parseHex(text);
  return (
    <form
      className="space-y-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (parsed) onAdd(parsed);
      }}
    >
      <p className="text-xs font-medium">Add a hue from a source colour</p>
      <div className="flex items-center gap-2">
        <Input
          type="color"
          aria-label="Pick a colour for a new hue"
          value={parsed ?? "#3b82f6"}
          onChange={(e) => setText(e.target.value)}
          className="h-8 w-10 shrink-0 cursor-pointer rounded-none p-0.5"
        />
        <Input
          aria-label="Hex colour for a new hue"
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-invalid={parsed ? undefined : true}
          className="h-8 font-mono text-xs"
        />
        <Button type="submit" size="sm" className="rounded-none" disabled={!parsed}>
          <Plus />
          Add
        </Button>
      </div>
      {!parsed ? <p className="text-[11px] text-destructive">Enter a hex colour such as #3b82f6.</p> : null}
    </form>
  );
}

function EmptyPalette({ onAdd, onAddBlank }: { onAdd: (p: HuePreset) => void; onAddBlank: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 border border-dashed border-border p-10 text-center">
      <div className="flex size-12 items-center justify-center bg-muted">
        <PaletteIcon className="size-6 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-semibold">Your palette is empty</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Add a hue to generate a full scale from white to black. Start from a preset, a blank hue, or a source colour in the settings panel.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {HUE_PRESETS.slice(0, 5).map((p) => (
          <Button key={p.key} variant="outline" size="sm" className="rounded-none" onClick={() => onAdd(p)}>
            <span className="size-3" style={{ backgroundColor: p.swatch }} />
            {p.name}
          </Button>
        ))}
        <AddHueMenu onAdd={onAdd} onAddBlank={onAddBlank} />
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4 p-4" aria-busy="true" aria-label="Loading your palette">
      <Skeleton className="h-10 w-full rounded-none" />
      <Skeleton className="h-96 w-full rounded-none" />
      <Skeleton className="h-60 w-full rounded-none" />
    </div>
  );
}

export { targetLuminance };
