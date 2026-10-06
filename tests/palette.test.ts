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
    expect(uniformLuminance(1000)).toBeCloseTo(0, 12);
  });
  it("puts step 500 at the AA-against-both-ends luminance", () => {
    const y = uniformLuminance(500);
    expect(1.05 / (y + 0.05)).toBeGreaterThanOrEqual(4.5);
    expect((y + 0.05) / 0.05).toBeGreaterThanOrEqual(4.5);
    expect(y).toBeGreaterThan(0.175);
    expect(y).toBeLessThan(0.183);
  });
  it("gives the same ratio for any pair with the same gap", () => {
    const r = uniformRatioForDiff(400);
    for (const lo of [0, 100, 300, 600]) {
      const a = uniformLuminance(lo);
      const b = uniformLuminance(lo + 400);
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
    expect(requiredRatio(300, rules)).toBeNull();
    expect(requiredRatio(400, rules)).toBe(3);
    expect(requiredRatio(600, rules)).toBe(4.5);
    expect(requiredRatio(900, rules)).toBe(7);
  });
  it("detects violations in hand-edited targets", () => {
    const scale = {
      ...defaultScale(),
      luminanceMode: "custom" as const,
      customLuminance: { "500": uniformLuminance(500), "100": uniformLuminance(500) + 0.02 },
    };
    const v = checkTargets(scale);
    expect(v.length).toBeGreaterThan(0);
    expect(v.every((x) => x.actual < x.required)).toBe(true);
  });
  it("flags rules no white-to-black scale can satisfy", () => {
    const res = ruleFeasibility([{ id: "x", minDiff: 200, ratio: 7 }]);
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
    expect(parseGrades("900, 100 500,300,700")).toEqual({ ok: true, grades: [100, 300, 500, 700, 900] });
  });
  it.each(["", "a,b,c", "0,500,900", "100,100,200,300", "100,200", "100.5,200,300", "100,500,1000"])("rejects %j", (text) => {
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
      customLuminance: { "300": 0.3, "700": 0.2 },
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

import { analyzeSource, nearestGrade, sourceAnchor } from "@/lib/palette/source";
import { hueFromSource } from "@/lib/palette/defaults";
import { coordsOf } from "@/lib/palette/source";
import { sanitizeState, decodeState, encodeState } from "@/lib/palette/serialize";
import { toCss, toTailwindV4, toTokensJson } from "@/lib/export/formats";

describe("step names and anchors", () => {
  it("defaults to 50..900 with white 0 and black 1000 on every hue", () => {
    const state = defaultState();
    expect(state.scale.grades).toEqual([50, 100, 200, 300, 400, 500, 600, 700, 800, 900]);
    for (const g of generatePalette(state.space, state.scale, state.hues)) {
      expect(g.shades.map((s) => s.grade)).toEqual([0, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]);
      expect(g.shades[0].hex).toBe("#ffffff");
      expect(g.shades[g.shades.length - 1].hex).toBe("#000000");
    }
  });
  it("step difference decides contrast: 400+ => 3:1, 500+ => 4.5:1, 700+ => 7:1", () => {
    const state = defaultState();
    for (const g of generatePalette(state.space, state.scale, state.hues)) {
      for (const a of g.shades) {
        for (const b of g.shades) {
          const diff = b.grade - a.grade;
          if (diff <= 0) continue;
          const ratio = wcagContrast(a.hex, b.hex);
          if (diff >= 400) expect(ratio).toBeGreaterThanOrEqual(3);
          if (diff >= 500) expect(ratio).toBeGreaterThanOrEqual(4.5);
          if (diff >= 700) expect(ratio).toBeGreaterThanOrEqual(7);
        }
      }
    }
  });
  it("exports white and black inside every colour set", () => {
    const state = defaultState();
    const gen = generatePalette(state.space, state.scale, state.hues);
    const css = toCss(gen, "hex");
    for (const h of ["gray", "red", "yellow", "green", "blue", "violet"]) {
      expect(css).toContain(`--${h}-0: #ffffff;`);
      expect(css).toContain(`--${h}-1000: #000000;`);
      expect(css).toContain(`--${h}-500:`);
    }
    expect(toTailwindV4(gen, "hex")).toContain("--color-blue-1000: #000000;");
    const json = JSON.parse(toTokensJson(state, gen, "hex"));
    expect(json.color.red["0"].$value).toBe("#ffffff");
    expect(json.color.red["1000"].$value).toBe("#000000");
  });
});

describe("perceived lightness across hues", () => {
  it("keeps OKLCH L within a narrow band at every step while luminance is exact", () => {
    const state = defaultState();
    const gen = generatePalette(state.space, state.scale, state.hues);
    for (let i = 0; i < gen[0].shades.length; i++) {
      const Ls = gen.map((g) => g.shades[i].oklch.L);
      expect(Math.max(...Ls) - Math.min(...Ls)).toBeLessThan(0.06);
    }
  });
  it("lightness falls monotonically down every scale", () => {
    const state = defaultState();
    for (const g of generatePalette(state.space, state.scale, state.hues)) {
      for (let i = 1; i < g.shades.length; i++) expect(g.shades[i].oklch.L).toBeLessThan(g.shades[i - 1].oklch.L);
    }
  });
});

describe("source colours", () => {
  const scale = defaultScale();
  it("lands on the nearest step by luminance and reports the adjustment", () => {
    const hue = hueFromSource("#3b82f6", "oklch");
    const a = analyzeSource("oklch", scale, hue)!;
    expect(scale.grades).toContain(a.grade);
    expect(a.auto).toBe(true);
    expect(nearestGrade(a.original.luminance, scale)).toBe(a.grade);
    expect(Math.abs(a.adjusted.luminance - a.targetLuminance)).toBeLessThan(0.004);
    expect(a.shift).toBeGreaterThanOrEqual(1);
    expect(a.shift).toBeLessThan(uniformRatioForDiff(100));
  });
  it("keeps the source's hue and chroma through the adjustment", () => {
    const hue = hueFromSource("#3b82f6", "oklch");
    const a = analyzeSource("oklch", scale, hue)!;
    const dh = Math.abs(((a.adjusted.h - a.original.h + 540) % 360) - 180);
    expect(dh).toBeLessThan(2);
  });
  it("generates a shade on the landed step that matches the adjusted source", () => {
    const hue = hueFromSource("#3b82f6", "oklch");
    const g = generateHue("oklch", scale, hue);
    const landed = g.shades.find((s) => s.isSource)!;
    expect(landed.grade).toBe(g.source!.grade);
    expect(landed.hex).toBe(g.source!.adjusted.hex);
    expect(sourceAnchor("oklch", scale, hue, g.source)!.grade).toBe(landed.grade);
  });
  it("manual step choice overrides the nearest step", () => {
    const hue = { ...hueFromSource("#3b82f6", "oklch") };
    hue.source = { ...hue.source!, grade: 800 };
    const a = analyzeSource("oklch", scale, hue)!;
    expect(a.grade).toBe(800);
    expect(a.auto).toBe(false);
    expect(a.shift).toBeGreaterThan(1.5);
  });
  it("adjusted sources keep the magic-number guarantee", () => {
    for (const hex of ["#3b82f6", "#ef4444", "#facc15", "#22c55e", "#8b5cf6", "#808080", "#0a3d62"]) {
      const hue = hueFromSource(hex, "oklch");
      const report = validatePalette([generateHue("oklch", scale, hue)], scale.rules);
      expect(report.failures).toEqual([]);
    }
  });
  it("pinning keeps the exact colour and the checker reports any deviation", () => {
    const hue = hueFromSource("#facc15", "oklch");
    hue.source = { ...hue.source!, pinned: true, grade: 700 };
    const g = generateHue("oklch", scale, hue);
    const pinned = g.shades.find((s) => s.isSource)!;
    expect(pinned.hex).toBe("#facc15");
    expect(pinned.pinned).toBe(true);
    const report = validatePalette([g], scale.rules);
    expect(report.failures.length).toBeGreaterThan(0);
    expect(report.failures.every((f) => f.fgGrade === 700 || f.bgGrade === 700)).toBe(true);
  });
  it("the curve passes through the source hue and chroma at its step", () => {
    const hue = hueFromSource("#3b82f6", "oklch");
    hue.hueLight = 200;
    hue.hueDark = 300;
    const g = generateHue("oklch", scale, hue);
    const landed = g.shades.find((s) => s.isSource)!;
    expect(Math.abs(((landed.hue - g.source!.original.h + 540) % 360) - 180)).toBeLessThan(0.01);
  });
  it("survives a colour space switch with the same source hex", () => {
    const hue = hueFromSource("#3b82f6", "oklch");
    for (const to of SPACE_ORDER) {
      const converted = convertHue(hue, scale, "oklch", to);
      const g = generateHue(to, scale, converted);
      expect(g.source!.original.hex).toBe("#3b82f6");
      expect(validatePalette([g], scale.rules).failures).toEqual([]);
    }
  });
  it("round-trips through share links and rejects junk", () => {
    const state = defaultState();
    state.hues.push(hueFromSource("#10b981", "oklch"));
    const res = decodeState(encodeState(state));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.state.hues[res.state.hues.length - 1].source?.hex).toBe("#10b981");
    expect(decodeState("%%%").ok).toBe(false);
    expect(sanitizeState({ space: "oklch" })).toBeNull();
  });
  it("coordsOf reads OKLCH for any hex", () => {
    expect(coordsOf("oklch", "#ff0000").h).toBeCloseTo(29.23, 1);
  });
});
