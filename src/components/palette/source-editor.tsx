"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ColorPicker,
  ColorPickerArea,
  ColorPickerAreaThumb,
  ColorPickerContent,
  ColorPickerControl,
  ColorPickerInput,
  ColorPickerSlider,
  ColorPickerTrigger,
  ColorPickerView,
} from "@/components/ui/color-picker";
import { SettingRow } from "./panel-section";
import { Switch } from "@/components/ui/switch";
import { parseHex } from "@/lib/color/convert";
import { readableOn } from "@/lib/color/contrast";
import type { SourceAnalysis } from "@/lib/palette/source";
import type { SourceColor } from "@/lib/palette/types";

interface Props {
  source: SourceColor | null | undefined;
  analysis: SourceAnalysis | null;
  onChange: (source: SourceColor | null) => void;
}

export function SourceEditor({ source, analysis, onChange }: Props) {
  const hex = source?.hex ?? "";

  const apply = (text: string) => {
    const parsed = parseHex(text);
    if (parsed) {
      onChange({ grade: source?.grade ?? null, pinned: source?.pinned ?? false, hex: parsed });
    }
  };

  return (
    <div className="space-y-3">
      <SettingRow label="Base color">
        <div className="flex h-8 w-full items-center rounded-lg bg-white shadow-(--shadow-default) hover:shadow-(--shadow-large) dark:bg-input/30 focus-within:ring-2 focus-within:ring-ring">
          <ColorPicker
            value={hex || "#3b82f6"}
            format="hsba"
            onValueChange={(d) => {
              const next = d.value.toString("hex").toLowerCase();
              if (next !== hex.toLowerCase()) apply(next);
            }}
            className="min-w-0 flex-1"
          >
            <ColorPickerControl className="h-full">
              <ColorPickerTrigger
                aria-label="Pick a base color"
                className="flex h-full min-w-0 flex-1 items-center gap-2 rounded-lg pr-1 pl-1.5 text-left outline-none"
              >
                <span className="size-5 shrink-0 rounded-md ring-1 ring-foreground/15" style={{ backgroundColor: hex || undefined }} />
                <span className={cn("min-w-0 flex-1 truncate font-mono text-xs uppercase", !hex && "text-muted-foreground normal-case")}>
                  {hex ? hex.replace(/^#/, "") : "Add color"}
                </span>
              </ColorPickerTrigger>
            </ColorPickerControl>
            <ColorPickerContent>
              <ColorPickerArea>
                <ColorPickerAreaThumb />
              </ColorPickerArea>
              <ColorPickerView format="hsba">
                <ColorPickerSlider channel="hue" />
              </ColorPickerView>
              <label className="flex h-8 items-center gap-2 rounded-lg bg-white pl-2.5 shadow-(--shadow-default) focus-within:ring-2 focus-within:ring-ring dark:bg-input/30">
                <span className="text-xs text-muted-foreground">Hex</span>
                <ColorPickerInput
                  aria-label="Hex"
                  className="min-w-0 flex-1 bg-transparent pr-2.5 text-left font-mono text-xs uppercase outline-none"
                />
              </label>
            </ColorPickerContent>
          </ColorPicker>
          {source ? (
            <Button variant="ghost" size="icon-sm" className="mr-1 size-6" aria-label="Remove base color" onClick={() => onChange(null)}>
              <X />
            </Button>
          ) : null}
        </div>
      </SettingRow>

      {source && analysis ? (
        <>
          <div className="flex h-12">
            <Block hex={analysis.original.hex} label="You entered" />
            <Block hex={analysis.pinned ? analysis.original.hex : analysis.adjusted.hex} label={analysis.pinned ? "Kept as is" : `Step ${analysis.grade}`} />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {analysis.pinned
              ? analysis.onStep
                ? `Sits on step ${analysis.grade} already.`
                : `Kept exactly on step ${analysis.grade}, ${analysis.shift.toFixed(2)}:1 off its luminance. Rule checks may fail.`
              : analysis.onStep
                ? `Already on step ${analysis.grade}.`
                : `Moved to step ${analysis.grade} by changing lightness only. Hue and chroma are kept.`}
          </p>
          <SettingRow id="pin" label="Keep exact color">
            <Switch id="pin" checked={source.pinned} onCheckedChange={(v) => onChange({ ...source, pinned: v })} />
          </SettingRow>
        </>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Enter a color and the scale is built around it, snapped to the nearest step.
        </p>
      )}
    </div>
  );
}

function Block({ hex, label }: { hex: string; label: string }) {
  return (
    <div className="flex flex-1 flex-col justify-between p-1.5 font-mono text-[10px] leading-tight" style={{ backgroundColor: hex, color: readableOn(hex) }}>
      <span className="font-sans text-[10px] opacity-80">{label}</span>
      <span>{hex}</span>
    </div>
  );
}
