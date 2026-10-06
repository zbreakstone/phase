import type { SpaceId } from "../color/spaces";

export type HueDirection = "shortest" | "increasing" | "decreasing";

export interface HueConfig {
  id: string;
  name: string;
  /** Hue angle at the lightest shade (degrees). */
  hueLight: number;
  /** Hue angle at the darkest shade (degrees). */
  hueDark: number;
  /** -1 shifts earlier (toward light), +1 shifts later (toward dark). */
  hueBias: number;
  hueDirection: HueDirection;
  chromaLight: number;
  chromaMid: number;
  chromaDark: number;
}

export interface ContrastRule {
  id: string;
  /** Minimum difference in grade between two shades. */
  minDiff: number;
  /** Contrast ratio those shades must reach. */
  ratio: number;
}

export type LuminanceMode = "uniform" | "custom";

export interface ScaleConfig {
  grades: number[];
  luminanceMode: LuminanceMode;
  /** Luminance override per grade, used when luminanceMode is "custom". */
  customLuminance: Record<string, number>;
  includeAnchors: boolean;
  rules: ContrastRule[];
}

export interface PaletteState {
  space: SpaceId;
  scale: ScaleConfig;
  hues: HueConfig[];
  selectedHueId: string | null;
}

export interface Shade {
  grade: number;
  hex: string;
  /** Luminance the grade was aiming for. */
  targetLuminance: number;
  /** Luminance of the final 8-bit colour. */
  luminance: number;
  anchor: boolean;
  /** Chroma requested by the curve at this grade. */
  requestedChroma: number;
  /** Chroma that actually fit in sRGB. */
  chroma: number;
  hue: number;
  clipped: boolean;
}

export interface GeneratedHue {
  hue: HueConfig;
  shades: Shade[];
}
