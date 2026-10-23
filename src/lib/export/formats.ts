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

/**
 * Format used for the P3 block of a dual-gamut export. Hex, RGB and HSL cannot describe P3, so they
 * become `color(display-p3 …)`; OKLCH stays OKLCH.
 */
export function p3BlockFormat(format: ColorFormat): ColorFormat {
  return format === "oklch" ? "oklch" : "rgb";
}

/** Same colour to the eye (well under a just-noticeable difference), so 8-bit rounding does not count as a change. */
const sameColour = (a: RGB, b: RGB) => {
  const [l1, a1, b1] = linearToOklab(a);
  const [l2, a2, b2] = linearToOklab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2) < 0.004;
};

/**
 * Both gamuts as CSS custom properties. The base declarations are the palette solved in sRGB, which
 * every screen can show. The `@media (color-gamut: p3)` block overrides only the colours that differ,
 * using the palette solved in P3. Both solves hit the same luminance targets, so contrast holds either way.
 */
function dualBlocks(srgb: GeneratedHue[], p3: GeneratedHue[], format: ColorFormat, name: (slug: string, grade: number) => string) {
  const base: string[] = [];
  const wide: string[] = [];
  const a = named(srgb);
  const b = named(p3);
  const wideFormat = p3BlockFormat(format);
  a.forEach((n, i) => {
    if (i > 0) base.push("");
    const other = b[i];
    for (const s of ramp(n.shades)) {
      base.push(`${name(n.slug, s.grade)}: ${formatShade(s, format, "srgb")};`);
      const w = other?.shades.find((x) => x.grade === s.grade);
      if (w && !sameColour(w.linear, s.linear)) wide.push(`${name(n.slug, s.grade)}: ${formatShade(w, wideFormat, "p3")};`);
    }
  });
  return { base, wide };
}

const indent = (lines: string[], pad: string) => lines.map((l) => (l ? pad + l : l));

/** sRGB base plus a Display P3 override inside `@media (color-gamut: p3)`. */
export function toCssDual(srgb: GeneratedHue[], p3: GeneratedHue[], format: ColorFormat, prefix = ""): string {
  const p = prefix ? `${prefix}-` : "";
  const { base, wide } = dualBlocks(srgb, p3, format, (slug, grade) => `--${p}${slug}-${grade}`);
  const out = [":root {", ...indent(base, "  "), "}"];
  if (wide.length) out.push("", "/* Wider-gamut screens: same contrast, more saturated colour. */", "@media (color-gamut: p3) {", "  :root {", ...indent(wide, "    "), "  }", "}");
  return out.join("\n");
}

/** Tailwind v4 theme in sRGB, with the P3 colours overriding the theme variables on wide-gamut screens. */
export function toTailwindV4Dual(srgb: GeneratedHue[], p3: GeneratedHue[], format: ColorFormat): string {
  const { base, wide } = dualBlocks(srgb, p3, format, (slug, grade) => `--color-${slug}-${grade}`);
  const out = ['@import "tailwindcss";', "", "@theme {", ...indent(base, "  "), "}"];
  if (wide.length) out.push("", "/* Wider-gamut screens: same contrast, more saturated colour. */", "@media (color-gamut: p3) {", "  :root {", ...indent(wide, "    "), "  }", "}");
  return out.join("\n");
}

/**
 * Design Tokens JSON. By default it is just `$type` and `$value` per colour, which is what a codebase
 * import wants. `includeMetadata` adds the gamut, colour space, contrast rules and per-step luminance
 * under `$extensions.phase`, for auditing a file or rebuilding it in Phase.
 */
export function toTokensJson(state: PaletteState, generated: GeneratedHue[], format: ColorFormat, includeMetadata = false): string {
  const color: Record<string, Record<string, unknown>> = {};
  for (const n of named(generated)) {
    const group: Record<string, unknown> = {};
    for (const s of ramp(n.shades)) group[String(s.grade)] = tokenFor(s, format, state.gamut, includeMetadata);
    color[n.slug] = group;
  }
  const doc: Record<string, unknown> = {
    $description: "Contrast-safe colour scale generated with Phase.",
    ...(includeMetadata
      ? {
          $extensions: {
            phase: {
              colorSpace: SPACES[state.space].label,
              gamut: GAMUTS[state.gamut].label,
              magicNumbers: state.scale.rules.map((r) => ({ minGradeDifference: r.minDiff, minContrast: r.ratio })),
            },
          },
        }
      : {}),
    color,
  };
  return JSON.stringify(doc, null, 2);
}

