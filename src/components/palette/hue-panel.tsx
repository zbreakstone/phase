"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { contrastFromLuminance } from "@/lib/color/contrast";
import { type Gamut, cssColor } from "@/lib/color/gamut";
import { solveForLuminance } from "@/lib/color/solve";
import { SPACES, type SpaceId } from "@/lib/color/spaces";
import type { GeneratedHue, HueConfig, Shade } from "@/lib/palette/types";
import { SliderField } from "./fields";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";
import { CollapsibleSection, SettingRow } from "./panel-section";
import { ResetTweaksDialog } from "./reset-tweaks-dialog";
import { SourceEditor } from "./source-editor";

interface Props {
  generated: GeneratedHue;
  space: SpaceId;
  gamut: Gamut;
  onChange: (patch: Partial<HueConfig>) => void;
  onRemove: () => void;
  onResetTweaks: () => void;
  onOpenStep: (grade: number) => void;
  /** How swatches are painted under the current view (vision simulation, grayscale). */
  display: (shade: Shade) => string;
  /** Renders the Settings section, with the delete button passed in to sit at its end. */
  settings: (danger: React.ReactNode) => React.ReactNode;
}

function hueGuide(
  space: SpaceId,
  gamut: Gamut,
  y: number,
  chroma: number,
): React.CSSProperties {
  const def = SPACES[space];
  const stops = Array.from({ length: 25 }, (_, i) => {
    const c = solveForLuminance(def, y, i * 15, chroma, gamut);
    return `${cssColor(c.hex, c.linear, gamut)} ${((i / 24) * 100).toFixed(1)}%`;
  });
  return { background: `linear-gradient(to right, ${stops.join(", ")})` };
}

