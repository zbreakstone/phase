"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseStepName } from "@/lib/palette/steps";
import {
  apcaContrastLinear,
  contrastFromLuminance,
} from "@/lib/color/contrast";
import { type Gamut, cssColor } from "@/lib/color/gamut";
import type { RGB } from "@/lib/color/convert";
import { solveForLuminance } from "@/lib/color/solve";
import { SPACES } from "@/lib/color/spaces";
import type { GeneratedHue, Shade, StepTweak } from "@/lib/palette/types";
import { SliderField } from "./fields";
import { CollapsibleSection, SettingRow } from "./panel-section";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";
import { ResetTweaksDialog } from "./reset-tweaks-dialog";
import { Hint } from "./hint";
import type { StepHeaderActions } from "./step-header";

interface Props {
  generated: GeneratedHue;
  shade: Shade;
  gamut: Gamut;
  tweak: StepTweak;
  onTweak: (patch: Partial<StepTweak>) => void;
  onResetStep: () => void;
  onResetAll: () => void;
  /** Open the neighboring step, or null at either end. */
  onPrevious: (() => void) | null;
  onNext: (() => void) | null;
  /** Rename and delete for this step, which changes it in every color. */
  stepActions: StepHeaderActions;
}

/** A left-to-right gradient of this step's lightness with `at(t)` supplying hue and chroma for t in 0..1. */
function guide(
  y: number,
  gamut: Gamut,
  at: (t: number) => { h: number; c: number },
): React.CSSProperties {
  const stops = Array.from({ length: 13 }, (_, i) => {
    const t = i / 12;
    const { h, c } = at(t);
    const col = solveForLuminance(SPACES.oklch, y, h, c, gamut);
    return `${cssColor(col.hex, col.linear, gamut)} ${(t * 100).toFixed(1)}%`;
  });
  return { background: `linear-gradient(to right, ${stops.join(", ")})` };
}

const WHITE: RGB = [1, 1, 1];
const BLACK: RGB = [0, 0, 0];

