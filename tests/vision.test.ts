import { describe, expect, it } from "vitest";
import { hexToLinear, luminanceOfLinear } from "@/lib/color/convert";
import { VISIONS, luminanceGray, simulateVision } from "@/lib/color/vision";

const Y = (hex: string) => luminanceOfLinear(hexToLinear(hex));

describe("colour vision simulation", () => {
  it("leaves typical vision untouched", () => {
    expect(simulateVision("#3b82f6", "normal")).toBe("#3b82f6");
  });
  it("keeps white and black fixed for every simulation", () => {
    for (const v of VISIONS) {
      expect(simulateVision("#ffffff", v.id)).toBe("#ffffff");
      expect(simulateVision("#000000", v.id)).toBe("#000000");
    }
  });
  it("makes red and green much harder to tell apart for red-green types", () => {
    const dist = (a: string, b: string) => {
      const x = hexToLinear(a);
      const y = hexToLinear(b);
      return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
    };
    const red = "#d03a2f";
    const green = "#4f8a2b";
    const normal = dist(red, green);
    for (const v of ["protanopia", "deuteranopia"] as const) {
      expect(dist(simulateVision(red, v), simulateVision(green, v))).toBeLessThan(normal * 0.5);
    }
  });
  it("renders achromatopsia as a neutral grey of equal luminance", () => {
    const out = simulateVision("#3b82f6", "achromatopsia");
    expect(out.slice(1, 3)).toBe(out.slice(3, 5));
    expect(out.slice(3, 5)).toBe(out.slice(5, 7));
    expect(Y(out)).toBeCloseTo(Y("#3b82f6"), 2);
  });
  it("greyscale view keeps luminance", () => {
    for (const hex of ["#d03a2f", "#4f8a2b", "#3b82f6", "#f5c518"]) {
      expect(Y(luminanceGray(hex))).toBeCloseTo(Y(hex), 2);
    }
  });
});
