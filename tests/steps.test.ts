import { describe, expect, it } from "vitest";
import { defaultState } from "@/lib/palette/defaults";
import { MAX_GRADES, MIN_GRADES, targetLuminance } from "@/lib/palette/scale";
import { addBlockedReason, addStepBetween, midpointGrade, parseStepName, removeBlockedReason, removeStep, renameStep } from "@/lib/palette/steps";
import { setStepTweak, tweakAt } from "@/lib/palette/tweaks";
import type { PaletteState } from "@/lib/palette/types";

const withGrades = (state: PaletteState, grades: number[]): PaletteState => ({ ...state, scale: { ...state.scale, grades } });

describe("midpointGrade", () => {
  it("splits the difference between two steps", () => {
    expect(midpointGrade(800, 900)).toBe(850);
    expect(midpointGrade(850, 900)).toBe(875);
    expect(midpointGrade(50, 100)).toBe(75);
  });

  it("works against white and black", () => {
    expect(midpointGrade(0, 50)).toBe(25);
    expect(midpointGrade(900, 1000)).toBe(950);
  });

  it("rounds odd gaps to a whole number strictly between the two", () => {
    expect(midpointGrade(850, 875)).toBe(862);
    expect(midpointGrade(1, 4)).toBe(2);
  });

  it("returns null when the columns are neighbors", () => {
    expect(midpointGrade(850, 851)).toBeNull();
    expect(midpointGrade(0, 1)).toBeNull();
  });
});

describe("addStepBetween", () => {
  it("inserts the midpoint and keeps the steps in order", () => {
    const next = addStepBetween(defaultState(), 800, 900);
    expect(next.scale.grades).toEqual([50, 100, 200, 300, 400, 500, 600, 700, 800, 850, 900, 950]);
  });

  it("can add a step between white and the lightest step", () => {
    expect(addStepBetween(defaultState(), 0, 50).scale.grades[0]).toBe(25);
  });

  it("can add a step between the darkest step and black", () => {
    const grades = addStepBetween(defaultState(), 900, 1000).scale.grades;
    expect(grades[grades.length - 1]).toBe(950);
  });

  it("starts a custom-luminance step between its neighbors without moving the others", () => {
    const base = defaultState();
    const custom: PaletteState = {
      ...base,
      scale: { ...base.scale, luminanceMode: "custom", customLuminance: Object.fromEntries(base.scale.grades.map((g) => [String(g), targetLuminance(base.scale, g)])) },
    };
    const next = addStepBetween(custom, 800, 900);
    for (const g of custom.scale.grades) expect(targetLuminance(next.scale, g)).toBeCloseTo(targetLuminance(custom.scale, g), 10);
    const y = targetLuminance(next.scale, 850);
    expect(y).toBeLessThan(targetLuminance(custom.scale, 800));
    expect(y).toBeGreaterThan(targetLuminance(custom.scale, 900));
  });

  it("refuses at the maximum number of steps", () => {
    const grades = Array.from({ length: MAX_GRADES }, (_, i) => (i + 1) * 50);
    const full = withGrades(defaultState(), grades);
    expect(addBlockedReason(full, 100, 150)).toBe("max");
    expect(addStepBetween(full, 100, 150)).toBe(full);
  });

  it("refuses when there is no room", () => {
    const tight = withGrades(defaultState(), [100, 101, 500]);
    expect(addBlockedReason(tight, 100, 101)).toBe("no-room");
    expect(addStepBetween(tight, 100, 101)).toBe(tight);
  });
});

describe("removeStep", () => {
  it("removes the step", () => {
    expect(removeStep(defaultState(), 500).scale.grades).not.toContain(500);
  });

  it("drops tweaks on that step and leaves other tweaks alone", () => {
    const base = defaultState();
    const [first, ...rest] = base.hues;
    const state: PaletteState = {
      ...base,
      hues: [{ ...first, stepTweaks: { "500": { dh: 10, dc: 0.2 }, "300": { dh: -5, dc: 0 } } }, ...rest],
    };
    const next = removeStep(state, 500);
    expect(next.hues[0].stepTweaks).toEqual({ "300": { dh: -5, dc: 0 } });
  });

  it("clears the tweaks field entirely when none are left", () => {
    const base = defaultState();
    const [first, ...rest] = base.hues;
    const next = removeStep({ ...base, hues: [{ ...first, stepTweaks: { "500": { dh: 10, dc: 0 } } }, ...rest] }, 500);
    expect(next.hues[0].stepTweaks).toBeUndefined();
  });

  it("lets a source color aimed at the removed step find its own nearest step", () => {
    const base = defaultState();
    const [first, ...rest] = base.hues;
    const source = { hex: "#3366cc", grade: 500, pinned: true };
    const next = removeStep({ ...base, hues: [{ ...first, source }, ...rest] }, 500);
    expect(next.hues[0].source).toEqual({ hex: "#3366cc", grade: null, pinned: true });
  });

  it("keeps custom luminance for the steps that survive", () => {
    const base = defaultState();
    const custom: PaletteState = {
      ...base,
      scale: { ...base.scale, luminanceMode: "custom", customLuminance: Object.fromEntries(base.scale.grades.map((g) => [String(g), targetLuminance(base.scale, g) * 0.9])) },
    };
    const next = removeStep(custom, 500);
    expect(targetLuminance(next.scale, 400)).toBeCloseTo(targetLuminance(custom.scale, 400), 10);
  });

  it("refuses at the minimum number of steps", () => {
    const small = withGrades(defaultState(), Array.from({ length: MIN_GRADES }, (_, i) => (i + 1) * 100));
    expect(removeBlockedReason(small)).toBe("min");
    expect(removeStep(small, 200)).toBe(small);
  });
});

