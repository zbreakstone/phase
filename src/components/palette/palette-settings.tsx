"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GAMUTS, GAMUT_ORDER, type Gamut } from "@/lib/color/gamut";
import { SPACES, SPACE_ORDER, type SpaceId } from "@/lib/color/spaces";
import type { ScaleConfig } from "@/lib/palette/types";
import {
  applyTheme,
  readTheme,
  subscribeTheme,
  THEME_EVENT,
  THEME_KEY,
  type Theme,
} from "@/lib/theme";
import { CollapsibleSection, SettingRow } from "./panel-section";
import { RulesSettings } from "./scale-settings";

interface Props {
  space: SpaceId;
  gamut: Gamut;
  scale: ScaleConfig;
  onSpace: (space: SpaceId) => void;
  onGamut: (gamut: Gamut) => void;
  onScale: (scale: ScaleConfig) => void;
  /** Replaces everything with the starter palette. Recorded in the undo history. */
  /** More display rows, shown in the same group as color space / gamut / theme. */
  display?: React.ReactNode;
}

const THEMES: { id: Theme; label: string }[] = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

/** A select whose options each explain themselves, so the sidebar doesn't need paragraphs under it. */
function DescribedSelect<T extends string>({
  id,
  value,
  options,
  onChange,
}: {
  id: string;
  value: T;
  options: { id: T; label: string; description?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <Select
      items={options.map((o) => ({ value: o.id, label: o.label }))}
      value={value}
      onValueChange={(v) => onChange(v as T)}
    >
      <SelectTrigger id={id} size="sm" className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="min-w-64">
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            <span className="flex flex-col">
              <span>{o.label}</span>
              {o.description ? (
                <span className="max-w-60 text-[11px] whitespace-normal text-muted-foreground">
                  {o.description}
                </span>
              ) : null}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** The settings you pick once per project: how colors are computed, which screens they target, and the contrast rules. */
export function PaletteSettings({
  space,
  gamut,
  scale,
  onSpace,
  onGamut,
  onScale,
  display,
}: Props) {
  const theme = React.useSyncExternalStore(
    subscribeTheme,
    readTheme,
    () => "system" as Theme,
  );

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
      // Private mode: the choice applies now but won't survive a reload.
      toast.message("Couldn't remember your theme choice for next time.", { id: "theme-save" });
    }
    applyTheme(next);
    window.dispatchEvent(new Event(THEME_EVENT));
  };

  return (
    <>
      <CollapsibleSection id="display" title="Display" className="space-y-3">
        <SettingRow id="settings-space" label="Color space">
          <DescribedSelect
            id="settings-space"
            value={space}
            onChange={onSpace}
            options={SPACE_ORDER.map((id) => ({
              id,
              label: SPACES[id].label,
              description: SPACES[id].description,
            }))}
          />
        </SettingRow>
        <SettingRow id="settings-gamut" label="Gamut">
          <DescribedSelect
            id="settings-gamut"
            value={gamut}
            onChange={onGamut}
            options={GAMUT_ORDER.map((id) => ({
              id,
              label: GAMUTS[id].label,
              description: GAMUTS[id].description,
            }))}
          />
        </SettingRow>
        <SettingRow id="settings-theme" label="Theme">
          <DescribedSelect
            id="settings-theme"
            value={theme}
            onChange={pickTheme}
            options={THEMES}
          />
        </SettingRow>
        {display}
      </CollapsibleSection>

      <CollapsibleSection
        id="rules"
        title={
          <>
            Contrast rules{" "}
            <span className="font-normal text-muted-foreground tabular-nums">
              ({scale.rules.length})
            </span>
          </>
        }
        defaultOpen={false}
      >
        <RulesSettings scale={scale} onChange={onScale} />
      </CollapsibleSection>
    </>
  );
}
