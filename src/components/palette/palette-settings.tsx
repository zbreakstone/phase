"use client";

import * as React from "react";
import { Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";
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
  /** Deletes the saved palette and all its versions. Omitted when there is nothing saved to delete. */
  onDelete?: () => void;
  /** The palette's name, for the delete confirmation. */
  name?: string;
  /** The name being edited, which a saved palette takes on its next save. */
  paletteName: string;
  onPaletteName: (name: string) => void;
  /** Saves a copy of the palette. Omitted when there is nothing saved to copy. */
  onDuplicate?: () => void;
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
  onDelete,
  name,
  paletteName,
  onPaletteName,
  onDuplicate,
}: Props) {
  const [deleting, setDeleting] = React.useState(false);
  const label = name?.trim() || "this palette";
  return (
    <>
      <CollapsibleSection id="display" title="Settings" className="space-y-3">
        <SettingRow id="settings-name" label="Name">
          <Input
            id="settings-name"
            value={paletteName}
            maxLength={80}
            placeholder="Untitled palette"
            onChange={(e) => onPaletteName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
            }}
          />
        </SettingRow>
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
        {onDuplicate ? (
          <Button variant="outline" className="mt-3 w-full" onClick={onDuplicate}>
            <Copy />
            Duplicate {label}
          </Button>
        ) : null}
        {onDelete ? (
          <Button variant="destructive" className={onDuplicate ? "w-full" : "mt-3 w-full"} onClick={() => setDeleting(true)}>
            <Trash2 />
            Delete {label}
          </Button>
        ) : null}
      </CollapsibleSection>
      <ConfirmDeleteDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${label}?`}
        description={`This removes ${label} and all of its versions. This can't be undone.`}
        confirm="Delete palette"
        onConfirm={() => onDelete?.()}
      />
    </>
  );
}

/** The contrast rules, which live at the bottom of the palette sidebar. */
export function ContrastRulesSection({ scale, onScale }: { scale: ScaleConfig; onScale: (scale: ScaleConfig) => void }) {
  return (
    <CollapsibleSection id="rules" title="Rules">
      <RulesSettings scale={scale} onChange={onScale} />
    </CollapsibleSection>
  );
}
