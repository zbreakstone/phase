import { MAX_GRADES, MIN_GRADES, SCALE_MAX, withGrades } from "./scale";
import type { PaletteState } from "./types";

/**
 * The step a "+" between two columns would add: halfway between them, as a whole number.
 * White (0) and black (1000) count as columns, so 0 to 50 gives 25 and 900 to 1000 gives 950.
 * Returns null when no whole number fits (the columns are already neighbors).
 */
export function midpointGrade(lower: number, upper: number): number | null {
  const mid = Math.floor((lower + upper) / 2);
  return mid > lower && mid < upper && mid > 0 && mid < SCALE_MAX ? mid : null;
}

export type StepBlock = "max" | "min" | "no-room";

/** Why a step can't be added or removed right now, or null when it can. */
export function addBlockedReason(state: PaletteState, lower: number, upper: number): StepBlock | null {
  if (state.scale.grades.length >= MAX_GRADES) return "max";
  return midpointGrade(lower, upper) === null ? "no-room" : null;
}

export function removeBlockedReason(state: PaletteState): StepBlock | null {
  return state.scale.grades.length <= MIN_GRADES ? "min" : null;
}

/** Adds the midpoint step between two neighboring columns. Returns the state unchanged if it can't. */
export function addStepBetween(state: PaletteState, lower: number, upper: number): PaletteState {
  if (addBlockedReason(state, lower, upper)) return state;
  const mid = midpointGrade(lower, upper) as number;
  const grades = [...state.scale.grades, mid].sort((a, b) => a - b);
  return { ...state, scale: withGrades(state.scale, grades) };
}

export type StepNameResult = { ok: true; grade: number } | { ok: false; error: string };

/** Checks a typed step name. `from` is the step being renamed, so keeping its own name is fine. */
export function parseStepName(text: string, grades: number[], from: number): StepNameResult {
  const trimmed = text.trim();
  if (trimmed === "") return { ok: false, error: "Enter a number from 1 to 999." };
  const n = Number(trimmed);
  if (!Number.isInteger(n)) return { ok: false, error: "Use a whole number." };
  if (n <= 0 || n >= SCALE_MAX) return { ok: false, error: "Use 1 to 999. 0 is white and 1000 is black." };
  if (n !== from && grades.includes(n)) return { ok: false, error: `Another step is already called ${n}.` };
  return { ok: true, grade: n };
}

/**
 * Renames a step. Steps are named by their number, which is also where they sit on the scale, so the
 * list is re-sorted. Everything keyed to the old name moves with it: a custom luminance value, tweaks
 * on that step in every color, and a source color aimed at it.
 */
export function renameStep(state: PaletteState, from: number, to: number): PaletteState {
  if (from === to || !state.scale.grades.includes(from)) return state;
  if (!parseStepName(String(to), state.scale.grades, from).ok) return state;

  const oldKey = String(from);
  const newKey = String(to);
  const grades = state.scale.grades.map((g) => (g === from ? to : g)).sort((a, b) => a - b);

  let customLuminance = state.scale.customLuminance;
  if (state.scale.luminanceMode === "custom" && oldKey in customLuminance) {
    customLuminance = { ...customLuminance, [newKey]: customLuminance[oldKey] };
    delete customLuminance[oldKey];
  }

  return {
    ...state,
    scale: {
      ...state.scale,
      grades,
      customLuminance,
      ...(state.scale.looseGrades ? { looseGrades: state.scale.looseGrades.map((g) => (g === from ? to : g)) } : {}),
    },
    hues: state.hues.map((h) => {
      let next = h;
      if (h.stepTweaks && oldKey in h.stepTweaks) {
        const stepTweaks = { ...h.stepTweaks, [newKey]: h.stepTweaks[oldKey] };
        delete stepTweaks[oldKey];
        next = { ...next, stepTweaks };
      }
      if (h.source && h.source.grade === from) next = { ...next, source: { ...h.source, grade: to } };
      return next;
    }),
  };
}

/** Removes a step and everything that pointed at it: tweaks on it, and any source color aimed at it. */
export function removeStep(state: PaletteState, grade: number): PaletteState {
  if (removeBlockedReason(state) || !state.scale.grades.includes(grade)) return state;
  const grades = state.scale.grades.filter((g) => g !== grade);
  const key = String(grade);
  return {
    ...state,
    scale: withGrades(state.scale, grades),
    hues: state.hues.map((h) => {
      let next = h;
      if (h.stepTweaks && key in h.stepTweaks) {
        const rest = { ...h.stepTweaks };
        delete rest[key];
        next = { ...next, stepTweaks: Object.keys(rest).length ? rest : undefined };
      }
      if (h.source && h.source.grade === grade) next = { ...next, source: { ...h.source, grade: null } };
      return next;
    }),
  };
}
