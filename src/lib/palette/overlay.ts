import { apcaContrastLinear, contrastFromLuminance } from "@/lib/color/contrast";
import type { RGB } from "@/lib/color/convert";
import { type Gamut, cssColor } from "@/lib/color/gamut";
import { luminanceGrayLinear, simulateVisionLinear, type VisionId } from "@/lib/color/vision";
import type { GeneratedHue, Shade } from "./types";

export type Metric = "contrast" | "apca" | "luminance" | "off";
/** What contrast is measured against: white, black, or a step (by grade) of the same color. */
export type Against = "white" | "black" | number;

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

/**
 * The number to print on a swatch for the current overlay. Against a step, `reference` is that step of the swatch's
 * own color; the reference swatch itself prints nothing.
 */
export function swatchLabel(shade: Shade, overlay: Overlay, reference: Shade | null = null): string {
  if (overlay.metric === "luminance") return fmtLuminance(shade.luminance);
  if (overlay.metric === "off") return "";
  const step = typeof overlay.against === "number";
  if (step && (!reference || reference === shade)) return "";
  // APCA is one-directional: the "against" color is the text and the swatch is the background.
  if (overlay.metric === "apca") return fmtLc(apcaContrastLinear(step ? reference!.linear : overlay.against === "white" ? WHITE : BLACK, shade.linear));
  return fmtRatio(contrastFromLuminance(step ? reference!.luminance : overlay.against === "white" ? 1 : 0, shade.luminance));
}

/** The shade a hue is best summed up by: the middle of its ramp, ignoring the white and black ends. */
/** The shade that stands for a color in a list: the step its source color landed on (picked by hand or by nearest luminance), otherwise 500. */
export function representativeShade(g: GeneratedHue): Shade {
  const target = g.source ? g.source.grade : 500;
  return g.shades.find((s) => s.grade === target) ?? g.shades.find((s) => s.grade === 500) ?? middleShade(g.shades);
}

export function middleShade(shades: Shade[]): Shade {
  const ramp = shades.filter((s) => !s.anchor);
  const list = ramp.length > 0 ? ramp : shades;
  return list[Math.floor((list.length - 1) / 2 + 0.5)] ?? list[0];
}
