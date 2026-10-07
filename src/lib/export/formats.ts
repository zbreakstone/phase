import { type RGB, hexToBytes, hexToLinear, linearToOklab, rectToPolar } from "../color/convert";
import { GAMUTS, type Gamut, p3Css } from "../color/gamut";
import { SPACES } from "../color/spaces";
import type { GeneratedHue, PaletteState, Shade } from "../palette/types";

export type ColorFormat = "hex" | "rgb" | "hsl" | "oklch";

export const COLOR_FORMATS: { id: ColorFormat; label: string }[] = [
  { id: "hex", label: "Hex" },
  { id: "rgb", label: "RGB" },
  { id: "hsl", label: "HSL" },
  { id: "oklch", label: "OKLCH" },
];

/** Label for a format in the picker. In a P3 palette "RGB" is written as color(display-p3 …). */
export function formatLabel(format: ColorFormat, gamut: Gamut = "srgb"): string {
  if (format === "rgb" && gamut === "p3") return "Display P3";
  return COLOR_FORMATS.find((f) => f.id === format)!.label;
}

/** Hex and HSL can only describe sRGB, so a P3 palette loses its extra colours in them. */
export function formatClipsGamut(format: ColorFormat, gamut: Gamut): boolean {
  return gamut === "p3" && (format === "hex" || format === "hsl");
}

export function slug(name: string): string {
  const s = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "hue";
}

const round = (n: number, d: number) => {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
};

export function formatColor(hex: string, format: ColorFormat): string {
  if (format === "hex") return hex;
  const [r, g, b] = hexToBytes(hex);
  if (format === "rgb") return `rgb(${r} ${g} ${b})`;
  if (format === "hsl") {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    const d = max - min;
    let h = 0;
    let s = 0;
    if (d > 0) {
      s = d / (1 - Math.abs(2 * l - 1));
      if (max === rn) h = ((gn - bn) / d) % 6;
      else if (max === gn) h = (bn - rn) / d + 2;
      else h = (rn - gn) / d + 4;
      h = (h * 60 + 360) % 360;
    }
    return `hsl(${round(h, 1)} ${round(s * 100, 1)}% ${round(l * 100, 1)}%)`;
  }
  return oklchString(hexToLinear(hex));
}

function oklchString(linear: RGB): string {
  const [L, a, bb] = linearToOklab(linear);
  const [C, h] = rectToPolar(a, bb);
  const chroma = C < 0.0005 ? 0 : C;
  return `oklch(${trim(L, 3)} ${trim(chroma, 3)} ${chroma === 0 ? 0 : trim(h, 3)})`;
}

/**
 * A shade in the requested format. In a P3 palette OKLCH and Display P3 keep the full colour;
 * hex and HSL fall back to the clipped sRGB value.
 */
export function formatShade(shade: Pick<Shade, "hex" | "linear">, format: ColorFormat, gamut: Gamut = "srgb"): string {
  if (gamut === "p3") {
    if (format === "oklch") return oklchString(shade.linear);
    if (format === "rgb") return p3Css(shade.linear);
  }
  return formatColor(shade.hex, format);
}

/** Fixed decimals with trailing zeros dropped and no negative zero. */
function trim(n: number, decimals: number): string {
  const v = Number(n.toFixed(decimals));
  return String(Object.is(v, -0) ? 0 : v);
}

interface Named {
  slug: string;
  shades: Shade[];
}

function named(generated: GeneratedHue[]): Named[] {
  const seen = new Map<string, number>();
  return generated.map((g) => {
    const base = slug(g.hue.name);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return { slug: n === 0 ? base : `${base}-${n + 1}`, shades: g.shades };
  });
}

function ramp(shades: Shade[]): Shade[] {
  return shades;
}

export function toCss(generated: GeneratedHue[], format: ColorFormat, prefix = "", gamut: Gamut = "srgb"): string {
  const p = prefix ? `${prefix}-` : "";
  const lines: string[] = [":root {"];
  named(generated).forEach((n, i) => {
    if (i > 0) lines.push("");
    for (const s of ramp(n.shades)) {
      lines.push(`  --${p}${n.slug}-${s.grade}: ${formatShade(s, format, gamut)};`);
    }
  });
  lines.push("}");
  return lines.join("\n");
}

export function toTokensJson(state: PaletteState, generated: GeneratedHue[], format: ColorFormat): string {
  const color: Record<string, Record<string, unknown>> = {};
  for (const n of named(generated)) {
    const group: Record<string, unknown> = {};
    for (const s of ramp(n.shades)) group[String(s.grade)] = tokenFor(s, format, state.gamut);
    color[n.slug] = group;
  }
  const doc = {
    $description: "Contrast-safe colour scale generated with Phase.",
    $extensions: {
      phase: {
        colorSpace: SPACES[state.space].label,
        gamut: GAMUTS[state.gamut].label,
        magicNumbers: state.scale.rules.map((r) => ({ minGradeDifference: r.minDiff, minContrast: r.ratio })),
      },
    },
    color,
  };
  return JSON.stringify(doc, null, 2);
}

function tokenFor(shade: Shade, format: ColorFormat, gamut: Gamut) {
  return {
    $type: "color",
    $value: formatShade(shade, format, gamut),
    $extensions: { phase: { grade: shade.grade, luminance: round(shade.luminance, 4) } },
  };
}

export function toTailwindV3(generated: GeneratedHue[], format: ColorFormat, gamut: Gamut = "srgb"): string {
  const lines = [
    "/** @type {import('tailwindcss').Config} */",
    "module.exports = {",
    "  theme: {",
    "    extend: {",
    "      colors: {",
  ];
  for (const n of named(generated)) {
    lines.push(`        ${JSON.stringify(n.slug)}: {`);
    for (const s of ramp(n.shades)) {
      lines.push(`          ${s.grade}: ${JSON.stringify(formatShade(s, format, gamut))},`);
    }
    lines.push("        },");
  }
  lines.push("      },", "    },", "  },", "};");
  return lines.join("\n");
}

export function toTailwindV4(generated: GeneratedHue[], format: ColorFormat, gamut: Gamut = "srgb"): string {
  const lines = ["@import \"tailwindcss\";", "", "@theme {"];
  named(generated).forEach((n, i) => {
    if (i > 0) lines.push("");
    for (const s of ramp(n.shades)) {
      lines.push(`  --color-${n.slug}-${s.grade}: ${formatShade(s, format, gamut)};`);
    }
  });
  lines.push("}");
  return lines.join("\n");
}
