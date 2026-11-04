"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  ColorPicker,
  ColorPickerArea,
  ColorPickerAreaThumb,
  ColorPickerInput,
  ColorPickerSlider,
} from "@/components/ui/color-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { parseHex } from "@/lib/color/convert";
import { HUE_PRESETS, type HuePreset } from "@/lib/palette/defaults";
import { SWATCH_GROUPS, type Swatch } from "@/lib/palette/swatches";
import { cn } from "@/lib/utils";

interface Props {
  onAddPreset: (preset: HuePreset) => void;
  onAddHex: (hex: string) => void;
  /** The element that opens the popover, e.g. `<button />`; its content is `children`. */
  render: React.ReactElement;
  children: React.ReactNode;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
}

/** "Presets" are the starter hues, which carry hand-tuned curves; the rest are plain colors. */
const GROUPS: { id: string; label: string; swatches: Swatch[] }[] = [
  { id: "presets", label: "Presets", swatches: HUE_PRESETS.map((p) => ({ name: p.name, hex: p.swatch })) },
  ...SWATCH_GROUPS,
];

const START = "#3b82f6";

/** Adds a color with a picker and a row of quick picks. Opens from wherever the color will land, so the choice stays next to the result. */
export function AddColorPopover({ onAddPreset, onAddHex, render, children, align = "start", side = "bottom" }: Props) {
  const [open, setOpen] = React.useState(false);
  const [hex, setHex] = React.useState(START);
  const [groupId, setGroupId] = React.useState("presets");
  const group = GROUPS.find((g) => g.id === groupId) ?? GROUPS[0];

  const set = (next: string) => {
    const parsed = parseHex(next);
    if (parsed && parsed.toLowerCase() !== hex.toLowerCase()) setHex(parsed.toLowerCase());
  };

  const submit = () => {
    // A starter hue keeps its tuned curves, as long as the color wasn't nudged afterwards.
    const preset = HUE_PRESETS.find((p) => p.swatch.toLowerCase() === hex.toLowerCase());
    if (preset) onAddPreset(preset);
    else onAddHex(hex);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={render}>{children}</PopoverTrigger>
      <PopoverContent align={align} side={side} className="w-72 space-y-3">
        <ColorPicker value={hex} format="hsba" onValueChange={(d) => set(d.value.toString("hex"))} className="flex-col gap-3">
          <ColorPickerArea className="h-32">
            <ColorPickerAreaThumb />
          </ColorPickerArea>
          <ColorPickerSlider channel="hue" />
          <div className="flex gap-2">
            <label className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg bg-white pl-2.5 shadow-(--shadow-default) focus-within:ring-2 focus-within:ring-ring dark:bg-input/30">
              <span className="text-xs text-muted-foreground">Hex</span>
              <ColorPickerInput
                aria-label="Hex"
                className="min-w-0 flex-1 bg-transparent pr-2.5 text-right font-mono text-xs uppercase outline-none"
              />
            </label>
          </div>
        </ColorPicker>

        <div className="space-y-2">
          <Select items={GROUPS.map((g) => ({ value: g.id, label: g.label }))} value={groupId} onValueChange={(v) => v && setGroupId(v)}>
            <SelectTrigger size="sm" className="w-full" aria-label="Quick picks">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GROUPS.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-9 gap-1">
            {group.swatches.map((sw) => (
              <button
                key={sw.hex}
                type="button"
                title={sw.name}
                aria-label={sw.name}
                aria-pressed={sw.hex.toLowerCase() === hex.toLowerCase()}
                onClick={() => set(sw.hex)}
                className={cn(
                  "aspect-square rounded-md ring-1 ring-foreground/15 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  "aria-pressed:ring-2 aria-pressed:ring-foreground aria-pressed:ring-offset-1 aria-pressed:ring-offset-popover",
                )}
                style={{ backgroundColor: sw.hex }}
              />
            ))}
          </div>
        </div>
        <Button className="w-full" onClick={submit}>
          Add
        </Button>
      </PopoverContent>
    </Popover>
  );
}
