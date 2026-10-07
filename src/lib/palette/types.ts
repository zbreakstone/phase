import type { SpaceId } from "../color/spaces";
import type { SourceAnalysis } from "./source";
import type { SourceAnchor } from "./curve";

export type HueDirection = "shortest" | "increasing" | "decreasing";

export interface SourceColor {
  /** The colour the user entered, as #rrggbb. */
  hex: string;
  /** Grade to land on, or null to use the nearest step by luminance. */
  grade: number | null;
  /** Keep the exact entered colour in the scale instead of adjusting it to the step. */
  pinned: boolean;
}

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
  source?: SourceColor | null;
}

export interface ContrastRule {
  id: string;
  /** Minimum difference in grade between two shades. */
  minDiff: number;
  /** Contrast ratio those shades must reach. */
  ratio: number;
}

export type LuminanceMode = "envoy" | "uniform" | "custom";

export interface ScaleConfig {
  grades: number[];
  luminanceMode: LuminanceMode;
  /** Luminance override per grade, used when luminanceMode is "custom". */
  customLuminance: Record<string, number>;
  rules: ContrastRule[];
}

export type ReferenceMode = "white" | "black" | "custom";

export interface ContrastReference {
  mode: ReferenceMode;
  /** Used when mode is "custom". */
  hex: string;
}

export interface PaletteState {
  space: SpaceId;
  reference: ContrastReference;
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
  /** The final colour read back in OKLCH, whichever space generated it. */
  oklch: { L: number; C: number; h: number };
  /** True for the shade a source colour landed on. */
  isSource?: boolean;
  /** True when the exact source colour was kept (pinned) instead of the solved one. */
  pinned?: boolean;
}

export interface GeneratedHue {
  hue: HueConfig;
  shades: Shade[];
  source: SourceAnalysis | null;
  anchor: SourceAnchor | null;
}