/** Everything about one color: its name, base color, hue and colorfulness, and a list of its steps. */
export function HuePanel({
  generated,
  space,
  gamut,
  onChange,
  onRemove,
  onResetTweaks,
  onOpenStep,
  display,
  settings,
}: Props) {
  const hue = generated.hue;
  const def = SPACES[space];
  const ramp = generated.shades.filter((s) => !s.anchor);
  const first = ramp[0];
  const last = ramp[ramp.length - 1];
  const lockedLight = generated.source?.grade === first?.grade;
  const lockedDark = generated.source?.grade === last?.grade && ramp.length > 1;
  const tuned = generated.shades.filter((s) => s.tweaked).length;
  const [confirming, setConfirming] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const lightGuide = React.useMemo(
    () =>
      hueGuide(
        space,
        gamut,
        Math.min(first?.targetLuminance ?? 0.8, 0.8),
        Math.max(hue.chromaLight, def.chroma.max * 0.15),
      ),
    [space, gamut, first?.targetLuminance, hue.chromaLight, def.chroma.max],
  );
  const darkGuide = React.useMemo(
    () =>
      hueGuide(
        space,
        gamut,
        Math.max(last?.targetLuminance ?? 0.02, 0.06),
        Math.max(hue.chromaDark, def.chroma.max * 0.15),
      ),
    [space, gamut, last?.targetLuminance, hue.chromaDark, def.chroma.max],
  );

  const chromaGuide = React.useMemo(() => {
    const y = ramp[Math.floor(ramp.length / 2)]?.targetLuminance ?? 0.2;
    const h = (hue.hueLight + hue.hueDark) / 2;
    const stops = Array.from({ length: 13 }, (_, i) => {
      const c = solveForLuminance(def, y, h, (i / 12) * def.chroma.max, gamut);
      return `${cssColor(c.hex, c.linear, gamut)} ${((i / 12) * 100).toFixed(1)}%`;
    });
    return { background: `linear-gradient(to right, ${stops.join(", ")})` } as React.CSSProperties;
  }, [ramp, hue.hueLight, hue.hueDark, def, gamut]);

  const setChroma = (value: number) => {
    const factor = hue.chromaMid > 1e-9 ? value / hue.chromaMid : 0;
    if (hue.chromaMid > 1e-9) {
      onChange({
        chromaLight: hue.chromaLight * factor,
        chromaMid: value,
        chromaDark: hue.chromaDark * factor,
      });
    } else {
      onChange({
        chromaLight: value * 0.35,
        chromaMid: value,
        chromaDark: value * 0.75,
      });
    }
  };

  return (
    <>
      <CollapsibleSection id="details" title="Details" className="space-y-6">
        <SettingRow id="color-name" label="Name">
          <Input
            id="color-name"
            value={hue.name}
            maxLength={32}
            placeholder="Unnamed"
            onChange={(e) => onChange({ name: e.target.value })}
            onFocus={(e) => e.target.select()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
            }}
            className="h-8 text-xs"
          />
        </SettingRow>
        <SourceEditor
          source={hue.source}
          analysis={generated.source}
          onChange={(source) => onChange({ source })}
        />
        <div role="region" aria-labelledby="hue-steps" className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3
              id="hue-steps"
              className="flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase"
            >
              Steps
              <Badge size="sm">{generated.shades.length}</Badge>
            </h3>
            {tuned > 0 ? (
              <Button
                variant="destructive"
                size="xs"
                onClick={() => setConfirming(true)}
              >
                Reset {tuned} tuned
              </Button>
            ) : null}
          </div>
          <ul className="space-y-1.5">
            {generated.shades.map((s) => (
              <li key={s.grade}>
                <button
                  type="button"
                  onClick={() => onOpenStep(s.grade)}
                  className="flex h-8 w-full items-center gap-2 rounded-lg bg-white pr-2.5 pl-1.5 text-left shadow-(--shadow-default) hover:shadow-(--shadow-large) focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none dark:bg-input/30"
                >
                  <span
                    aria-hidden
                    className="relative size-5 shrink-0 rounded-md ring-1 ring-foreground/15"
                    style={{ backgroundColor: display(s) }}
                  >
                    {s.tweaked ? (
                      <span className="absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-white mix-blend-difference" />
                    ) : null}
                  </span>
                  <span className="w-9 font-mono text-xs tabular-nums">
                    {s.grade}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
                    {s.hex}
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                    {contrastFromLuminance(1, s.luminance).toFixed(2)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </CollapsibleSection>

      <CollapsibleSection id="adjustments" title="Adjustments" className="space-y-6">
        <div className="space-y-3">
          <h3 className="text-xs font-semibold tracking-wide uppercase">Hue</h3>
          <p className="text-[11px] text-muted-foreground">
            Tints start at the lightest hue and end at the darkest one, so yellows
            can turn orange instead of muddy olive. See the curve below the
            square.
          </p>
          <SliderField
            id="hue-light"
            label="Lightest shade"
            disabled={lockedLight}
            hint={
              lockedLight
                ? "Locked: your base color sits on the lightest step, so this end of the curve is fixed to its hue. Move the base color to a darker step to adjust it."
                : undefined
            }
            value={hue.hueLight}
            min={0}
            max={360}
            step={1}
            unit="°"
            onChange={(v) => onChange({ hueLight: v })}
            trackStyle={lightGuide}
          />
          <SliderField
            id="hue-dark"
            label="Darkest shade"
            disabled={lockedDark}
            hint={
              lockedDark
                ? "Locked: your base color sits on the darkest step, so this end of the curve is fixed to its hue. Move the base color to a lighter step to adjust it."
                : undefined
            }
            value={hue.hueDark}
            min={0}
            max={360}
            step={1}
            unit="°"
            onChange={(v) => onChange({ hueDark: v })}
            trackStyle={darkGuide}
          />
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-semibold tracking-wide uppercase">Chroma</h3>
          <SliderField
            id="chroma"
            label="Colorfulness"
            disabled={lockedLight && lockedDark}
            value={hue.chromaMid}
            min={0}
            max={def.chroma.max}
            step={def.chroma.step}
            decimals={def.chroma.decimals}
            trackStyle={chromaGuide}
            onChange={setChroma}
          />
        </div>
      </CollapsibleSection>

      {settings(
        <Button variant="destructive" className="mt-3 w-full" onClick={() => setDeleting(true)}>
          <Trash2 />
          Delete {hue.name || "this color"}
        </Button>,
      )}

      <ConfirmDeleteDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${hue.name || "this color"}?`}
        description={`This removes ${hue.name || "this color"} and its ${tuned > 0 ? `${tuned} tuned ${tuned === 1 ? "step" : "steps"}` : "steps"} from the palette. You can undo it right after with ⌘Z.`}
        confirm="Delete color"
        onConfirm={onRemove}
      />
      <ResetTweaksDialog
        open={confirming}
        onOpenChange={setConfirming}
        name={hue.name || "Unnamed"}
        count={tuned}
        onConfirm={onResetTweaks}
      />
    </>
  );
}