/** One step of one color: its values to copy and read, and the nudge controls for that step. */
export function StepPanel({
  generated,
  shade,
  gamut,
  tweak,
  onTweak,
  onResetStep,
  onResetAll,
  onPrevious,
  onNext,
  stepActions,
}: Props) {
  const hue = generated.hue;
  const name = hue.name || "Unnamed";
  const css = cssColor(shade.hex, shade.linear, gamut);
  const here = tweak.dh !== 0 || tweak.dc !== 0;
  const tuned = generated.shades.filter((s) => s.tweaked).length;
  const others = tuned - (here ? 1 : 0);
  const [confirming, setConfirming] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [nameDraft, setNameDraft] = React.useState<string | null>(null);
  const nameResult = parseStepName(
    nameDraft ?? String(shade.grade),
    stepActions.grades,
    shade.grade,
  );
  const commitName = () => {
    if (nameResult.ok && nameResult.grade !== shade.grade)
      stepActions.onRenameStep(shade.grade, nameResult.grade);
    if (nameResult.ok) setNameDraft(null);
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Copied ${text}`);
    } catch {
      toast.message("Couldn't copy. Select the value and copy it by hand.");
    }
  };

  const base = { h: shade.oklch.h - tweak.dh, c: shade.oklch.C };
  const hueGuide = guide(shade.luminance, gamut, (t) => ({
    h: base.h + (t * 120 - 60),
    c: base.c,
  }));
  const chromaGuide = guide(shade.luminance, gamut, (t) => ({
    h: base.h + tweak.dh,
    c: Math.max(0, base.c * (1 + (t * 2 - 1))),
  }));

  const rows: { label: string; value: string; copy?: string }[] = [
    { label: "Hex", value: shade.hex, copy: shade.hex },
    ...(gamut === "p3" ? [{ label: "Display P3", value: css, copy: css }] : []),
    {
      label: "OKLCH",
      value: `${shade.oklch.L.toFixed(3)} ${shade.oklch.C.toFixed(3)} ${Math.round(shade.oklch.h)}°`,
      copy: `oklch(${shade.oklch.L.toFixed(3)} ${shade.oklch.C.toFixed(3)} ${Math.round(shade.oklch.h)})`,
    },
    { label: "Luminance", value: shade.luminance.toFixed(3) },
    {
      label: "On white",
      value: `${contrastFromLuminance(1, shade.luminance).toFixed(2)}:1 · Lc ${Math.round(Math.abs(apcaContrastLinear(WHITE, shade.linear)))}`,
    },
    {
      label: "On black",
      value: `${contrastFromLuminance(0, shade.luminance).toFixed(2)}:1 · Lc ${Math.round(Math.abs(apcaContrastLinear(BLACK, shade.linear)))}`,
    },
  ];

  return (
    <>
      <CollapsibleSection id="details" title="Details">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="size-10 shrink-0 rounded-lg ring-1 ring-foreground/15"
              style={{ backgroundColor: css }}
            />
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold">
                {name} {shade.grade}
              </h2>
              <p className="text-[11px] text-muted-foreground">
                {shade.anchor
                  ? "White and black are fixed, so there's nothing to tune."
                  : shade.isSource
                    ? "Your base color landed here."
                    : "Nudge this step without moving its neighbors."}
              </p>
            </div>
            <div className="ml-auto flex shrink-0 items-center">
              <Hint label="Previous step">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Previous step"
                  disabled={!onPrevious}
                  onClick={() => onPrevious?.()}
                >
                  <ChevronLeft />
                </Button>
              </Hint>
              <Hint label="Next step">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Next step"
                  disabled={!onNext}
                  onClick={() => onNext?.()}
                >
                  <ChevronRight />
                </Button>
              </Hint>
            </div>
          </div>
          <div className="space-y-3">
            {!shade.anchor ? (
              <SettingRow id="step-name" label="Step name">
                <Input
                  id="step-name"
                  value={nameDraft ?? String(shade.grade)}
                  inputMode="numeric"
                  aria-invalid={nameResult.ok ? undefined : true}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  onBlur={commitName}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") {
                      setNameDraft(null);
                      e.currentTarget.blur();
                    }
                  }}
                  className="h-8 font-mono text-xs"
                />
              </SettingRow>
            ) : null}
            {!nameResult.ok ? (
              <p className="text-[11px] text-destructive">{nameResult.error}</p>
            ) : null}
            {rows.map((r) => (
              <SettingRow key={r.label} label={r.label}>
                <div className="flex h-8 w-full min-w-0 items-center gap-1 rounded-lg bg-white pr-1 pl-2.5 shadow-(--shadow-default) dark:bg-input/30">
                  <span className="min-w-0 flex-1 truncate font-mono text-xs tabular-nums">
                    {r.value}
                  </span>
                  {r.copy ? (
                    <Hint label={`Copy ${r.label}`}>
                      <button
                        type="button"
                        aria-label={`Copy ${r.label}`}
                        onClick={() => copy(r.copy as string)}
                        className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        <Copy className="size-3" />
                      </button>
                    </Hint>
                  ) : null}
                </div>
              </SettingRow>
            ))}
          </div>
        </div>
      </CollapsibleSection>

      {!shade.anchor ? (
        <CollapsibleSection
          id="adjustments"
          title="Adjustments"
          className="space-y-3"
        >
          <p className="text-[11px] text-muted-foreground">
            Nudge the hue and colorfulness of this step. Lightness doesn&apos;t
            change, so it keeps its contrast.
          </p>
          <SliderField
            id={`tune-hue-${shade.grade}`}
            label="Hue shift"
            value={tweak.dh}
            min={-60}
            max={60}
            step={1}
            unit="°"
            trackStyle={hueGuide}
            onChange={(v) => onTweak({ dh: v })}
          />
          <SliderField
            id={`tune-chroma-${shade.grade}`}
            label="Colorfulness"
            value={Math.round(tweak.dc * 100)}
            min={-100}
            max={100}
            step={5}
            unit="%"
            trackStyle={chromaGuide}
            onChange={(v) => onTweak({ dc: v / 100 })}
          />
          {shade.clipped ? (
            <p className="text-[11px] text-muted-foreground">
              This step is already at the most color the screen can show, so
              more colorfulness has no effect.
            </p>
          ) : null}
          {here || others > 0 ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                disabled={!here}
                onClick={onResetStep}
              >
                Reset this step
              </Button>
              {others > 0 ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setConfirming(true)}
                >
                  Reset all {tuned} in {name}
                </Button>
              ) : null}
            </div>
          ) : null}
        </CollapsibleSection>
      ) : null}

      {!shade.anchor ? (
        <CollapsibleSection
          id="danger"
          title="Danger zone"
          className="space-y-2"
        >
          <Button
            variant="destructive"
            className="w-full"
            disabled={stepActions.stepLimit === "min"}
            onClick={() => setDeleting(true)}
          >
            <Trash2 />
            Delete step {shade.grade}
          </Button>
          {stepActions.stepLimit === "min" ? (
            <p className="text-[11px] text-muted-foreground">
              A scale needs at least 3 steps.
            </p>
          ) : null}
        </CollapsibleSection>
      ) : null}

      <ConfirmDeleteDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete step ${shade.grade}?`}
        description={`Step ${shade.grade} is shared by every color, so it is removed from all of them. You can undo it right after with ⌘Z.`}
        confirm="Delete step"
        onConfirm={() => stepActions.onRemoveStep(shade.grade)}
      />
      <ResetTweaksDialog
        open={confirming}
        onOpenChange={setConfirming}
        name={name}
        count={tuned}
        onConfirm={onResetAll}
      />
    </>
  );
}
