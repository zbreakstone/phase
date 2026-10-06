"use client";

import * as React from "react";
import { Layers, Link2, Palette as PaletteIcon, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SPACES, SPACE_ORDER, type SpaceId } from "@/lib/color/spaces";
import { HUE_PRESETS, defaultState, hueFromPreset, uid, type HuePreset } from "@/lib/palette/defaults";
import { convertHue, generatePalette } from "@/lib/palette/generate";
import { decodeState, encodeState } from "@/lib/palette/serialize";
import { checkTargets } from "@/lib/palette/scale";
import type { HueConfig, PaletteState, ScaleConfig } from "@/lib/palette/types";
import { validatePalette } from "@/lib/palette/validate";
import { getStorage } from "@/lib/storage";
import { ContrastMatrix } from "./contrast-matrix";
import { ExportPanel } from "./export-panel";
import { SectionHeading } from "./fields";
import { GuaranteeBanner } from "./guarantee-banner";
import { AddHueMenu, HueEditor } from "./hue-editor";
import { AUTOSAVE_ID, SavedDialog } from "./saved-dialog";
import { ScalePanel } from "./scale-panel";
import { SwatchGrid } from "./swatch-grid";

const NAV = [
  { href: "#palette", label: "Palette" },
  { href: "#hues", label: "Hues" },
  { href: "#scale", label: "Scale" },
  { href: "#contrast", label: "Contrast" },
  { href: "#export", label: "Export" },
];

export function PaletteApp() {
  const [state, setState] = React.useState<PaletteState>(() => defaultState());
  const [ready, setReady] = React.useState(false);
  const storage = React.useMemo(() => getStorage(), []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const hash = window.location.hash;
      const m = /[#&]p=([^&]+)/.exec(hash);
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
      storage
        .save({ id: AUTOSAVE_ID, name: "Autosave", updatedAt: Date.now(), state })
        .catch(() => undefined);
    }, 400);
    return () => clearTimeout(t);
  }, [state, ready, storage]);

  const generated = React.useMemo(() => generatePalette(state.space, state.scale, state.hues), [state.space, state.scale, state.hues]);
  const report = React.useMemo(() => validatePalette(generated, state.scale.rules), [generated, state.scale.rules]);
  const targetIssues = React.useMemo(() => checkTargets(state.scale).length, [state.scale]);
  const selected = generated.find((g) => g.hue.id === state.selectedHueId) ?? generated[0] ?? null;

  const setSpace = (space: SpaceId) =>
    setState((s) => {
      if (space === s.space) return s;
      return { ...s, space, hues: s.hues.map((h) => convertHue(h, s.scale, s.space, space)) };
    });

  const setScale = (scale: ScaleConfig) => setState((s) => ({ ...s, scale }));

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
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-4 px-4 sm:px-6">
          <a href="#top" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex size-7 items-center justify-center rounded-md bg-foreground text-background">
              <Layers className="size-4" />
            </span>
            Phase
          </a>
          <nav aria-label="Sections" className="ml-2 hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                {n.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <SavedDialog state={state} onOpen={(s) => setState(s)} />
            <Button variant="outline" size="sm" onClick={share}>
              <Link2 />
              <span className="hidden sm:inline">Share link</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={reset} aria-label="Reset to starter palette">
              <RotateCcw />
              <span className="hidden lg:inline">Reset</span>
            </Button>
          </div>
        </div>
        <nav aria-label="Sections" className="flex gap-1 overflow-x-auto border-t px-4 py-1 md:hidden">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="shrink-0 rounded-md px-2.5 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
              {n.label}
            </a>
          ))}
        </nav>
      </header>

      <main id="top" className="mx-auto w-full max-w-7xl flex-1 space-y-12 px-4 py-8 sm:px-6 sm:py-10">
        <section className="space-y-6">
          <div className="max-w-3xl space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Colour scales where the numbers guarantee contrast
            </h1>
            <p className="text-base text-muted-foreground text-pretty">
              Every shade is solved to a luminance target in a perceptually uniform colour space. Grade 30 and grade 80 of any hue are
              always as far apart as grade 30 and grade 80 of any other, so you can swap hues without re-checking contrast.
            </p>
          </div>
          <SpacePicker space={state.space} onChange={setSpace} />
        </section>

        {!ready ? (
          <LoadingState />
        ) : (
          <>
            <section className="space-y-5">
              <SectionHeading id="palette" eyebrow="1 · Palette" title="Your scales">
                Click a name to edit that hue. Click any swatch to copy its hex. A scissors icon means the requested chroma doesn&apos;t exist at that luminance, so it was reduced to fit sRGB.
              </SectionHeading>
              {generated.length === 0 ? (
                <EmptyPalette onAdd={addHue} onAddBlank={addBlank} />
              ) : (
                <>
                  <GuaranteeBanner report={report} rules={state.scale.rules} hueCount={generated.length} />
                  <Card>
                    <CardContent>
                      <SwatchGrid
                        generated={generated}
                        space={state.space}
                        selectedHueId={selected?.hue.id ?? null}
                        onSelect={(id) => setState((s) => ({ ...s, selectedHueId: id }))}
                      />
                    </CardContent>
                  </Card>
                </>
              )}
            </section>

            {generated.length > 0 ? (
              <>
                <section className="space-y-5">
                  <SectionHeading id="hues" eyebrow="2 · Hues" title="Shape each hue between its two ends">
                    Luminance is fixed by the scale, so a hue only decides what colour you get at each grade. Choose where the lightest and darkest shades sit on the colour wheel and the rest are blended between them.
                  </SectionHeading>
                  <Card>
                    <CardContent>
                      <HueEditor
                        generated={generated}
                        selected={selected}
                        space={state.space}
                        scale={state.scale}
                        onSelect={(id) => setState((s) => ({ ...s, selectedHueId: id }))}
                        onChange={updateHue}
                        onAdd={addHue}
                        onAddBlank={addBlank}
                        onDuplicate={duplicate}
                        onRemove={remove}
                      />
                    </CardContent>
                  </Card>
                </section>

                <section className="space-y-5">
                  <SectionHeading id="scale" eyebrow="3 · Scale" title="Luminance targets and magic numbers">
                    {targetIssues > 0
                      ? "Your custom luminance targets currently break a rule, see below."
                      : "Choose which grades exist, how much contrast each gap must give, and where each grade sits in luminance."}
                  </SectionHeading>
                  <ScalePanel scale={state.scale} onChange={setScale} />
                </section>

                <section className="space-y-5">
                  <SectionHeading id="contrast" eyebrow="4 · Contrast" title="Check every pairing">
                    Pick any two hues. Cells are marked against your magic-number rules, so a pass means &ldquo;this gap was promised and delivered&rdquo;, not just &ldquo;looks readable&rdquo;.
                  </SectionHeading>
                  <Card>
                    <CardContent>
                      <ContrastMatrix generated={generated} rules={state.scale.rules} selectedHueId={selected?.hue.id ?? null} />
                    </CardContent>
                  </Card>
                </section>
              </>
            ) : null}

            <section className="space-y-5">
              <SectionHeading id="export" eyebrow="5 · Export" title="Take it into your codebase">
                Colours are exported as final sRGB values, already inside the gamut and checked against your rules.
              </SectionHeading>
              <Card>
                <CardContent>
                  <ExportPanel state={state} generated={generated} />
                </CardContent>
              </Card>
            </section>
          </>
        )}
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-1 px-4 py-6 text-sm text-muted-foreground sm:px-6">
          <p>
            Phase builds contrast-guaranteed scales using the magic-number idea from the U.S. Web Design System, Stripe&apos;s accessible colour work and Envoy&apos;s write-up of both.
          </p>
          <p>Contrast is WCAG 2 relative luminance. APCA values are shown for reference only.</p>
        </div>
      </footer>
    </div>
  );
}

