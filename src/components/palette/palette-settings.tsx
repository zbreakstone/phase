"use client";

import * as React from "react";
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
import { CollapsibleSection, SettingRow } from "./panel-section";
import { RulesSettings } from "./scale-settings";

interface Props {
  space: SpaceId;
  gamut: Gamut;
  onSpace: (space: SpaceId) => void;
  onGamut: (gamut: Gamut) => void;
  /** Replaces everything with the starter palette. Recorded in the undo history. */
  /** More display rows, shown in the same group as color space / gamut / theme. */
  display?: React.ReactNode;
}

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

/** The settings you pick once per project: how colors are computed and which screens they target. */
export function PaletteSettings({
  space,
  gamut,
  onSpace,
  onGamut,
  display,
}: Props) {
  return (
    <>
      <CollapsibleSection id="display" title="Settings" className="space-y-3">
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
        {display}
      </CollapsibleSection>
    </>
  );
}

/** The contrast rules, which live at the bottom of the palette sidebar. */
export function ContrastRulesSection({ scale, onScale }: { scale: ScaleConfig; onScale: (scale: ScaleConfig) => void }) {
  return (
    <CollapsibleSection id="rules" title="Contrast rules" count={scale.rules.length} defaultOpen={false}>
      <RulesSettings scale={scale} onChange={onScale} />
    </CollapsibleSection>
  );
}
