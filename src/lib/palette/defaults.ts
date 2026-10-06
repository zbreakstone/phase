import { SPACES, type SpaceId } from "../color/spaces";
import { hueFamilyName, coordsOf } from "./source";
import { convertHue } from "./generate";
import { GRADE_PRESETS, RULE_PRESETS } from "./scale";
import type { ContrastRule, HueConfig, PaletteState, ScaleConfig } from "./types";

let counter = 0;
export function uid(prefix = "id"): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

export function makeRules(presetId = "uswds"): ContrastRule[] {
  const preset = RULE_PRESETS.find((p) => p.id === presetId) ?? RULE_PRESETS[0];
  return preset.rules.map((r, i) => ({ ...r, id: `rule-${presetId}-${i}` }));
}

export function defaultScale(): ScaleConfig {
  return {
    grades: [...GRADE_PRESETS[0].grades],
    luminanceMode: "uniform",
    customLuminance: {},
    rules: makeRules("uswds"),
  };
}

/** Hue presets are authored in OKLCH and converted when added to another space. */
export interface HuePreset {
  key: string;
  name: string;
  hueLight: number;
  hueDark: number;
  chromaLight: number;
  chromaMid: number;
  chromaDark: number;
  swatch: string;
}

export const HUE_PRESETS: HuePreset[] = [
  { key: "gray", name: "Gray", hueLight: 255, hueDark: 260, chromaLight: 0.008, chromaMid: 0.014, chromaDark: 0.012, swatch: "#6b7280" },
  { key: "red", name: "Red", hueLight: 15, hueDark: 25, chromaLight: 0.03, chromaMid: 0.2, chromaDark: 0.13, swatch: "#dc2626" },
  { key: "orange", name: "Orange", hueLight: 75, hueDark: 45, chromaLight: 0.04, chromaMid: 0.15, chromaDark: 0.1, swatch: "#ea580c" },
  { key: "yellow", name: "Yellow", hueLight: 105, hueDark: 65, chromaLight: 0.06, chromaMid: 0.14, chromaDark: 0.07, swatch: "#eab308" },
  { key: "green", name: "Green", hueLight: 150, hueDark: 160, chromaLight: 0.04, chromaMid: 0.15, chromaDark: 0.09, swatch: "#16a34a" },
  { key: "teal", name: "Teal", hueLight: 190, hueDark: 200, chromaLight: 0.03, chromaMid: 0.11, chromaDark: 0.08, swatch: "#0d9488" },
  { key: "blue", name: "Blue", hueLight: 245, hueDark: 265, chromaLight: 0.03, chromaMid: 0.18, chromaDark: 0.14, swatch: "#2563eb" },
  { key: "violet", name: "Violet", hueLight: 305, hueDark: 295, chromaLight: 0.03, chromaMid: 0.2, chromaDark: 0.15, swatch: "#7c3aed" },
  { key: "pink", name: "Pink", hueLight: 350, hueDark: 5, chromaLight: 0.03, chromaMid: 0.19, chromaDark: 0.14, swatch: "#db2777" },
];

export function hueFromPreset(
  preset: HuePreset,
  space: SpaceId,
  scale: ScaleConfig,
  name = preset.name,
  id = uid("hue"),
): HueConfig {
  const base: HueConfig = {
    id,
    name,
    hueLight: preset.hueLight,
    hueDark: preset.hueDark,
    hueBias: 0,
    hueDirection: "shortest",
    chromaLight: preset.chromaLight,
    chromaMid: preset.chromaMid,
    chromaDark: preset.chromaDark,
  };
  return space === "oklch" ? base : convertHue(base, scale, "oklch", space);
}

export function defaultState(space: SpaceId = "oklch"): PaletteState {
  const scale = defaultScale();
  const keys = ["gray", "red", "yellow", "green", "blue", "violet"];
  const hues = keys.map((k) => hueFromPreset(HUE_PRESETS.find((p) => p.key === k)!, space, scale, undefined, `hue-${k}`));
  return { space, reference: { mode: "white", hex: "#ffffff" }, scale, hues, selectedHueId: hues[2].id };
}

export function clampChroma(space: SpaceId, value: number): number {
  const { max } = SPACES[space].chroma;
  return Math.min(max, Math.max(0, value));
}

/** A new hue whose scale is built around a colour the user supplied. */
export function hueFromSource(hex: string, space: SpaceId, name?: string, id = uid("hue")): HueConfig {
  const c = coordsOf(space, hex);
  const ok = coordsOf("oklch", hex);
  const chromaMax = SPACES[space].chroma.max;
  const achromatic = c.C < chromaMax * 0.01;
  const round = (v: number) => {
    const { step, decimals } = SPACES[space].chroma;
    return Number((Math.round(v / step) * step).toFixed(decimals + 1));
  };
  const hue = achromatic ? 260 : Math.round(c.h * 10) / 10;
  return {
    id,
    name: name ?? hueFamilyName(ok.h, ok.C, SPACES.oklch.chroma.max),
    hueLight: hue,
    hueDark: hue,
    hueBias: 0,
    hueDirection: "shortest",
    chromaLight: round(c.C * 0.35),
    chromaMid: round(c.C),
    chromaDark: round(c.C * 0.75),
    source: { hex, grade: null, pinned: false },
  };
}
