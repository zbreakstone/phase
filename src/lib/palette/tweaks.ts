import type { HueConfig, StepTweak } from "./types";

/** The nudge on one step, or none (zero on both) when it follows the curve. */
export const tweakAt = (hue: HueConfig, grade: number): StepTweak => hue.stepTweaks?.[String(grade)] ?? { dh: 0, dc: 0 };

/**
 * Applies part of a nudge to one step. A step with no nudge left drops out entirely, and the field
 * disappears when no step has one, so untouched palettes stay as small as they were.
 */
export function setStepTweak(hue: HueConfig, grade: number, next: Partial<StepTweak>): Pick<HueConfig, "stepTweaks"> {
  const key = String(grade);
  const merged = { ...tweakAt(hue, grade), ...next };
  const rest = { ...hue.stepTweaks };
  if (merged.dh === 0 && merged.dc === 0) delete rest[key];
  else rest[key] = merged;
  return { stepTweaks: Object.keys(rest).length ? rest : undefined };
}
