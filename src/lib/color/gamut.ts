import { type RGB, linearToSrgb } from "./convert";

/** The set of colours a palette is allowed to use. */
export type Gamut = "srgb" | "p3";

export const GAMUT_ORDER: Gamut[] = ["srgb", "p3"];
export const DEFAULT_GAMUT: Gamut = "srgb";

export const GAMUTS: Record<Gamut, { label: string; description: string }> = {
  srgb: {
    label: "sRGB",
    description: "The web standard. Every screen shows these colours, and hex works everywhere.",
  },
  p3: {
    label: "Display P3",
    description:
      "About 25% more colours, mostly more vivid reds, oranges and greens. Shown on modern phones, Macs and wide-gamut monitors; other screens fall back to the nearest sRGB colour. Hex and HSL can't hold these colours, so export as OKLCH or Display P3.",
  },
};

/** Linear-light sRGB to linear-light Display P3 (both D65). */
const SRGB_TO_P3 = [
  [0.8224621, 0.177538, 0],
  [0.0331941, 0.9668058, 0],
  [0.0170827, 0.0723974, 0.9105199],
];

const P3_TO_SRGB = [
  [1.2249401, -0.2249404, 0],
  [-0.0420569, 1.0420571, 0],
  [-0.0196376, -0.0786361, 1.0982735],
];

function mul(m: number[][], [r, g, b]: RGB): RGB {
  return [
    m[0][0] * r + m[0][1] * g + m[0][2] * b,
    m[1][0] * r + m[1][1] * g + m[1][2] * b,
    m[2][0] * r + m[2][1] * g + m[2][2] * b,
  ];
}

/** Re-expresses linear-light sRGB coordinates in the primaries of `gamut`. */
export function toGamutSpace(rgb: RGB, gamut: Gamut): RGB {
  return gamut === "p3" ? mul(SRGB_TO_P3, rgb) : rgb;
}

/** Inverse of `toGamutSpace`. */
export function fromGamutSpace(rgb: RGB, gamut: Gamut): RGB {
  return gamut === "p3" ? mul(P3_TO_SRGB, rgb) : rgb;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** CSS `color(display-p3 r g b)` for a linear-light sRGB triple (which may lie outside sRGB). */
export function p3Css(rgb: RGB): string {
  const [r, g, b] = mul(SRGB_TO_P3, rgb).map((c) => {
    const v = Math.round(clamp01(linearToSrgb(clamp01(c))) * 10000) / 10000;
    return String(v);
  });
  return `color(display-p3 ${r} ${g} ${b})`;
}

/** The colour to paint or print for a shade: its P3 value in a P3 palette, its hex otherwise. */
export function cssColor(hex: string, linear: RGB, gamut: Gamut): string {
  return gamut === "p3" ? p3Css(linear) : hex;
}