function SpacePicker({ space, onChange }: { space: SpaceId; onChange: (s: SpaceId) => void }) {
  const def = SPACES[space];
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Colour space</p>
      <div className="overflow-x-auto pb-1">
        <ToggleGroup
          value={[space]}
          onValueChange={(v) => v[0] && onChange(v[0] as SpaceId)}
          variant="outline"
          spacing={0}
          aria-label="Colour space"
        >
          {SPACE_ORDER.map((id) => (
            <ToggleGroupItem key={id} value={id} className="px-3">
              {SPACES[id].label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <p className="max-w-3xl text-sm text-muted-foreground text-pretty">{def.description}</p>
      <p className="max-w-3xl text-xs text-muted-foreground text-pretty">
        Switching space keeps your endpoint colours and regenerates how the scale travels between them.
      </p>
    </div>
  );
}

function EmptyPalette({ onAdd, onAddBlank }: { onAdd: (p: HuePreset) => void; onAddBlank: () => void }) {
  return (
    <Card className="border-dashed">
      <CardHeader className="items-center text-center">
        <div className="mb-1 flex size-12 items-center justify-center rounded-full bg-muted">
          <PaletteIcon className="size-6 text-muted-foreground" />
        </div>
        <CardTitle>Your palette is empty</CardTitle>
        <CardDescription className="max-w-md">
          Add a hue to generate a full scale from white to black. Start from a preset and adjust the endpoints, or begin with a blank hue.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-center gap-2">
        {HUE_PRESETS.slice(0, 5).map((p) => (
          <Button key={p.key} variant="outline" size="sm" onClick={() => onAdd(p)}>
            <span className="size-3 rounded-full ring-1 ring-black/20" style={{ backgroundColor: p.swatch }} />
            {p.name}
          </Button>
        ))}
        <AddHueMenu onAdd={onAdd} onAddBlank={onAddBlank} />
      </CardContent>
    </Card>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading your palette">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}
