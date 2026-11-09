import { type RGB, hexToBytes, hexToLinear, linearToOklab, rectToPolar } from "../color/convert";
import { GAMUTS, type Gamut, p3Css } from "../color/gamut";
import { inGamut } from "../color/solve";
import { SPACES } from "../color/spaces";
import type { GeneratedHue, PaletteState, SemanticToken, Shade, TokenRef } from "../palette/types";

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

/** Hex and HSL can only describe sRGB, so a P3 palette loses its extra colors in them. */
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
 * A shade in the requested format. In a P3 palette OKLCH and Display P3 keep the full color;
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
  // "white" and "black" are the shared neutrals, so a hue with either name gets a suffix instead of colliding.
  const seen = new Map<string, number>([
    ["white", 1],
    ["black", 1],
  ]);
  return generated.map((g) => {
    const base = slug(g.hue.name);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return { slug: n === 0 ? base : `${base}-${n + 1}`, shades: g.shades };
  });
}

/** A palette color a semantic token points at, by its exported name: a hue's step, or the shared white or black. */
type Target = { slug: string; grade: number } | { neutral: "white" | "black" };

interface SemanticEntry {
  levels: string[];
  light: Target;
  /** Only when dark mode differs from light. */
  dark: Target | null;
}

/**
 * Assigned semantic tokens as aliases. A whole-color token becomes one alias per step (`warning/500`); a step
 * token is one alias. Unassigned tokens, and steps that no longer exist, are left out.
 */
function semanticEntries(tokens: SemanticToken[] | undefined, generated: GeneratedHue[]): SemanticEntry[] {
  if (!tokens?.length) return [];
  const names = named(generated);
  const byId = new Map(generated.map((g, i) => [g.hue.id, names[i]]));
  const resolve = (ref: TokenRef | null | undefined): Target | null => {
    if (!ref || ref.grade === null) return null;
    if (ref.grade === 0) return { neutral: "white" };
    if (ref.grade === 1000) return { neutral: "black" };
    const n = byId.get(ref.hueId);
    return n && ramp(n.shades).some((s) => s.grade === ref.grade) ? { slug: n.slug, grade: ref.grade } : null;
  };
  const same = (a: Target, b: Target) => ("neutral" in a ? "neutral" in b && a.neutral === b.neutral : !("neutral" in b) && a.slug === b.slug && a.grade === b.grade);
  const out: SemanticEntry[] = [];
  for (const t of tokens) {
    if (!t.light) continue;
    const levels = t.path.split("/");
    if (t.light.grade === null) {
      const n = byId.get(t.light.hueId);
      for (const s of n ? ramp(n.shades) : []) out.push({ levels: [...levels, String(s.grade)], light: { slug: n!.slug, grade: s.grade }, dark: null });
      continue;
    }
    const light = resolve(t.light);
    if (!light) continue;
    const dark = resolve(t.dark);
    out.push({ levels, light, dark: dark && !same(dark, light) ? dark : null });
  }
  return out;
}

const targetName = (t: Target) => ("neutral" in t ? t.neutral : `${t.slug}-${t.grade}`);
const targetPath = (t: Target) => ("neutral" in t ? [t.neutral] : [t.slug, String(t.grade)]);

/** CSS lines for semantic aliases: the light values, and a `.dark` block for the ones that change. */
function semanticCss(entries: SemanticEntry[], name: (levels: string[]) => string, ref: (t: Target) => string) {
  const light = entries.map((e) => `${name(e.levels)}: var(${ref(e.light)});`);
  const dark = entries.filter((e) => e.dark).map((e) => `${name(e.levels)}: var(${ref(e.dark!)});`);
  return { light, dark };
}

/** The `.dark` override, shadcn-style: add the class to `<html>` (or any ancestor) to switch. */
const darkBlock = (lines: string[]) => (lines.length ? ["", "/* Dark mode: add the .dark class to an ancestor, such as <html>. */", ".dark {", ...indent(lines, "  "), "}"] : []);

/**
 * Puts `value` at `levels` inside nested groups. A name that is both a token and a group (`border` and
 * `border/subtle`) keeps its own value under `rootKey`.
 */
