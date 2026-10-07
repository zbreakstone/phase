import {
  type RGB,
  hsluvToLinear,
  labToLinear,
  linearToHsluv,
  linearToLab,
  linearToOklab,
  oklabToLinear,
  polarToRect,
  rectToPolar,
} from "./convert";

export type SpaceId = "oklch" | "oklab" | "lch" | "lab" | "hsluv";

export interface SpaceDef {
  id: SpaceId;
  label: string;
  short: string;
  description: string;
  /** Polar spaces blend hue as an angle; rectangular ones blend on the a/b plane. */
  interpolation: "polar" | "rect";
  chroma: {
    max: number;
    step: number;
    decimals: number;
    label: string;
  };
  /** Polar coordinates (lightness, chroma, hue degrees) to linear-light sRGB. May be out of gamut. */
  toLinear(L: number, C: number, h: number): RGB;
  /** Linear-light sRGB to polar coordinates. */
  fromLinear(rgb: RGB): { L: number; C: number; h: number };
  /** Upper bound of the lightness axis. */
  lightnessMax: number;
}

function viaRect(
  toLinear: (L: number, a: number, b: number) => RGB,
): (L: number, C: number, h: number) => RGB {
  return (L, C, h) => {
    const [a, b] = polarToRect(C, h);
    return toLinear(L, a, b);
  };
}

const oklabFrom = (rgb: RGB) => {
  const [L, a, b] = linearToOklab(rgb);
  const [C, h] = rectToPolar(a, b);
  return { L, C, h };
};
const labFrom = (rgb: RGB) => {
  const [L, a, b] = linearToLab(rgb);
  const [C, h] = rectToPolar(a, b);
  return { L, C, h };
};

export const SPACES: Record<SpaceId, SpaceDef> = {
  oklch: {
    id: "oklch",
    label: "OKLCH",
    short: "OKLCH",
    description:
      "Polar form of OKLab. Hue stays steady as lightness and chroma change, which makes it the best default for hand-tuned scales.",
    interpolation: "polar",
    chroma: { max: 0.4, step: 0.005, decimals: 3, label: "Chroma (C)" },
    lightnessMax: 1,
    toLinear: viaRect(oklabToLinear),
    fromLinear: oklabFrom,
  },
  oklab: {
    id: "oklab",
    label: "OKLab",
    short: "OKLab",
    description:
      "Same colour model as OKLCH, but the two ends of a scale are blended along a straight line on the a/b plane instead of around the hue wheel.",
    interpolation: "rect",
    chroma: { max: 0.4, step: 0.005, decimals: 3, label: "Chroma (C)" },
    lightnessMax: 1,
    toLinear: viaRect(oklabToLinear),
    fromLinear: oklabFrom,
  },
  lch: {
    id: "lch",
    label: "CIE LCH",
    short: "LCH",
    description:
      "Polar form of CIELAB (D65 white). Perceptually based, but blues drift toward purple as they darken.",
    interpolation: "polar",
    chroma: { max: 150, step: 1, decimals: 0, label: "Chroma (C*)" },
    lightnessMax: 100,
    toLinear: viaRect(labToLinear),
    fromLinear: labFrom,
  },
  lab: {
    id: "lab",
    label: "CIELAB",
    short: "Lab",
    description:
      "The space Stripe used for its accessible palette. Ends of the scale are blended on the a*/b* plane, so a big hue shift passes through less saturated colours.",
    interpolation: "rect",
    chroma: { max: 150, step: 1, decimals: 0, label: "Chroma (C*)" },
    lightnessMax: 100,
    toLinear: viaRect(labToLinear),
    fromLinear: labFrom,
  },
  hsluv: {
    id: "hsluv",
    label: "HSLuv",
    short: "HSLuv",
    description:
      "A human-friendly CIELUV variant where saturation is a percentage of what is possible at each lightness, so colours never leave the sRGB gamut.",
    interpolation: "polar",
    chroma: { max: 100, step: 1, decimals: 0, label: "Saturation (S)" },
    lightnessMax: 100,
    toLinear: (L, S, h) => hsluvToLinear(L, S, h),
    fromLinear: (rgb) => {
      const [L, S, h] = linearToHsluv(rgb);
      return { L, C: S, h };
    },
  },
};

export const SPACE_ORDER: SpaceId[] = ["oklch", "oklab", "lch", "lab", "hsluv"];
export const DEFAULT_SPACE: SpaceId = "oklch";
