"use client";

import * as React from "react";
import { Check, Eye, Layers, Plus, RotateCcw, SunMedium, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { parseHex } from "@/lib/color/convert";
import { VISIONS, type VisionId } from "@/lib/color/vision";
import { SPACES, SPACE_ORDER, type SpaceId } from "@/lib/color/spaces";
import { HUE_PRESETS, defaultState, hueFromPreset, hueFromSource, type HuePreset } from "@/lib/palette/defaults";
import { convertHue, generatePalette } from "@/lib/palette/generate";
import type { HueConfig, PaletteState, ScaleConfig } from "@/lib/palette/types";
import { validatePalette } from "@/lib/palette/validate";
import { getStorage } from "@/lib/storage";
import { ExportDialog } from "./export-dialog";
import { HelpTip } from "./fields";
import { HuePanel } from "./hue-panel";
import { PaletteGrid, displayHex, type Against, type Metric, type Overlay } from "./palette-grid";
import { ScaleDialog } from "./scale-dialog";

const AUTOSAVE_ID = "__autosave__";

export function PaletteApp() {
  const [state, setState] = React.useState<PaletteState>(() => defaultState());
  const [ready, setReady] = React.useState(false);
  const [grade, setGrade] = React.useState<number | null>(null);
  const [overlay, setOverlay] = React.useState<Overlay>({ metric: "contrast", against: "white", grayscale: false, vision: "normal" });
  const storage = React.useMemo(() => getStorage(), []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await storage.get(AUTOSAVE_ID);
        if (saved && !cancelled) setState(saved.state);
      } catch {
        // Storage can be unavailable (private mode); start from the default palette.
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
  const selected = generated.find((g) => g.hue.id === state.selectedHueId) ?? generated[0] ?? null;

  const setSpace = (space: SpaceId) =>
    setState((s) => (space === s.space ? s : { ...s, space, hues: s.hues.map((h) => convertHue(h, s.scale, s.space, space)) }));
  const setScale = (scale: ScaleConfig) => setState((s) => ({ ...s, scale }));
  const updateHue = (id: string, patch: Partial<HueConfig>) =>
    setState((s) => ({ ...s, hues: s.hues.map((h) => (h.id === id ? { ...h, ...patch } : h)) }));

  const uniqueName = (base: string, hues: HueConfig[]) => {
    let name = base;
    let n = 2;
    while (hues.some((h) => h.name.toLowerCase() === name.toLowerCase())) name = `${base} ${n++}`;
    return name;
  };

  const addPreset = (preset: HuePreset) =>
    setState((s) => {
      const hue = hueFromPreset(preset, s.space, s.scale, uniqueName(preset.name, s.hues));
      return { ...s, hues: [...s.hues, hue], selectedHueId: hue.id };
    });

  const addFromHex = (hex: string) =>
    setState((s) => {
      const draft = hueFromSource(hex, s.space);
      const hue = { ...draft, name: uniqueName(draft.name, s.hues) };
      return { ...s, hues: [...s.hues, hue], selectedHueId: hue.id };
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

  const reset = () => {
    setState(defaultState());
    setGrade(null);
    toast.success("Back to the starter palette");
  };

  const rules = [...state.scale.rules].sort((a, b) => a.minDiff - b.minDiff);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-[88rem] items-center gap-3 px-4">
          <div className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex size-6 items-center justify-center bg-primary text-primary-foreground">
              <Layers className="size-3.5" />
            </span>
            Phase
          </div>
          <div className="ml-2 flex items-center gap-1.5">
            <Select
              items={SPACE_ORDER.map((id) => ({ value: id, label: SPACES[id].label }))}
              value={state.space}
              onValueChange={(v) => setSpace(v as SpaceId)}
            >
              <SelectTrigger size="sm" className="w-32 rounded-none" aria-label="Colour space">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SPACE_ORDER.map((id) => (
                  <SelectItem key={id} value={id}>
                    {SPACES[id].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <HelpTip>{SPACES[state.space].description}</HelpTip>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ScaleDialog scale={state.scale} onChange={setScale} />
            <Button variant="ghost" size="sm" className="rounded-none" onClick={reset} aria-label="Reset to starter palette">
              <RotateCcw />
              <span className="hidden sm:inline">Reset</span>
            </Button>
            <ExportDialog state={state} generated={generated} />
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[88rem] flex-1 gap-8 p-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="min-w-0 space-y-3">
          {!ready ? (
            <div className="space-y-3" aria-busy="true" aria-label="Loading your palette">
              <Skeleton className="h-9 w-full rounded-none" />
              <Skeleton className="h-72 w-full rounded-none" />
            </div>
          ) : (
            <>
              <Toolbar overlay={overlay} onOverlay={setOverlay} onAddPreset={addPreset} onAddHex={addFromHex} />
              {generated.length === 0 ? (
                <div className="flex flex-col items-center gap-2 border border-dashed border-border p-12 text-center">
                  <p className="font-medium">No colours yet</p>
                  <p className="max-w-sm text-sm text-muted-foreground">Add a colour above. Type a hex or pick a preset and a full scale from white to black appears.</p>
                </div>
              ) : (
                <>
                  <PaletteGrid
                    generated={generated}
                    rules={state.scale.rules}
                    overlay={overlay}
                    selectedHueId={selected?.hue.id ?? null}
                    selectedGrade={grade}
                    onSelect={(id, g) => {
                      setState((s) => ({ ...s, selectedHueId: id }));
                      setGrade(g);
                    }}
                    onReorder={reorder}
                  />
                  {overlay.metric === "contrast" && overlay.against === "selected" && grade === null ? (
                    <p className="text-xs text-muted-foreground">Click a swatch to compare every other swatch against it.</p>
                  ) : null}
                  <p className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-xs ${report.failures.length ? "text-red-300" : "text-muted-foreground"}`}>
                    {report.failures.length === 0 ? <Check className="size-3.5 text-emerald-400" /> : <TriangleAlert className="size-3.5" />}
                    {rules.length === 0
                      ? "No contrast rules are set."
                      : report.failures.length === 0
                        ? `Any two steps ${rules.map((r) => `${r.minDiff}+ apart reach ${r.ratio}:1`).join(", ")}, for every hue.`
                        : `${report.failures.length} pair${report.failures.length === 1 ? "" : "s"} miss a rule (${rules.map((r) => `${r.minDiff}+ → ${r.ratio}:1`).join(", ")}). Compare against a selected swatch to see which.`}
                  </p>
                </>
              )}
            </>
          )}
        </section>

        <aside aria-label="Selected hue" className="min-w-0 lg:border-l lg:border-border lg:pl-8">
          {ready && selected ? (
            <HuePanel
              key={selected.hue.id}
              generated={selected}
              space={state.space}
              scale={state.scale}
              selectedGrade={grade}
              onSelectGrade={setGrade}
              onChange={(patch) => updateHue(selected.hue.id, patch)}
              onRemove={() => remove(selected.hue.id)}
              display={(hex) => displayHex(hex, overlay)}
            />
          ) : ready ? (
            <p className="text-sm text-muted-foreground">Add a colour to edit its hue and chroma here.</p>
          ) : null}
        </aside>
      </main>
    </div>
  );
}

function Toolbar({
  overlay,
  onOverlay,
  onAddPreset,
  onAddHex,
}: {
  overlay: Overlay;
  onOverlay: (o: Overlay) => void;
  onAddPreset: (p: HuePreset) => void;
  onAddHex: (hex: string) => void;
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
          <ToggleGroupItem value="contrast" className="rounded-none">Contrast</ToggleGroupItem>
          <ToggleGroupItem value="luminance" className="rounded-none">Luminance</ToggleGroupItem>
          <ToggleGroupItem value="off" className="rounded-none">Off</ToggleGroupItem>
        </ToggleGroup>
      </div>
      {overlay.metric === "contrast" ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">against</span>
          <ToggleGroup
            value={[overlay.against]}
            onValueChange={(v) => v[0] && onOverlay({ ...overlay, against: v[0] as Against })}
            variant="outline"
            size="sm"
            spacing={0}
            aria-label="Contrast against"
          >
            <ToggleGroupItem value="white" className="rounded-none">White</ToggleGroupItem>
            <ToggleGroupItem value="black" className="rounded-none">Black</ToggleGroupItem>
            <ToggleGroupItem value="selected" className="rounded-none">Selected</ToggleGroupItem>
          </ToggleGroup>
        </div>
      ) : null}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">View</span>
        <Toggle
          variant="outline"
          size="sm"
          className="rounded-none"
          pressed={overlay.grayscale}
          onPressedChange={(grayscale) => onOverlay({ ...overlay, grayscale })}
          aria-label="Show swatches as greys of equal luminance"
          title="Show each swatch as the grey with the same luminance, so you can check that steps line up across hues"
        >
          <SunMedium />
          Luminance
        </Toggle>
        <Select
          items={VISIONS.map((v) => ({ value: v.id, label: v.id === "normal" ? "Vision" : v.label }))}
          value={overlay.vision}
          onValueChange={(v) => v && onOverlay({ ...overlay, vision: v as VisionId, grayscale: false })}
        >
          <SelectTrigger size="sm" className="w-40 rounded-none" aria-label="Simulate colour vision">
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
      <div className="ml-auto">
        <AddColour onAddPreset={onAddPreset} onAddHex={onAddHex} />
      </div>
    </div>
  );
}

function AddColour({ onAddPreset, onAddHex }: { onAddPreset: (p: HuePreset) => void; onAddHex: (hex: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState("");
  const parsed = parseHex(text);
  const submit = () => {
    if (!parsed) return;
    onAddHex(parsed);
    setText("");
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="secondary" size="sm" className="rounded-none" />}>
        <Plus />
        Add colour
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3 rounded-none">
        <form
          className="space-y-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label htmlFor="add-hex" className="text-xs font-medium">
            From a hex colour
          </label>
          <div className="flex gap-2">
            <Input id="add-hex" placeholder="#3b82f6" value={text} onChange={(e) => setText(e.target.value)} aria-invalid={text && !parsed ? true : undefined} className="h-8 font-mono text-xs" />
            <Button type="submit" size="sm" className="rounded-none" disabled={!parsed}>
              Add
            </Button>
          </div>
          {text && !parsed ? <p className="text-[11px] text-destructive">Use a hex colour such as #3b82f6.</p> : null}
        </form>
        <div className="space-y-1.5">
          <p className="text-xs font-medium">Or a preset</p>
          <div className="grid grid-cols-3 gap-px bg-border">
            {HUE_PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => {
                  onAddPreset(p);
                  setOpen(false);
                }}
                className="flex items-center gap-1.5 bg-popover p-1.5 text-left text-xs hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span className="size-3 shrink-0" style={{ backgroundColor: p.swatch }} />
                {p.name}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

