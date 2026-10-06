import { describe, expect, it } from "vitest";
import {
  hexToLinear,
  hsluvToLinear,
  labToLinear,
  linearToHex,
  linearToHsluv,
  linearToLab,
  linearToOklab,
  oklabToLinear,
  srgbToLinear,
  linearToSrgb,
} from "@/lib/color/convert";
import { apcaContrast, relativeLuminance, wcagContrast } from "@/lib/color/contrast";
import { SPACES, SPACE_ORDER } from "@/lib/color/spaces";
import { solveForLuminance } from "@/lib/color/solve";

describe("sRGB transfer", () => {
  it("round-trips", () => {
    for (const v of [0, 0.01, 0.2, 0.5, 1]) {
      expect(linearToSrgb(srgbToLinear(v))).toBeCloseTo(v, 10);
    }
  });
  it("round-trips hex", () => {
    for (const hex of ["#000000", "#ffffff", "#336699", "#fe0102"]) {
      expect(linearToHex(hexToLinear(hex))).toBe(hex);
    }
  });
});

describe("OKLab", () => {
  it("maps white to L=1 and black to L=0", () => {
    const [L, a, b] = linearToOklab([1, 1, 1]);
    expect(L).toBeCloseTo(1, 4);
    expect(a).toBeCloseTo(0, 4);
    expect(b).toBeCloseTo(0, 4);
    expect(linearToOklab([0, 0, 0])[0]).toBeCloseTo(0, 6);
  });
  it("matches published sRGB red", () => {
    const [L, a, b] = linearToOklab([1, 0, 0]);
    expect(L).toBeCloseTo(0.628, 3);
    expect(a).toBeCloseTo(0.2249, 3);
    expect(b).toBeCloseTo(0.1258, 3);
  });
  it("round-trips", () => {
    const rgb = hexToLinear("#3b82f6");
    const [L, a, b] = linearToOklab(rgb);
    const back = oklabToLinear(L, a, b);
    back.forEach((v, i) => expect(v).toBeCloseTo(rgb[i], 6));
  });
});

describe("CIELAB (D65)", () => {
  it("maps white to L=100", () => {
    const [L, a, b] = linearToLab([1, 1, 1]);
    expect(L).toBeCloseTo(100, 2);
    expect(Math.abs(a)).toBeLessThan(0.01);
    expect(Math.abs(b)).toBeLessThan(0.01);
  });
  it("matches published sRGB red (D65)", () => {
    const [L, a, b] = linearToLab([1, 0, 0]);
    expect(L).toBeCloseTo(53.24, 1);
    expect(a).toBeCloseTo(80.09, 1);
    expect(b).toBeCloseTo(67.2, 1);
  });
  it("round-trips", () => {
    const rgb = hexToLinear("#8844cc");
    const [L, a, b] = linearToLab(rgb);
    labToLinear(L, a, b).forEach((v, i) => expect(v).toBeCloseTo(rgb[i], 6));
  });
});

describe("HSLuv", () => {
  it("maps pure red to hue ~12.2, saturation 100", () => {
    const [L, S, H] = linearToHsluv([1, 0, 0]);
    expect(H).toBeCloseTo(12.18, 1);
    expect(S).toBeCloseTo(100, 1);
    expect(L).toBeCloseTo(53.24, 1);
  });
  it("round-trips", () => {
    const rgb = hexToLinear("#22aa77");
    const [L, S, H] = linearToHsluv(rgb);
    hsluvToLinear(L, S, H).forEach((v, i) => expect(v).toBeCloseTo(rgb[i], 5));
  });
  it("keeps saturation 100 inside sRGB", () => {
    for (let h = 0; h < 360; h += 30) {
      for (const L of [10, 40, 70, 90]) {
        hsluvToLinear(L, 100, h).forEach((v) => {
          expect(v).toBeGreaterThan(-1e-4);
          expect(v).toBeLessThan(1 + 1e-4);
        });
      }
    }
  });
});

describe("WCAG contrast", () => {
  it("black on white is 21:1", () => {
    expect(wcagContrast("#000000", "#ffffff")).toBeCloseTo(21, 6);
  });
  it("is symmetric and 1:1 for equal colours", () => {
    expect(wcagContrast("#777777", "#777777")).toBe(1);
    expect(wcagContrast("#123456", "#fedcba")).toBeCloseTo(wcagContrast("#fedcba", "#123456"), 10);
  });
  it("matches a known pair (#767676 on white = 4.54:1)", () => {
    expect(wcagContrast("#767676", "#ffffff")).toBeCloseTo(4.54, 2);
  });
  it("relative luminance of mid grey", () => {
    expect(relativeLuminance("#808080")).toBeCloseTo(0.2159, 3);
  });
});

describe("APCA", () => {
  it("matches reference Lc for black on white and white on black", () => {
    expect(apcaContrast("#000000", "#ffffff")).toBeCloseTo(106.04, 1);
    expect(apcaContrast("#ffffff", "#000000")).toBeCloseTo(-107.88, 1);
  });
  it("is zero for identical colours", () => {
    expect(apcaContrast("#888888", "#888888")).toBe(0);
  });
});

describe("luminance solver", () => {
  for (const id of SPACE_ORDER) {
    it(`hits the luminance target in ${id} for varied hues and chroma`, () => {
      const space = SPACES[id];
      for (const hue of [0, 45, 100, 150, 200, 265, 320]) {
        for (const y of [0.9, 0.5, 0.18, 0.05, 0.01]) {
          const c = space.chroma.max * 0.6;
          const solved = solveForLuminance(space, y, hue, c);
          expect(Math.abs(relativeLuminance(solved.hex) - y)).toBeLessThan(0.004 + y * 0.02);
        }
      }
    });
  }
  it("reduces chroma instead of leaving the gamut", () => {
    const solved = solveForLuminance(SPACES.oklch, 0.05, 100, 0.3);
    expect(solved.clipped).toBe(true);
    expect(solved.chroma).toBeLessThan(0.3);
  });
  it("does not flag colours that fit", () => {
    expect(solveForLuminance(SPACES.oklch, 0.2, 260, 0.05).clipped).toBe(false);
  });
  it("returns white and black at the extremes", () => {
    expect(solveForLuminance(SPACES.oklch, 1, 100, 0.1).hex).toBe("#ffffff");
    expect(solveForLuminance(SPACES.oklch, 0, 100, 0.1).hex).toBe("#000000");
  });
});
