import { describe, expect, it } from "vitest";
import { defaultState } from "@/lib/palette/defaults";
import { generatePalette } from "@/lib/palette/generate";
import { decodeState, encodeState } from "@/lib/palette/serialize";
import { removeStep, renameStep } from "@/lib/palette/steps";
import { addPreset, assignToken, normalizePath, removeHueFromTokens, tokensAt, updateToken } from "@/lib/palette/tokens";
import { toCss, toFigmaVariables, toTailwindV3, toTailwindV4, toTokensJson } from "@/lib/export/formats";
import type { PaletteState } from "@/lib/palette/types";

const base = () => defaultState();
const hue = (s: PaletteState, name: string) => s.hues.find((h) => h.name.toLowerCase() === name)!.id;

describe("token names", () => {
  it("reads / and . as levels, and tidies each level", () => {
    expect(normalizePath("Border/Subtle Base")).toBe("border/subtle-base");
    expect(normalizePath("text.muted")).toBe("text/muted");
    expect(normalizePath(" / ")).toBeNull();
  });
});

describe("assigning tokens", () => {
  it("moves a name that's already on something else", () => {
    let s = base();
    const gray = hue(s, "gray");
    s = assignToken(s, "border", { hueId: gray, grade: 200 });
    s = assignToken(s, "border", { hueId: gray, grade: 300 });
    expect(s.tokens).toHaveLength(1);
    expect(tokensAt(s, { hueId: gray, grade: 300 }).map((t) => t.path)).toEqual(["border"]);
    expect(tokensAt(s, { hueId: gray, grade: 200 })).toEqual([]);
  });

  it("follows a renamed step and lets go of a removed one or a removed color", () => {
    let s = base();
    const gray = hue(s, "gray");
    s = assignToken(s, "border", { hueId: gray, grade: 200 });
    s = renameStep(s, 200, 250);
    expect(s.tokens![0].light).toEqual({ hueId: gray, grade: 250 });
    s = removeStep(s, 250);
    expect(s.tokens![0].light).toBeNull();
    s = assignToken(s, "warning", { hueId: hue(s, "yellow"), grade: null });
    s = removeHueFromTokens(s, hue(s, "yellow"));
    expect(s.tokens!.find((t) => t.path === "warning")!.light).toBeNull();
  });

  it("adds a preset's names unassigned, once", () => {
    let s = addPreset(base(), "status");
    s = addPreset(s, "status");
    expect(s.tokens!.map((t) => t.path)).toEqual(["info", "positive", "warning", "negative"]);
    expect(s.tokens!.every((t) => t.light === null)).toBe(true);
  });

  it("survives a share link", () => {
    let s = base();
    const gray = hue(s, "gray");
    s = assignToken(s, "background", { hueId: gray, grade: 0 });
    s = updateToken(s, s.tokens![0].id, { dark: { hueId: gray, grade: 950 } });
    const back = decodeState(encodeState(s));
    expect(back.ok && back.state.tokens).toEqual(s.tokens);
  });
});

describe("exporting tokens", () => {
  const setup = () => {
    let s = base();
    const gray = hue(s, "gray");
    s = assignToken(s, "border/subtle/base", { hueId: gray, grade: 200 });
    s = assignToken(s, "border", { hueId: gray, grade: 300 });
    s = assignToken(s, "background", { hueId: gray, grade: 0 });
    s = updateToken(s, s.tokens!.find((t) => t.path === "background")!.id, { dark: { hueId: gray, grade: 950 } });
    s = assignToken(s, "warning", { hueId: hue(s, "yellow"), grade: null });
    s = addPreset(s, "shadcn");
    return { s, gen: generatePalette(s.space, s.scale, s.hues) };
  };

  it("CSS aliases the palette, with a .dark block for values that change", () => {
    const { s, gen } = setup();
    const css = toCss(gen, "hex", "", "srgb", s.tokens);
    expect(css).toContain("--border-subtle-base: var(--gray-200);");
    expect(css).toContain("--border: var(--gray-300);");
    expect(css).toContain("--background: var(--white);");
    expect(css).toContain("--warning-500: var(--yellow-500);");
    expect(css).toMatch(/\.dark \{\n {2}--background: var\(--gray-950\);\n\}/);
    // Unassigned preset names stay out.
    expect(css).not.toContain("--card:");
  });

  it("Tailwind v4 aliases theme colors; v3 gets light values, with DEFAULT for a name that's also a group", () => {
    const { s, gen } = setup();
    expect(toTailwindV4(gen, "hex", "srgb", s.tokens)).toContain("--color-border-subtle-base: var(--color-gray-200);");
    const v3 = toTailwindV3(gen, "hex", "srgb", s.tokens);
    const gray200 = gen.find((g) => g.hue.name.toLowerCase() === "gray")!.shades.find((x) => x.grade === 200)!.hex;
    expect(v3).toContain("border: {");
    expect(v3).toContain(`DEFAULT: "${gen.find((g) => g.hue.name.toLowerCase() === "gray")!.shades.find((x) => x.grade === 300)!.hex}",`);
    expect(v3).toContain(`base: "${gray200}",`);
  });

  it("tokens.json references the color group, nesting levels and keeping $root for a name that's also a group", () => {
    const { s, gen } = setup();
    const json = JSON.parse(toTokensJson(s, gen, "hex"));
    expect(json.semantic.border.subtle.base.$value).toBe("{color.gray.200}");
    expect(json.semantic.border.$root.$value).toBe("{color.gray.300}");
    expect(json.semantic.background.$value).toBe("{color.white}");
    expect(json.semantic.background.$extensions.phase.dark).toBe("{color.gray.950}");
    expect(json.semantic.warning["500"].$value).toBe("{color.yellow.500}");
  });

  it("Figma gets a Semantic collection with Light and Dark modes of aliases", () => {
    const { s, gen } = setup();
    const [, semantic] = JSON.parse(toFigmaVariables(gen, "", s.tokens));
    const modes = semantic.Semantic.modes;
    expect(modes.Light.semantic.background.$value).toBe("{colors.white}");
    expect(modes.Dark.semantic.background.$value).toBe("{colors.gray.950}");
    expect(modes.Light.semantic.border.default.$value).toBe("{colors.gray.300}");
  });

  it("leaves exports unchanged without tokens", () => {
    const s = base();
    const gen = generatePalette(s.space, s.scale, s.hues);
    expect(toCss(gen, "hex", "", "srgb", s.tokens)).toBe(toCss(gen, "hex"));
    expect(JSON.parse(toFigmaVariables(gen))).toHaveLength(1);
  });
});