/**
 * Tokens JSON with both gamuts. `$value` stays the standard sRGB colour so DTCG tools (Style Dictionary,
 * Tokens Studio) read the file unchanged; the Display P3 solve rides along in `$extensions.phase.p3`.
 */
export function toTokensJsonDual(state: PaletteState, srgb: GeneratedHue[], p3: GeneratedHue[], format: ColorFormat, includeMetadata = false): string {
  const color: Record<string, Record<string, unknown>> = {};
  const a = named(srgb);
  const b = named(p3);
  const wideFormat = p3BlockFormat(format);
  a.forEach((n, i) => {
    const group: Record<string, unknown> = {};
    for (const s of ramp(n.shades)) {
      const w = b[i]?.shades.find((x) => x.grade === s.grade) ?? s;
      group[String(s.grade)] = {
        $type: "color",
        $value: formatShade(s, format, "srgb"),
        $extensions: {
          phase: {
            p3: formatShade(w, wideFormat, "p3"),
            ...(includeMetadata ? { luminance: { srgb: round(s.luminance, 4), p3: round(w.luminance, 4) } } : {}),
          },
        },
      };
    }
    color[n.slug] = group;
  });
  const doc: Record<string, unknown> = {
    $description: "Contrast-safe colour scale generated with Phase, solved separately for sRGB and Display P3.",
    ...(includeMetadata
      ? {
          $extensions: {
            phase: {
              colorSpace: SPACES[state.space].label,
              gamuts: ["sRGB", "Display P3"],
              magicNumbers: state.scale.rules.map((r) => ({ minGradeDifference: r.minDiff, minContrast: r.ratio })),
            },
          },
        }
      : {}),
    color,
  };
  return JSON.stringify(doc, null, 2);
}

function tokenFor(shade: Shade, format: ColorFormat, gamut: Gamut, includeMetadata: boolean) {
  return {
    $type: "color",
    $value: formatShade(shade, format, gamut),
    // The step is already the key, so only the measured luminance is extra.
    ...(includeMetadata ? { $extensions: { phase: { luminance: round(shade.luminance, 4) } } } : {}),
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

export const FIGMA_COLLECTION = "Phase palette";

/**
 * Figma's variables JSON (Variables panel → Import): an array of collections, each with named modes
 * holding nested groups of tokens. Hues become groups and grades become colour variables,
 * so a shade is named `colors/red/500`. Figma reads hex, so a P3 palette is clipped to sRGB here.
 */
function figmaColors(generated: GeneratedHue[], prefix: string) {
  const p = prefix ? `${prefix}-` : "";
  const colors: Record<string, Record<string, unknown>> = {};
  for (const n of named(generated)) {
    const group: Record<string, unknown> = {};
    for (const s of ramp(n.shades)) {
      group[String(s.grade)] = {
        $type: "color",
        $value: s.hex,
        $scopes: ["ALL_FILLS", "STROKE_COLOR"],
        $description: `Luminance ${round(s.luminance, 3)} · OKLCH ${trim(s.oklch.L, 3)} ${trim(s.oklch.C, 3)} ${trim(s.oklch.h, 0)}`,
        $codeSyntax: { WEB: `var(--${p}${n.slug}-${s.grade})` },
      };
    }
    colors[n.slug] = group;
  }
  return colors;
}

export function toFigmaVariables(generated: GeneratedHue[], prefix = ""): string {
  return JSON.stringify([{ [FIGMA_COLLECTION]: { modes: { Default: { colors: figmaColors(generated, prefix) } } } }], null, 2);
}

/**
 * One collection with an "sRGB" mode and a "Display P3" mode, each from its own solve. Figma reads
 * hex, so the P3 mode holds the P3 palette's sRGB fallback values unless the Figma file is set to
 * Display P3.
 */
export function toFigmaVariablesDual(srgb: GeneratedHue[], p3: GeneratedHue[], prefix = ""): string {
  return JSON.stringify(
    [{ [FIGMA_COLLECTION]: { modes: { sRGB: { colors: figmaColors(srgb, prefix) }, "Display P3": { colors: figmaColors(p3, prefix) } } } }],
    null,
    2,
  );
}