function setNested(root: Record<string, unknown>, levels: string[], value: unknown, rootKey: string) {
  let node = root;
  levels.forEach((level, i) => {
    const last = i === levels.length - 1;
    const here = node[level] as Record<string, unknown> | string | undefined;
    const isToken = typeof here === "string" || (!!here && "$value" in here);
    if (last) {
      if (here && !isToken) (here as Record<string, unknown>)[rootKey] = value;
      else node[level] = value;
      return;
    }
    if (!here) node[level] = {};
    else if (isToken) node[level] = { [rootKey]: here };
    node = node[level] as Record<string, unknown>;
  });
}

/** A hue's own steps. White (0) and black (1000) bookend every hue identically, so they're exported once, not per hue. */
function ramp(shades: Shade[]): Shade[] {
  return shades.filter((s) => !s.anchor);
}

const WHITE = "#ffffff";
const BLACK = "#000000";

/** The one white and one black shared by every hue, in the requested format. */
const neutrals = (format: ColorFormat) => ({ white: formatColor(WHITE, format), black: formatColor(BLACK, format) });

export function toCss(generated: GeneratedHue[], format: ColorFormat, prefix = "", gamut: Gamut = "srgb", tokens?: SemanticToken[]): string {
  const p = prefix ? `${prefix}-` : "";
  const lines: string[] = [":root {"];
  const nt = neutrals(format);
  lines.push(`  --${p}white: ${nt.white};`, `  --${p}black: ${nt.black};`, "");
  named(generated).forEach((n, i) => {
    if (i > 0) lines.push("");
    for (const s of ramp(n.shades)) {
      lines.push(`  --${p}${n.slug}-${s.grade}: ${formatShade(s, format, gamut)};`);
    }
  });
  const sem = cssSemantic(generated, tokens, p);
  if (sem.light.length) lines.push("", "  /* Semantic */", ...indent(sem.light, "  "));
  lines.push("}", ...darkBlock(sem.dark));
  return lines.join("\n");
}

const cssSemantic = (generated: GeneratedHue[], tokens: SemanticToken[] | undefined, p: string) =>
  semanticCss(semanticEntries(tokens, generated), (levels) => `--${p}${levels.join("-")}`, (t) => `--${p}${targetName(t)}`);

const tailwindSemantic = (generated: GeneratedHue[], tokens: SemanticToken[] | undefined) =>
  semanticCss(semanticEntries(tokens, generated), (levels) => `--color-${levels.join("-")}`, (t) => `--color-${targetName(t)}`);

/**
 * Format used for the P3 block of a dual-gamut export. Hex, RGB and HSL cannot describe P3, so they
 * become `color(display-p3 …)`; OKLCH stays OKLCH.
 */
export function p3BlockFormat(format: ColorFormat): ColorFormat {
  return format === "oklch" ? "oklch" : "rgb";
}

/** Same color to the eye (well under a just-noticeable difference), so 8-bit rounding does not count as a change. */
const sameColor = (a: RGB, b: RGB) => {
  const [l1, a1, b1] = linearToOklab(a);
  const [l2, a2, b2] = linearToOklab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2) < 0.004;
};

/**
 * The base value of a dual-gamut export. Hex, RGB and HSL are 8-bit sRGB, so they take the sRGB solve.
 * OKLCH can carry the full-precision color, so when the P3 solve fits in sRGB it takes that instead,
 * which every screen can show and which matches what the editor displays.
 */
function baseOf(s: Shade, w: Shade | undefined, format: ColorFormat): { shade: Shade; gamut: Gamut; final: boolean } {
  if (format === "oklch" && w && inGamut(w.linear, "srgb")) return { shade: w, gamut: "p3", final: true };
  return { shade: s, gamut: "srgb", final: false };
}

/**
 * Both gamuts as CSS custom properties. The base declarations are the palette solved in sRGB, which
 * every screen can show. The `@media (color-gamut: p3)` block overrides only the colors that differ,
 * using the palette solved in P3. Both solves hit the same luminance targets, so contrast holds either way.
 * In OKLCH, a P3 color that fits in sRGB goes straight in the base declarations instead.
 */
