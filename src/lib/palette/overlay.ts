import { apcaContrastLinear, contrastFromLuminance } from "@/lib/color/contrast";
import type { RGB } from "@/lib/color/convert";
import { type Gamut, cssColor } from "@/lib/color/gamut";
import { luminanceGrayLinear, simulateVisionLinear, type VisionId } from "@/lib/color/vision";
import { requiredRatio } from "./scale";
import type { ContrastRule, Shade } from "./types";

export type Metric = "contrast" | "apca" | "luminance" | "off";
export type Against = "white" | "black" | "selected";

/** What the swatches show: a number on each one, and whether they're painted as grays or through a vision simulation. */
export interface Overlay {
  metric: Metric;
  against: Against;
  /** Paint each swatch as the gray of equal luminance. */
  grayscale: boolean;
  vision: VisionId;
}

/** Grayscale and vision views, worked from the shade's true linear color (not its clipped hex) so P3 luminance stays exact. */
export function displayHex(shade: Shade, overlay: Overlay): string {
  return overlay.grayscale ? luminanceGrayLinear(shade.linear) : simulateVisionLinear(shade.linear, overlay.vision);
}

/** What to paint a swatch with. */
export function displayShade(shade: Shade, overlay: Overlay, gamut: Gamut): string {
  if (overlay.grayscale || overlay.vision !== "normal") return displayHex(shade, overlay);
  return cssColor(shade.hex, shade.linear, gamut);
}

const WHITE: RGB = [1, 1, 1];
const BLACK: RGB = [0, 0, 0];

/** APCA Lc as a whole number; the sign only says dark-on-light or light-on-dark, which the toggle already fixes. */
const fmtLc = (lc: number) => String(Math.round(Math.abs(lc)));
/** Relative luminance on the 0–1 scale used by the USWDS and Envoy tables. */
const fmtLuminance = (y: number) => y.toFixed(3);
const fmtRatio = (r: number) => (r >= 10 ? r.toFixed(1) : r.toFixed(2));

export type SwatchStatus = "pass" | "fail" | "none" | "self" | null;

/** The number to print on a swatch for the current overlay, and whether it passes the contrast rules against the reference. */
export function swatchMeta(shade: Shade, overlay: Overlay, reference: Shade | null, rules: ContrastRule[]): { label: string; status: SwatchStatus } {
  let label = "";
  let status: SwatchStatus = null;

  if (overlay.metric === "luminance") label = fmtLuminance(shade.luminance);
  // APCA is one-directional: the "against" color is the text and the swatch is the background.
  else if (overlay.metric === "apca" && overlay.against === "white") label = fmtLc(apcaContrastLinear(WHITE, shade.linear));
  else if (overlay.metric === "apca" && overlay.against === "black") label = fmtLc(apcaContrastLinear(BLACK, shade.linear));
  else if (overlay.metric === "apca" && reference) label = reference === shade ? "" : fmtLc(apcaContrastLinear(reference.linear, shade.linear));
  else if (overlay.metric === "contrast" && overlay.against === "white") label = fmtRatio(contrastFromLuminance(1, shade.luminance));
  else if (overlay.metric === "contrast" && overlay.against === "black") label = fmtRatio(contrastFromLuminance(0, shade.luminance));
  else if (overlay.metric === "contrast" && reference) {
    if (reference === shade) {
      status = "self";
    } else {
      const ratio = contrastFromLuminance(reference.luminance, shade.luminance);
      const required = requiredRatio(Math.abs(reference.grade - shade.grade), rules);
      status = required === null ? "none" : ratio + 1e-9 >= required ? "pass" : "fail";
      label = fmtRatio(ratio);
    }
  }
  return { label, status };
}

/** The shade a hue is best summed up by: the middle of its ramp, ignoring the white and black ends. */
export function middleShade(shades: Shade[]): Shade {
  const ramp = shades.filter((s) => !s.anchor);
  const list = ramp.length > 0 ? ramp : shades;
  return list[Math.floor((list.length - 1) / 2 + 0.5)] ?? list[0];
}
