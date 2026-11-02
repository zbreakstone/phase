"use client";

import * as React from "react";
import { ChevronDown, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GAMUTS, GAMUT_ORDER, type Gamut } from "@/lib/color/gamut";
import { SPACES, SPACE_ORDER, type SpaceId } from "@/lib/color/spaces";
import type { ScaleConfig } from "@/lib/palette/types";
import { applyTheme, readTheme, subscribeTheme, THEME_EVENT, THEME_KEY, type Theme } from "@/lib/theme";
import { PanelSection, SettingRow } from "./panel-section";
import { RulesSettings } from "./scale-settings";

interface Props {
  space: SpaceId;
  gamut: Gamut;
  scale: ScaleConfig;
  onSpace: (space: SpaceId) => void;
  onGamut: (gamut: Gamut) => void;
  onScale: (scale: ScaleConfig) => void;
  /** Replaces everything with the starter palette. Recorded in the undo history. */
  onReset: () => void;
}

const THEMES: { id: Theme; label: string }[] = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

/** A select whose options each explain themselves, so the sidebar doesn't need paragraphs under it. */
function DescribedSelect<T extends string>({ id, value, options, onChange }: { id: string; value: T; options: { id: T; label: string; description?: string }[]; onChange: (v: T) => void }) {
  return (
    <Select items={options.map((o) => ({ value: o.id, label: o.label }))} value={value} onValueChange={(v) => onChange(v as T)}>
      <SelectTrigger id={id} size="sm" className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="min-w-64">
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            <span className="flex flex-col">
              <span>{o.label}</span>
              {o.description ? <span className="max-w-60 text-[11px] whitespace-normal text-muted-foreground">{o.description}</span> : null}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** The settings you pick once per project: how colors are computed, which screens they target, and the contrast rules. */
export function PaletteSettings({ space, gamut, scale, onSpace, onGamut, onScale, onReset }: Props) {
  const [confirming, setConfirming] = React.useState(false);
  const theme = React.useSyncExternalStore(subscribeTheme, readTheme, () => "system" as Theme);

  React.useEffect(() => {
    if (theme !== "system") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => applyTheme("system");
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, [theme]);

  const pickTheme = (next: Theme) => {
    try {
      if (next === "system") window.localStorage.removeItem(THEME_KEY);
      else window.localStorage.setItem(THEME_KEY, next);
    } catch {
      // Private mode: the choice just won't survive a reload.
    }
    applyTheme(next);
    window.dispatchEvent(new Event(THEME_EVENT));
  };

  return (
    <>
      <PanelSection className="space-y-3">
        <SettingRow id="settings-space" label="Color space">
          <DescribedSelect id="settings-space" value={space} onChange={onSpace} options={SPACE_ORDER.map((id) => ({ id, label: SPACES[id].label, description: SPACES[id].description }))} />
        </SettingRow>
        <SettingRow id="settings-gamut" label="Gamut">
          <DescribedSelect id="settings-gamut" value={gamut} onChange={onGamut} options={GAMUT_ORDER.map((id) => ({ id, label: GAMUTS[id].label, description: GAMUTS[id].description }))} />
        </SettingRow>
        <SettingRow id="settings-theme" label="Theme">
          <DescribedSelect id="settings-theme" value={theme} onChange={pickTheme} options={THEMES} />
        </SettingRow>
      </PanelSection>

      <PanelSection>
        <details className="group">
          <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between text-sm text-muted-foreground hover:text-foreground">
            <span>
              Contrast rules <span className="tabular-nums">({scale.rules.length})</span>
            </span>
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="pt-3">
            <RulesSettings scale={scale} onChange={onScale} />
          </div>
        </details>
      </PanelSection>

      <PanelSection className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Start over</p>
        <Button variant="destructive" size="sm" className="shrink-0" onClick={() => setConfirming(true)}>
          <RotateCcw />
          Reset
        </Button>
      </PanelSection>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset to the starter palette?</DialogTitle>
            <DialogDescription>
              This replaces your current colors, steps, tweaks and contrast rules. Your saved palettes aren&apos;t touched, and you can undo it right after with ⌘Z.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirming(false);
                onReset();
              }}
            >
              Reset palette
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