function dualBlocks(
  srgb: GeneratedHue[],
  p3: GeneratedHue[],
  format: ColorFormat,
  name: (slug: string, grade: number) => string,
  neutralName: (kind: "white" | "black") => string,
) {
  // White and black are identical in both gamuts, so they only appear in the base block.
  const nt = neutrals(format);
  const base: string[] = [`${neutralName("white")}: ${nt.white};`, `${neutralName("black")}: ${nt.black};`, ""];
  const wide: string[] = [];
  const a = named(srgb);
  const b = named(p3);
  const wideFormat = p3BlockFormat(format);
  a.forEach((n, i) => {
    if (i > 0) base.push("");
    const other = b[i];
    for (const s of ramp(n.shades)) {
      const w = other?.shades.find((x) => x.grade === s.grade);
      const pick = baseOf(s, w, format);
      base.push(`${name(n.slug, s.grade)}: ${formatShade(pick.shade, format, pick.gamut)};`);
      if (w && !pick.final && !sameColor(w.linear, s.linear)) wide.push(`${name(n.slug, s.grade)}: ${formatShade(w, wideFormat, "p3")};`);
    }
  });
  return { base, wide };
}

const indent = (lines: string[], pad: string) => lines.map((l) => (l ? pad + l : l));

/** sRGB base plus a Display P3 override inside `@media (color-gamut: p3)`. */
export function toCssDual(srgb: GeneratedHue[], p3: GeneratedHue[], format: ColorFormat, prefix = "", tokens?: SemanticToken[]): string {
  const p = prefix ? `${prefix}-` : "";
  const { base, wide } = dualBlocks(srgb, p3, format, (slug, grade) => `--${p}${slug}-${grade}`, (kind) => `--${p}${kind}`);
  const sem = cssSemantic(srgb, tokens, p);
  if (sem.light.length) base.push("", "/* Semantic */", ...sem.light);
  const out = [":root {", ...indent(base, "  "), "}", ...darkBlock(sem.dark)];
  if (wide.length) out.push("", "/* Wider-gamut screens: same contrast, more saturated color. */", "@media (color-gamut: p3) {", "  :root {", ...indent(wide, "    "), "  }", "}");
  return out.join("\n");
}

/** Tailwind v4 theme in sRGB, with the P3 colors overriding the theme variables on wide-gamut screens. */
export function toTailwindV4Dual(srgb: GeneratedHue[], p3: GeneratedHue[], format: ColorFormat, tokens?: SemanticToken[]): string {
  const { base, wide } = dualBlocks(srgb, p3, format, (slug, grade) => `--color-${slug}-${grade}`, (kind) => `--color-${kind}`);
  const sem = tailwindSemantic(srgb, tokens);
  if (sem.light.length) base.push("", "/* Semantic */", ...sem.light);
  const out = ['@import "tailwindcss";', "", "@theme {", ...indent(base, "  "), "}", ...darkBlock(sem.dark)];
  if (wide.length) out.push("", "/* Wider-gamut screens: same contrast, more saturated color. */", "@media (color-gamut: p3) {", "  :root {", ...indent(wide, "    "), "  }", "}");
  return out.join("\n");
}

/**
 * Design Tokens JSON. By default it is just `$type` and `$value` per color, which is what a codebase
 * import wants. `includeMetadata` adds the gamut, color space, contrast rules and per-step luminance
 * under `$extensions.phase`, for auditing a file or rebuilding it in Phase.
 */
