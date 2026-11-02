"use client";

import { Button } from "@/components/ui/button";
import { PopoverDescription, PopoverHeader, PopoverTitle } from "@/components/ui/popover";
import { cssColor, type Gamut } from "@/lib/color/gamut";
import type { Shade, StepTweak } from "@/lib/palette/types";
import { SliderField } from "./fields";

/**
 * What opens when you click a swatch: nudge that one step's hue or colorfulness. It lives on the
 * swatch itself, so the sliders sit next to the color they change.
 */
export function StepTuner({
  idPrefix,
  hueName,
  shade,
  gamut,
  tweak,
  tweakedCount,
  onTweak,
  onResetStep,
  onResetAll,
}: {
  idPrefix: string;
  hueName: string;
  shade: Shade;
  gamut: Gamut;
  tweak: StepTweak;
  /** How many steps of this color are nudged, counting this one. */
  tweakedCount: number;
  onTweak: (patch: Partial<StepTweak>) => void;
  onResetStep: () => void;
  onResetAll: () => void;
}) {
  const here = tweak.dh !== 0 || tweak.dc !== 0;
  const others = tweakedCount - (here ? 1 : 0);

  return (
    <>
      <PopoverHeader>
        <PopoverTitle className="flex items-center gap-2">
          <span aria-hidden className="size-3.5 shrink-0 ring-1 ring-foreground/20" style={{ backgroundColor: cssColor(shade.hex, shade.linear, gamut) }} />
          {hueName} {shade.grade}
        </PopoverTitle>
        <PopoverDescription className="text-xs">
          Nudge this step without moving its neighbors. Lightness doesn&apos;t change, so it keeps its contrast.
        </PopoverDescription>
      </PopoverHeader>
      <SliderField id={`${idPrefix}-hue`} label="Hue shift" value={tweak.dh} min={-60} max={60} step={1} unit="°" onChange={(v) => onTweak({ dh: v })} />
      <SliderField
        id={`${idPrefix}-chroma`}
        label="Colorfulness"
        value={Math.round(tweak.dc * 100)}
        min={-100}
        max={100}
        step={5}
        unit="%"
        onChange={(v) => onTweak({ dc: v / 100 })}
      />
      {shade.clipped ? (
        <p className="text-[11px] text-muted-foreground">This step is already at the most color the screen can show, so more colorfulness has no effect.</p>
      ) : null}
      {here || others > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2.5">
          <Button variant="outline" size="sm" className="rounded-none" disabled={!here} onClick={onResetStep}>
            Reset this step
          </Button>
          {others > 0 ? (
            <Button variant="ghost" size="sm" className="rounded-none" onClick={onResetAll}>
              Reset all {tweakedCount} in {hueName}
            </Button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
