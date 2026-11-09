import { uid } from "./defaults";
import type { PaletteState, SemanticToken, TokenRef } from "./types";

/**
 * Semantic tokens: user-chosen names (`border/subtle/base`, `warning`) for a whole color or one step.
 * A name is unique within a palette, so giving it to something else moves it there.
 */

/** Reads a typed name as levels: "/" or "." separates them, and each level is lowercased with spaces turned into dashes. */
export function normalizePath(text: string): string | null {
  const levels = text
    .split(/[/.]/)
    .map((l) =>
      l
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, ""),
    )
    .filter(Boolean);
  return levels.length ? levels.join("/") : null;
}

export const sameRef = (a: TokenRef | null | undefined, b: TokenRef | null | undefined) =>
  !!a && !!b && a.hueId === b.hueId && a.grade === b.grade;

/** The tokens assigned to exactly this color (grade null) or step. */
export function tokensAt(state: PaletteState, ref: TokenRef): SemanticToken[] {
  return (state.tokens ?? []).filter((t) => sameRef(t.light, ref));
}

/** How a reference reads in the UI: "Gray", "Gray 200", "White". */
export function refLabel(state: PaletteState, ref: TokenRef): string {
  if (ref.grade === 0) return "White";
  if (ref.grade === 1000) return "Black";
  const name = state.hues.find((h) => h.id === ref.hueId)?.name || "Unnamed";
  return ref.grade === null ? name : `${name} ${ref.grade}`;
}

const withTokens = (state: PaletteState, tokens: SemanticToken[]): PaletteState => ({ ...state, tokens });

/** Gives `path` to `ref`, creating the token or moving it from wherever it was. A whole color has no separate dark value. */
export function assignToken(state: PaletteState, path: string, ref: TokenRef): PaletteState {
  const tokens = state.tokens ?? [];
  const existing = tokens.find((t) => t.path === path);
  if (!existing) return withTokens(state, [...tokens, { id: uid("token"), path, light: ref }]);
  return withTokens(
    state,
    tokens.map((t) => {
      if (t !== existing) return t;
      const next: SemanticToken = { ...t, light: ref };
      if (ref.grade === null) delete next.dark;
      return next;
    }),
  );
}

export function updateToken(state: PaletteState, id: string, patch: Partial<Omit<SemanticToken, "id">>): PaletteState {
  return withTokens(
    state,
    (state.tokens ?? []).map((t) => {
      if (t.id !== id) return t;
      const next = { ...t, ...patch };
      if ("dark" in patch && patch.dark === undefined) delete next.dark;
      return next;
    }),
  );
}

export type RenameResult = { ok: true; path: string } | { ok: false; error: string };

export function checkRename(state: PaletteState, id: string, text: string): RenameResult {
  const path = normalizePath(text);
  if (!path) return { ok: false, error: "Enter a name." };
  if ((state.tokens ?? []).some((t) => t.id !== id && t.path === path)) return { ok: false, error: `${path} is already a token.` };
  return { ok: true, path };
}

export function removeToken(state: PaletteState, id: string): PaletteState {
  return withTokens(state, (state.tokens ?? []).filter((t) => t.id !== id));
}

/** Points every reference through `fn`; a reference it returns null for becomes unassigned. */
function mapRefs(state: PaletteState, fn: (ref: TokenRef) => TokenRef | null): PaletteState {
  if (!state.tokens?.length) return state;
  return withTokens(
    state,
    state.tokens.map((t) => {
      const next: SemanticToken = { ...t, light: t.light ? fn(t.light) : null };
      if (t.dark) next.dark = fn(t.dark);
      return next;
    }),
  );
}

export const renameGradeInTokens = (state: PaletteState, from: number, to: number) =>
  mapRefs(state, (r) => (r.grade === from ? { ...r, grade: to } : r));

export const removeGradeFromTokens = (state: PaletteState, grade: number) => mapRefs(state, (r) => (r.grade === grade ? null : r));

export const removeHueFromTokens = (state: PaletteState, hueId: string) => mapRefs(state, (r) => (r.hueId === hueId ? null : r));

export interface TokenPreset {
  id: string;
  label: string;
  description: string;
  paths: string[];
}

export const TOKEN_PRESETS: TokenPreset[] = [
  {
    id: "shadcn",
    label: "shadcn",
    description: "The theme variables shadcn/ui components read, one step each.",
    paths: [
      "background",
      "foreground",
      "card",
      "card-foreground",
      "popover",
      "popover-foreground",
      "primary",
      "primary-foreground",
      "secondary",
      "secondary-foreground",
      "muted",
      "muted-foreground",
      "accent",
      "accent-foreground",
      "destructive",
      "border",
      "input",
      "ring",
      "chart-1",
      "chart-2",
      "chart-3",
      "chart-4",
      "chart-5",
    ],
  },
  {
    id: "status",
    label: "Status",
    description: "Whole colors for feedback: info, positive, warning and negative.",
    paths: ["info", "positive", "warning", "negative"],
  },
  {
    id: "radix",
    label: "Radix roles",
    description: "What each step of a Radix scale is for, from app background to high-contrast text.",
    paths: [
      "background/app",
      "background/subtle",
      "element/base",
      "element/hover",
      "element/active",
      "border/subtle",
      "border/base",
      "border/hover",
      "solid/base",
      "solid/hover",
      "text/subtle",
      "text/base",
    ],
  },
];

/** Adds a preset's names that aren't in the palette yet, unassigned. */
export function addPreset(state: PaletteState, presetId: string): PaletteState {
  const preset = TOKEN_PRESETS.find((p) => p.id === presetId);
  if (!preset) return state;
  const tokens = state.tokens ?? [];
  const have = new Set(tokens.map((t) => t.path));
  const added = preset.paths.filter((p) => !have.has(p)).map((path) => ({ id: uid("token"), path, light: null }));
  return added.length ? withTokens(state, [...tokens, ...added]) : state;
}

export function sanitizeTokens(raw: unknown, hueIds: Set<string>): SemanticToken[] {
  if (!Array.isArray(raw)) return [];
  const ref = (v: unknown): TokenRef | null => {
    if (!v || typeof v !== "object") return null;
    const r = v as Record<string, unknown>;
    if (typeof r.hueId !== "string" || !hueIds.has(r.hueId)) return null;
    const grade = typeof r.grade === "number" && Number.isInteger(r.grade) && r.grade >= 0 && r.grade <= 1000 ? r.grade : null;
    return { hueId: r.hueId, grade };
  };
  const seen = new Set<string>();
  const out: SemanticToken[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const t = item as Record<string, unknown>;
    const path = typeof t.path === "string" ? normalizePath(t.path) : null;
    if (!path || seen.has(path)) continue;
    seen.add(path);
    const light = ref(t.light);
    const token: SemanticToken = { id: typeof t.id === "string" ? t.id : uid("token"), path, light };
    if ("dark" in t && light?.grade !== null) token.dark = ref(t.dark);
    out.push(token);
  }
  return out;
}
