import { describe, expect, it } from "vitest";
import { SPACE_ORDER } from "@/lib/color/spaces";
import { HUE_PRESETS, defaultScale, defaultState, hueFromPreset, makeRules } from "@/lib/palette/defaults";
import { convertHue, curveAt, generateHue, generatePalette, hueDelta } from "@/lib/palette/generate";
import {
  checkTargets,
  feasibleRange,
  parseGrades,
  requiredRatio,
  ruleFeasibility,
  targetLuminance,
  uniformLuminance,
  uniformRatioForDiff,
  GRADE_PRESETS,
  RULE_PRESETS,
} from "@/lib/palette/scale";
import { buildMatrix, validatePalette } from "@/lib/palette/validate";
import { SPACES } from "@/lib/color/spaces";
import { wcagContrast } from "@/lib/color/contrast";

describe("luminance targets", () => {
  it("anchors white and black", () => {
    expect(uniformLuminance(0)).toBeCloseTo(1, 12);
    expect(uniformLuminance(100)).toBeCloseTo(0, 12);
  });
  it("puts grade 50 at the AA-against-both-ends luminance", () => {
    const y = uniformLuminance(50);
    expect(1.05 / (y + 0.05)).toBeGreaterThanOrEqual(4.5);
    expect((y + 0.05) / 0.05).toBeGreaterThanOrEqual(4.5);
    expect(y).toBeGreaterThan(0.175);
    expect(y).toBeLessThan(0.183);
  });
  it("gives the same ratio for any pair with the same gap", () => {
    const r = uniformRatioForDiff(40);
    for (const lo of [0, 10, 30, 60]) {
      const a = uniformLuminance(lo);
      const b = uniformLuminance(lo + 40);
      expect((a + 0.05) / (b + 0.05)).toBeCloseTo(r, 10);
    }
  });
  it("uniform targets satisfy every built-in rule preset", () => {
    for (const preset of RULE_PRESETS) {
      const scale = { ...defaultScale(), rules: makeRules(preset.id) };
      expect(checkTargets(scale)).toEqual([]);
    }
  });
});

describe("rules", () => {
  const rules = makeRules("uswds");
  it("picks the strictest rule that applies", () => {
    expect(requiredRatio(30, rules)).toBeNull();
    expect(requiredRatio(40, rules)).toBe(3);
    expect(requiredRatio(60, rules)).toBe(4.5);
    expect(requiredRatio(90, rules)).toBe(7);
  });
  it("detects violations in hand-edited targets", () => {
    const scale = {
      ...defaultScale(),
      luminanceMode: "custom" as const,
      customLuminance: { "50": uniformLuminance(50), "10": uniformLuminance(50) + 0.02 },
    };
    const v = checkTargets(scale);
    expect(v.length).toBeGreaterThan(0);
    expect(v.every((x) => x.actual < x.required)).toBe(true);
  });
  it("flags rules no white-to-black scale can satisfy", () => {
    const res = ruleFeasibility([{ id: "x", minDiff: 20, ratio: 7 }]);
    expect(res[0].feasible).toBe(false);
    expect(ruleFeasibility(rules).every((r) => r.feasible)).toBe(true);
  });
  it("feasible range always contains a valid target", () => {
    const scale = defaultScale();
    for (const g of scale.grades) {
      const { min, max } = feasibleRange(scale, g);
      const y = targetLuminance(scale, g);
      expect(y).toBeGreaterThanOrEqual(min - 1e-9);
      expect(y).toBeLessThanOrEqual(max + 1e-9);
    }
  });
});

describe("grade parsing", () => {
  it("accepts a sorted unique list", () => {
    expect(parseGrades("90, 10 50,30,70")).toEqual({ ok: true, grades: [10, 30, 50, 70, 90] });
  });
  it.each(["", "a,b,c", "0,50,90", "10,10,20,30", "10,20", "10.5,20,30"])("rejects %j", (text) => {
    expect(parseGrades(text).ok).toBe(false);
  });
});