describe("parseStepName", () => {
  const grades = [100, 200, 300];

  it("accepts a free whole number in range", () => {
    expect(parseStepName("250", grades, 200)).toEqual({ ok: true, grade: 250 });
    expect(parseStepName("  250 ", grades, 200)).toEqual({ ok: true, grade: 250 });
  });

  it("accepts the step's own name", () => {
    expect(parseStepName("200", grades, 200)).toEqual({ ok: true, grade: 200 });
  });

  it("rejects names that are taken, out of range, or not whole numbers", () => {
    expect(parseStepName("300", grades, 200).ok).toBe(false);
    expect(parseStepName("0", grades, 200).ok).toBe(false);
    expect(parseStepName("1000", grades, 200).ok).toBe(false);
    expect(parseStepName("12.5", grades, 200).ok).toBe(false);
    expect(parseStepName("abc", grades, 200).ok).toBe(false);
    expect(parseStepName("", grades, 200).ok).toBe(false);
  });
});

describe("renameStep", () => {
  it("renames and keeps the list sorted", () => {
    expect(renameStep(defaultState(), 500, 520).scale.grades).toContain(520);
    expect(renameStep(defaultState(), 500, 520).scale.grades).not.toContain(500);
    const moved = renameStep(defaultState(), 100, 450).scale.grades;
    expect(moved).toEqual([...moved].sort((a, b) => a - b));
  });

  it("does nothing for a taken, invalid or unchanged name", () => {
    const state = defaultState();
    expect(renameStep(state, 500, 600)).toBe(state);
    expect(renameStep(state, 500, 1000)).toBe(state);
    expect(renameStep(state, 500, 500)).toBe(state);
    expect(renameStep(state, 555, 560)).toBe(state);
  });

  it("moves a custom luminance value, tweaks and a source pin to the new name", () => {
    const base = defaultState();
    const [first, ...rest] = base.hues;
    const state: PaletteState = {
      ...base,
      scale: { ...base.scale, luminanceMode: "custom", customLuminance: { "500": 0.18, "400": 0.27 } },
      hues: [{ ...first, stepTweaks: { "500": { dh: 10, dc: 0.2 } }, source: { hex: "#3366cc", grade: 500, pinned: false } }, ...rest],
    };
    const next = renameStep(state, 500, 520);
    expect(next.scale.customLuminance).toEqual({ "520": 0.18, "400": 0.27 });
    expect(next.hues[0].stepTweaks).toEqual({ "520": { dh: 10, dc: 0.2 } });
    expect(next.hues[0].source?.grade).toBe(520);
  });
});

describe("step tweaks", () => {
  const hue = defaultState().hues[0];

  it("reads no nudge as zero", () => {
    expect(tweakAt(hue, 500)).toEqual({ dh: 0, dc: 0 });
  });

  it("sets part of a nudge and keeps the rest", () => {
    const one = { ...hue, ...setStepTweak(hue, 500, { dh: 12 }) };
    expect(tweakAt(one, 500)).toEqual({ dh: 12, dc: 0 });
    const both = { ...one, ...setStepTweak(one, 500, { dc: 0.3 }) };
    expect(tweakAt(both, 500)).toEqual({ dh: 12, dc: 0.3 });
    expect(Object.keys(both.stepTweaks ?? {})).toEqual(["500"]);
  });

  it("drops a step once both values return to zero, and the field once none are left", () => {
    const one = { ...hue, ...setStepTweak(hue, 500, { dh: 12 }) };
    const cleared = { ...one, ...setStepTweak(one, 500, { dh: 0 }) };
    expect(cleared.stepTweaks).toBeUndefined();
  });
});
