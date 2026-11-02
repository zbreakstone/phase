"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apcaContrastLinear, contrastFromLuminance } from "@/lib/color/contrast";
import { type Gamut, cssColor } from "@/lib/color/gamut";
import type { RGB } from "@/lib/color/convert";
import type { GeneratedHue, Shade, StepTweak } from "@/lib/palette/types";
import { Crumbs } from "./crumbs";
import { SliderField } from "./fields";
import { PanelSection } from "./panel-section";
import { ResetTweaksDialog } from "./reset-tweaks-dialog";

interface Props {
  generated: GeneratedHue;
  shade: Shade;
  gamut: Gamut;
  tweak: StepTweak;
  onTweak: (patch: Partial<StepTweak>) => void;
  onResetStep: () => void;
  onResetAll: () => void;
  onBackToColors: () => void;
  onBackToHue: () => void;
  /** Open the neighboring step, or null at either end. */
  onPrevious: (() => void) | null;
  onNext: (() => void) | null;
}

const WHITE: RGB = [1, 1, 1];
const BLACK: RGB = [0, 0, 0];

/** One step of one color: its values to copy and read, and the nudge controls for that step. */
export function StepPanel({ generated, shade, gamut, tweak, onTweak, onResetStep, onResetAll, onBackToColors, onBackToHue, onPrevious, onNext }: Props) {
  const hue = generated.hue;
  const name = hue.name || "Unnamed";
  const css = cssColor(shade.hex, shade.linear, gamut);
  const here = tweak.dh !== 0 || tweak.dc !== 0;
  const tuned = generated.shades.filter((s) => s.tweaked).length;
  const others = tuned - (here ? 1 : 0);
  const [confirming, setConfirming] = React.useState(false);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Copied ${text}`);
    } catch {
      toast.message("Couldn't copy. Select the value and copy it by hand.");
    }
  };

  const rows: { label: string; value: string; copy?: string }[] = [
    { label: "Hex", value: shade.hex, copy: shade.hex },
    ...(gamut === "p3" ? [{ label: "Display P3", value: css, copy: css }] : []),
    { label: "OKLCH", value: `${shade.oklch.L.toFixed(3)} ${shade.oklch.C.toFixed(3)} ${Math.round(shade.oklch.h)}°`, copy: `oklch(${shade.oklch.L.toFixed(3)} ${shade.oklch.C.toFixed(3)} ${Math.round(shade.oklch.h)})` },
    { label: "Luminance", value: shade.luminance.toFixed(3) },
    { label: "On white", value: `${contrastFromLuminance(1, shade.luminance).toFixed(2)}:1 · Lc ${Math.round(Math.abs(apcaContrastLinear(WHITE, shade.linear)))}` },
    { label: "On black", value: `${contrastFromLuminance(0, shade.luminance).toFixed(2)}:1 · Lc ${Math.round(Math.abs(apcaContrastLinear(BLACK, shade.linear)))}` },
  ];

  return (
    <>
      <PanelSection className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Crumbs items={[{ label: "Colors", onClick: onBackToColors }, { label: name, onClick: onBackToHue }, { label: String(shade.grade) }]} />
        <div className="flex shrink-0 items-center">
          <Button variant="ghost" size="icon-sm" aria-label="Previous step" title="Previous step" disabled={!onPrevious} onClick={() => onPrevious?.()}>
            <ChevronLeft />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Next step" title="Next step" disabled={!onNext} onClick={() => onNext?.()}>
            <ChevronRight />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span aria-hidden className="size-10 shrink-0 rounded-lg ring-1 ring-foreground/15" style={{ backgroundColor: css }} />
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold">
            {name} {shade.grade}
          </h2>
          <p className="text-[11px] text-muted-foreground">
            {shade.anchor ? "White and black are fixed, so there's nothing to tune." : shade.isSource ? "Your base color landed here." : "Nudge this step without moving its neighbors."}
          </p>
        </div>
      </div>

      </PanelSection>

      <PanelSection>
      <dl className="divide-y divide-border text-xs">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-3 py-1.5">
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd className="flex min-w-0 items-center gap-1.5 font-mono tabular-nums">
              <span className="truncate">{r.value}</span>
              {r.copy ? (
                <button
                  type="button"
                  aria-label={`Copy ${r.label}`}
                  title={`Copy ${r.label}`}
                  onClick={() => copy(r.copy as string)}
                  className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <Copy className="size-3" />
                </button>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
      </PanelSection>

      {!shade.anchor ? (
        <PanelSection className="space-y-3">
          <div className="space-y-0.5">
            <h3 className="text-sm font-semibold">Tune this step</h3>
            <p className="text-[11px] text-muted-foreground">Lightness doesn&apos;t change, so it keeps its contrast.</p>
          </div>
          <SliderField id={`tune-hue-${shade.grade}`} label="Hue shift" value={tweak.dh} min={-60} max={60} step={1} unit="°" onChange={(v) => onTweak({ dh: v })} />
          <SliderField id={`tune-chroma-${shade.grade}`} label="Colorfulness" value={Math.round(tweak.dc * 100)} min={-100} max={100} step={5} unit="%" onChange={(v) => onTweak({ dc: v / 100 })} />
          {shade.clipped ? <p className="text-[11px] text-muted-foreground">This step is already at the most color the screen can show, so more colorfulness has no effect.</p> : null}
          {here || others > 0 ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button variant="outline" size="sm" disabled={!here} onClick={onResetStep}>
                Reset this step
              </Button>
              {others > 0 ? (
                <Button variant="destructive" size="sm" onClick={() => setConfirming(true)}>
                  Reset all {tuned} in {name}
                </Button>
              ) : null}
            </div>
          ) : null}
        </PanelSection>
      ) : null}

      <ResetTweaksDialog open={confirming} onOpenChange={setConfirming} name={name} count={tuned} onConfirm={onResetAll} />
    </>
  );
}