describe("hue interpolation", () => {
  it("takes the short way round the wheel", () => {
    expect(hueDelta(350, 10, "shortest")).toBe(20);
    expect(hueDelta(10, 350, "shortest")).toBe(-20);
  });
  it("can be forced either direction", () => {
    expect(hueDelta(350, 10, "decreasing")).toBe(-340);
    expect(hueDelta(10, 350, "increasing")).toBe(340);
  });
  it("hits both endpoints exactly", () => {
    const hue = hueFromPreset(HUE_PRESETS.find((p) => p.key === "yellow")!, "oklch", defaultScale());
    for (const id of SPACE_ORDER) {
      const space = SPACES[id];
      const start = curveAt(space, hue, 0);
      const end = curveAt(space, hue, 1);
      expect(start.hue).toBeCloseTo(hue.hueLight, 6);
      expect(end.hue).toBeCloseTo(hue.hueDark, 6);
      expect(start.chroma).toBeCloseTo(hue.chromaLight, 6);
      expect(end.chroma).toBeCloseTo(hue.chromaDark, 6);
    }
  });
});

describe("the magic-number guarantee holds on real output", () => {
  for (const spaceId of SPACE_ORDER) {
    for (const rulePreset of RULE_PRESETS) {
      for (const gradePreset of GRADE_PRESETS) {
        it(`${spaceId} / ${rulePreset.id} rules / ${gradePreset.id} grades`, () => {
          const scale = {
            ...defaultScale(),
            grades: gradePreset.grades,
            rules: makeRules(rulePreset.id),
          };
          const hues = HUE_PRESETS.map((p) => hueFromPreset(p, spaceId, scale));
          const generated = generatePalette(spaceId, scale, hues);
          const report = validatePalette(generated, scale.rules);
          expect(report.pairsChecked).toBeGreaterThan(1000);
          expect(report.failures).toEqual([]);
        });
      }
    }
  }

  it("holds with extreme chroma that has to be clipped", () => {
    const scale = defaultScale();
    const hue = {
      ...hueFromPreset(HUE_PRESETS[3], "oklch", scale),
      chromaLight: 0.4,
      chromaMid: 0.4,
      chromaDark: 0.4,
    };
    const generated = generatePalette("oklch", scale, [hue]);
    expect(generated[0].shades.some((s) => s.clipped)).toBe(true);
    expect(validatePalette(generated, scale.rules).failures).toEqual([]);
  });

  it("matches the pairwise contrast computed straight from hex values", () => {
    const state = defaultState();
    const generated = generatePalette(state.space, state.scale, state.hues);
    const a = generated[1].shades;
    const b = generated[4].shades;
    const matrix = buildMatrix(a, b, state.scale.rules);
    for (const row of matrix) {
      for (const cell of row) {
        expect(cell.ratio).toBeCloseTo(wcagContrast(cell.fg.hex, cell.bg.hex), 10);
        if (cell.status === "pass") expect(cell.ratio).toBeGreaterThanOrEqual(cell.required!);
      }
    }
    expect(matrix.flat().some((c) => c.status === "fail")).toBe(false);
  });

  it("reports failures when targets are edited to break the rule", () => {
    const scale = {
      ...defaultScale(),
      luminanceMode: "custom" as const,
      customLuminance: { "30": 0.3, "70": 0.2 },
    };
    const hue = hueFromPreset(HUE_PRESETS[0], "oklch", scale);
    const report = validatePalette(generatePalette("oklch", scale, [hue]), scale.rules);
    expect(report.failures.length).toBeGreaterThan(0);
  });

  it("keeps each shade within 1.5% of its luminance target", () => {
    const state = defaultState();
    for (const g of generatePalette(state.space, state.scale, state.hues)) {
      for (const s of g.shades) {
        expect((s.luminance + 0.05) / (s.targetLuminance + 0.05)).toBeGreaterThan(0.985);
        expect((s.luminance + 0.05) / (s.targetLuminance + 0.05)).toBeLessThan(1.015);
      }
    }
  });
});

describe("switching colour space", () => {
  it("keeps the endpoint colours when converting", () => {
    const scale = defaultScale();
    const hue = hueFromPreset(HUE_PRESETS.find((p) => p.key === "blue")!, "oklch", scale);
    const before = generateHue("oklch", scale, hue).shades;
    for (const to of SPACE_ORDER.filter((s) => s !== "oklch")) {
      const converted = convertHue(hue, scale, "oklch", to);
      const after = generateHue(to, scale, converted).shades;
      for (const i of [0, 1, before.length - 2, before.length - 1]) {
        const a = before[i];
        const b = after[i];
        if (a.anchor) continue;
        expect(wcagContrast(a.hex, b.hex)).toBeLessThan(1.25);
      }
    }
  });
});