export function toTokensJson(state: PaletteState, generated: GeneratedHue[], format: ColorFormat, includeMetadata = false): string {
  const color: Record<string, unknown> = neutralTokens(format);
  for (const n of named(generated)) {
    const group: Record<string, unknown> = {};
    for (const s of ramp(n.shades)) group[String(s.grade)] = tokenFor(s, format, state.gamut, includeMetadata);
    color[n.slug] = group;
  }
  const doc: Record<string, unknown> = {
    $description: "Contrast-safe color scale generated with Phase.",
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
  const semantic = semanticTokens(state.tokens, generated);
  if (semantic) doc.semantic = semantic;
  return JSON.stringify(doc, null, 2);
}

/**
 * Tokens JSON with both gamuts. `$value` stays the standard sRGB color so DTCG tools (Style Dictionary,
 * Tokens Studio) read the file unchanged; the Display P3 solve rides along in `$extensions.gamut["display-p3"]`.
 */
export function toTokensJsonDual(state: PaletteState, srgb: GeneratedHue[], p3: GeneratedHue[], format: ColorFormat, includeMetadata = false): string {
  const color: Record<string, unknown> = neutralTokens(format);
  const a = named(srgb);
  const b = named(p3);
  const wideFormat = p3BlockFormat(format);
  a.forEach((n, i) => {
    const group: Record<string, unknown> = {};
    for (const s of ramp(n.shades)) {
      const w = b[i]?.shades.find((x) => x.grade === s.grade) ?? s;
      const base = baseOf(s, w, format);
      group[String(s.grade)] = {
        $type: "color",
        $value: formatShade(base.shade, format, base.gamut),
        $extensions: {
          gamut: { "display-p3": formatShade(w, wideFormat, "p3") },
          ...(includeMetadata ? { phase: { luminance: { srgb: round(s.luminance, 4), p3: round(w.luminance, 4) } } } : {}),
        },
      };
    }
    color[n.slug] = group;
  });
  const doc: Record<string, unknown> = {
    $description: "Contrast-safe color scale generated with Phase, solved separately for sRGB and Display P3.",
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
  const semantic = semanticTokens(state.tokens, srgb);
  if (semantic) doc.semantic = semantic;
  return JSON.stringify(doc, null, 2);
}

/**
 * Semantic tokens as DTCG aliases into the `color` group. A dark value that differs rides along in
 * `$extensions.phase.dark`, since DTCG has no modes of its own.
 */
function semanticTokens(tokens: SemanticToken[] | undefined, generated: GeneratedHue[]): Record<string, unknown> | null {
  const entries = semanticEntries(tokens, generated);
  if (!entries.length) return null;
  const alias = (t: Target) => `{color.${targetPath(t).join(".")}}`;
  const root: Record<string, unknown> = {};
  for (const e of entries) {
    setNested(root, e.levels, { $type: "color", $value: alias(e.light), ...(e.dark ? { $extensions: { phase: { dark: alias(e.dark) } } } : {}) }, "$root");
  }
  return root;
}

function neutralTokens(format: ColorFormat) {
  const nt = neutrals(format);
  return { white: { $type: "color", $value: nt.white }, black: { $type: "color", $value: nt.black } };
}

function tokenFor(shade: Shade, format: ColorFormat, gamut: Gamut, includeMetadata: boolean) {
  return {
    $type: "color",
    $value: formatShade(shade, format, gamut),
    // The step is already the key, so only the measured luminance is extra.
    ...(includeMetadata ? { $extensions: { phase: { luminance: round(shade.luminance, 4) } } } : {}),
  };
}

/** Nested JS object literal lines for a Tailwind v3 color group, keys quoted only when they need it. */
function jsObjectLines(obj: Record<string, unknown>, pad: string): string[] {
  const key = (k: string) => (/^[a-zA-Z_$][\w$]*$/.test(k) || /^\d+$/.test(k) ? k : JSON.stringify(k));
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === "string" ? [`${pad}${key(k)}: ${JSON.stringify(v)},`] : [`${pad}${key(k)}: {`, ...jsObjectLines(v as Record<string, unknown>, pad + "  "), `${pad}},`],
  );
}

export function toTailwindV3(generated: GeneratedHue[], format: ColorFormat, gamut: Gamut = "srgb", tokens?: SemanticToken[]): string {
  const lines = [
    "/** @type {import('tailwindcss').Config} */",
    "module.exports = {",
    "  theme: {",
    "    extend: {",
    "      colors: {",
  ];
  const nt = neutrals(format);
  lines.push(`        white: ${JSON.stringify(nt.white)},`, `        black: ${JSON.stringify(nt.black)},`);
  for (const n of named(generated)) {
    lines.push(`        ${JSON.stringify(n.slug)}: {`);
    for (const s of ramp(n.shades)) {
      lines.push(`          ${s.grade}: ${JSON.stringify(formatShade(s, format, gamut))},`);
    }
    lines.push("        },");
  }
  const entries = semanticEntries(tokens, generated);
  if (entries.length) {
    // A config file holds plain values, so semantic colors get their light value; dark ones need CSS variables.
    const byName = new Map<string, string>([["white", nt.white], ["black", nt.black]]);
    for (const n of named(generated)) for (const s of ramp(n.shades)) byName.set(`${n.slug}-${s.grade}`, formatShade(s, format, gamut));
    const semantic: Record<string, unknown> = {};
    for (const e of entries) setNested(semantic, e.levels, byName.get(targetName(e.light))!, "DEFAULT");
    lines.push("        // Semantic (light values; for dark mode, use the CSS or Tailwind v4 export)", ...jsObjectLines(semantic, "        "));
  }
  lines.push("      },", "    },", "  },", "};");
  return lines.join("\n");
}

export function toTailwindV4(generated: GeneratedHue[], format: ColorFormat, gamut: Gamut = "srgb", tokens?: SemanticToken[]): string {
  const nt = neutrals(format);
  const lines = ["@import \"tailwindcss\";", "", "@theme {", `  --color-white: ${nt.white};`, `  --color-black: ${nt.black};`, ""];
  named(generated).forEach((n, i) => {
    if (i > 0) lines.push("");
    for (const s of ramp(n.shades)) {
      lines.push(`  --color-${n.slug}-${s.grade}: ${formatShade(s, format, gamut)};`);
    }
  });
  const sem = tailwindSemantic(generated, tokens);
  if (sem.light.length) lines.push("", "  /* Semantic */", ...indent(sem.light, "  "));
  lines.push("}", ...darkBlock(sem.dark));
  return lines.join("\n");
}

export const FIGMA_COLLECTION = "Phase palette";

/**
 * Figma's variables JSON (Variables panel → Import): an array of collections, each with named modes
 * holding nested groups of tokens. Hues become groups and grades become color variables,
 * so a shade is named `colors/red/500`. Figma reads hex, so a P3 palette is clipped to sRGB here.
 */
function figmaColors(generated: GeneratedHue[], prefix: string) {
  const p = prefix ? `${prefix}-` : "";
  const colors: Record<string, unknown> = {};
  for (const kind of ["white", "black"] as const) {
    colors[kind] = {
      $type: "color",
      $value: kind === "white" ? WHITE : BLACK,
      $scopes: ["ALL_FILLS", "STROKE_COLOR"],
      $codeSyntax: { WEB: `var(--${p}${kind})` },
    };
  }
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

export const FIGMA_SEMANTIC_COLLECTION = "Semantic";

/**
 * Semantic tokens as their own collection with Light and Dark modes, each variable an alias of a palette
 * variable (`{colors.gray.200}`). Null when nothing is assigned.
 */
function figmaSemantic(generated: GeneratedHue[], tokens: SemanticToken[] | undefined, prefix: string) {
  const entries = semanticEntries(tokens, generated);
  if (!entries.length) return null;
  const p = prefix ? `${prefix}-` : "";
  const alias = (t: Target) => `{colors.${targetPath(t).join(".")}}`;
  const mode = (dark: boolean) => {
    const root: Record<string, unknown> = {};
    for (const e of entries) {
      const t = dark && e.dark ? e.dark : e.light;
      setNested(root, e.levels, { $type: "color", $value: alias(t), $scopes: ["ALL_FILLS", "STROKE_COLOR"], $codeSyntax: { WEB: `var(--${p}${e.levels.join("-")})` } }, "default");
    }
    return root;
  };
  return { [FIGMA_SEMANTIC_COLLECTION]: { modes: { Light: { semantic: mode(false) }, Dark: { semantic: mode(true) } } } };
}

export function toFigmaVariables(generated: GeneratedHue[], prefix = "", tokens?: SemanticToken[]): string {
  const semantic = figmaSemantic(generated, tokens, prefix);
  return JSON.stringify([{ [FIGMA_COLLECTION]: { modes: { Default: { colors: figmaColors(generated, prefix) } } } }, ...(semantic ? [semantic] : [])], null, 2);
}

/**
 * One collection with an "sRGB" mode and a "Display P3" mode, each from its own solve. Figma reads
 * hex, so the P3 mode holds the P3 palette's sRGB fallback values unless the Figma file is set to
 * Display P3.
 */
export function toFigmaVariablesDual(srgb: GeneratedHue[], p3: GeneratedHue[], prefix = "", tokens?: SemanticToken[]): string {
  const semantic = figmaSemantic(srgb, tokens, prefix);
  return JSON.stringify(
    [{ [FIGMA_COLLECTION]: { modes: { sRGB: { colors: figmaColors(srgb, prefix) }, "Display P3": { colors: figmaColors(p3, prefix) } } } }, ...(semantic ? [semantic] : [])],
    null,
    2,
  );
}
