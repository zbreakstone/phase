import { SPACE_ORDER, type SpaceId } from "../color/spaces";
import { parseHex } from "../color/convert";
import { uid } from "./defaults";
import { MAX_GRADES } from "./scale";
import type { ContrastReference, ContrastRule, HueConfig, HueDirection, PaletteState, SourceColor } from "./types";

const num = (v: unknown, fallback: number, min = -Infinity, max = Infinity): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

function sanitizeSource(raw: unknown): SourceColor | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const hex = typeof r.hex === "string" ? parseHex(r.hex) : null;
  if (!hex) return null;
  const grade = typeof r.grade === "number" && Number.isInteger(r.grade) ? r.grade : null;
  return { hex, grade, pinned: r.pinned === true };
}

function sanitizeReference(raw: unknown): ContrastReference {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const hex = typeof r.hex === "string" ? parseHex(r.hex) : null;
  const mode = r.mode === "black" || r.mode === "custom" ? r.mode : "white";
  return { mode: mode === "custom" && !hex ? "white" : mode, hex: hex ?? "#ffffff" };
}

function sanitizeHue(raw: unknown): HueConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const h = raw as Record<string, unknown>;
  const dir = h.hueDirection;
  const direction: HueDirection =
    dir === "increasing" || dir === "decreasing" ? dir : "shortest";
  return {
    id: typeof h.id === "string" ? h.id : uid("hue"),
    name: typeof h.name === "string" && h.name.trim() ? h.name.slice(0, 32) : "Hue",
    hueLight: num(h.hueLight, 0, 0, 360),
    hueDark: num(h.hueDark, 0, 0, 360),
    hueBias: num(h.hueBias, 0, -1, 1),
    hueDirection: direction,
    chromaLight: num(h.chromaLight, 0, 0, 200),
    chromaMid: num(h.chromaMid, 0, 0, 200),
    chromaDark: num(h.chromaDark, 0, 0, 200),
    source: sanitizeSource(h.source),
  };
}

export function sanitizeState(raw: unknown): PaletteState | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!SPACE_ORDER.includes(r.space as SpaceId)) return null;
  const scaleRaw = r.scale as Record<string, unknown> | undefined;
  if (!scaleRaw || !Array.isArray(scaleRaw.grades)) return null;
  const grades = Array.from(
    new Set(
      (scaleRaw.grades as unknown[]).filter(
        (g): g is number => typeof g === "number" && Number.isInteger(g) && g > 0 && g < 1000,
      ),
    ),
  )
    .sort((a, b) => a - b)
    .slice(0, MAX_GRADES);
  if (grades.length < 2) return null;

  const rules: ContrastRule[] = Array.isArray(scaleRaw.rules)
    ? (scaleRaw.rules as Record<string, unknown>[])
        .filter((x) => x && typeof x === "object")
        .map((x) => ({
          id: typeof x.id === "string" ? x.id : uid("rule"),
          minDiff: Math.round(num(x.minDiff, 500, 1, 1000)),
          ratio: num(x.ratio, 4.5, 1, 21),
        }))
    : [];

  const customLuminance: Record<string, number> = {};
  if (scaleRaw.customLuminance && typeof scaleRaw.customLuminance === "object") {
    for (const [k, v] of Object.entries(scaleRaw.customLuminance as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v)) customLuminance[k] = Math.min(1, Math.max(0, v));
    }
  }

  const hues = Array.isArray(r.hues)
    ? (r.hues as unknown[]).map(sanitizeHue).filter((h): h is HueConfig => h !== null)
    : [];

  const selected = typeof r.selectedHueId === "string" && hues.some((h) => h.id === r.selectedHueId)
    ? (r.selectedHueId as string)
    : hues[0]?.id ?? null;

  return {
    space: r.space as SpaceId,
    // Links made before the gamut control existed have no gamut and were always sRGB.
    gamut: r.gamut === "p3" ? "p3" : "srgb",
    reference: sanitizeReference(r.reference),
    scale: {
      grades,
      luminanceMode:
        scaleRaw.luminanceMode === "custom" || scaleRaw.luminanceMode === "uniform" ? scaleRaw.luminanceMode : "envoy",
      customLuminance,
      rules,
    },
    hues,
    selectedHueId: selected,
  };
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): string {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/** Five decimals keeps every colour identical after a round trip while keeping links short. */
const roundForLink = (_key: string, v: unknown) => (typeof v === "number" ? Math.round(v * 1e5) / 1e5 : v);

export function encodeState(state: PaletteState): string {
  return toBase64Url(JSON.stringify(state, roundForLink));
}

export const SHARE_PARAM = "p";

/** Reads a palette from a location hash such as `#p=...`. Returns null when the hash has no palette. */
export function stateFromHash(hash: string): DecodeResult | null {
  const value = new URLSearchParams(hash.replace(/^#/, "")).get(SHARE_PARAM);
  return value ? decodeState(value) : null;
}

export function hashForState(state: PaletteState): string {
  return `#${SHARE_PARAM}=${encodeState(state)}`;
}

export type DecodeResult =
  | { ok: true; state: PaletteState }
  | { ok: false; error: string };

export function decodeState(encoded: string): DecodeResult {
  try {
    const state = sanitizeState(JSON.parse(fromBase64Url(encoded)));
    if (!state) return { ok: false, error: "That link doesn't contain a valid palette." };
    return { ok: true, state };
  } catch {
    return { ok: false, error: "That link couldn't be read, so the default palette was loaded instead." };
  }
}
