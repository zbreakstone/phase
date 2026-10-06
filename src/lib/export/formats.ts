import { hexToBytes, hexToLinear, linearToOklab, rectToPolar } from "../color/convert";
import { SPACES } from "../color/spaces";
import type { GeneratedHue, PaletteState, Shade } from "../palette/types";

export type ColorFormat = "hex" | "rgb" | "hsl" | "oklch";

export const COLOR_FORMATS: { id: ColorFormat; label: string }[] = [
  { id: "hex", label: "Hex" },
  { id: "rgb", label: "RGB" },
  { id: "hsl", label: "HSL" },
  { id: "oklch", label: "OKLCH" },
];

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
  const [L, a, bb] = linearToOklab(hexToLinear(hex));
  const [C, h] = rectToPolar(a, bb);
  return `oklch(${round(L, 4)} ${round(C, 4)} ${C < 0.002 ? 0 : round(h, 2)})`;
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
  return shades.filter((s) => !s.anchor);
}

function hasAnchors(generated: GeneratedHue[]): boolean {
  return generated.some((g) => g.shades.some((s) => s.anchor));
}

export function toCss(generated: GeneratedHue[], format: ColorFormat, prefix = ""): string {
  const p = prefix ? `${prefix}-` : "";
  const lines: string[] = [":root {"];
  if (hasAnchors(generated)) {
    lines.push(`  --${p}white: ${formatColor("#ffffff", format)};`);
    lines.push(`  --${p}black: ${formatColor("#000000", format)};`);
  }
  named(generated).forEach((n, i) => {
    if (i > 0 || hasAnchors(generated)) lines.push("");
    for (const s of ramp(n.shades)) {
      lines.push(`  --${p}${n.slug}-${s.grade}: ${formatColor(s.hex, format)};`);
    }
  });
  lines.push("}");
  return lines.join("\n");
}

export function toTokensJson(state: PaletteState, generated: GeneratedHue[], format: ColorFormat): string {
  const color: Record<string, Record<string, unknown>> = {};
  if (hasAnchors(generated)) {
    color.white = tokenFor("#ffffff", format, 0, 1);
    color.black = tokenFor("#000000", format, 100, 0);
  }
  for (const n of named(generated)) {
    const group: Record<string, unknown> = {};
    for (const s of ramp(n.shades)) group[String(s.grade)] = tokenFor(s.hex, format, s.grade, s.luminance);
    color[n.slug] = group;
  }
  const doc = {
    $description: "Contrast-safe colour scale generated with Phase.",
    $extensions: {
      phase: {
        colorSpace: SPACES[state.space].label,
        magicNumbers: state.scale.rules.map((r) => ({ minGradeDifference: r.minDiff, minContrast: r.ratio })),
      },
    },
    color,
  };
  return JSON.stringify(doc, null, 2);
}

function tokenFor(hex: string, format: ColorFormat, grade: number, luminance: number) {
  return {
    $type: "color",
    $value: formatColor(hex, format),
    $extensions: { phase: { grade, luminance: round(luminance, 4) } },
  };
}

export function toTailwindV3(generated: GeneratedHue[], format: ColorFormat): string {
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
      lines.push(`          ${s.grade}: ${JSON.stringify(formatColor(s.hex, format))},`);
    }
    lines.push("        },");
  }
  lines.push("      },", "    },", "  },", "};");
  return lines.join("\n");
}

export function toTailwindV4(generated: GeneratedHue[], format: ColorFormat): string {
  const lines = ["@import \"tailwindcss\";", "", "@theme {"];
  named(generated).forEach((n, i) => {
    if (i > 0) lines.push("");
    for (const s of ramp(n.shades)) {
      lines.push(`  --color-${n.slug}-${s.grade}: ${formatColor(s.hex, format)};`);
    }
  });
  lines.push("}");
  return lines.join("\n");
}
