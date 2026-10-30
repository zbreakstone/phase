import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitizeState } from "../palette/serialize";
import type { PaletteState } from "../palette/types";

export interface PaletteSummary {
  id: string;
  name: string;
  updatedAt: number;
}

export interface VersionSummary {
  id: string;
  note: string | null;
  createdAt: number;
}

export interface LoadedVersion {
  paletteId: string;
  paletteName: string;
  versionId: string;
  state: PaletteState;
}

function check<T>(result: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null || result.data === undefined) throw new Error("Nothing came back from the server.");
  return result.data;
}

export async function listPalettes(db: SupabaseClient): Promise<PaletteSummary[]> {
  const rows = check(await db.from("palettes").select("id, name, updated_at").order("updated_at", { ascending: false }));
  return rows.map((r) => ({ id: r.id as string, name: r.name as string, updatedAt: Date.parse(r.updated_at as string) }));
}

export async function listVersions(db: SupabaseClient, paletteId: string): Promise<VersionSummary[]> {
  const rows = check(
    await db.from("palette_versions").select("id, note, created_at").eq("palette_id", paletteId).order("created_at", { ascending: false }).limit(100),
  );
  return rows.map((r) => ({ id: r.id as string, note: (r.note as string | null) ?? null, createdAt: Date.parse(r.created_at as string) }));
}

async function toLoaded(
  row: { id: string; palette_id: string; state: unknown; palettes: { name: string } | { name: string }[] | null },
): Promise<LoadedVersion> {
  const state = sanitizeState(row.state);
  if (!state) throw new Error("That saved version couldn't be read.");
  const palette = Array.isArray(row.palettes) ? row.palettes[0] : row.palettes;
  return { paletteId: row.palette_id, paletteName: palette?.name ?? "Untitled", versionId: row.id, state };
}

/** The newest saved version of a palette. */
export async function loadLatest(db: SupabaseClient, paletteId: string): Promise<LoadedVersion> {
  const rows = check(
    await db
      .from("palette_versions")
      .select("id, palette_id, state, palettes(name)")
      .eq("palette_id", paletteId)
      .order("created_at", { ascending: false })
      .limit(1),
  );
  if (rows.length === 0) throw new Error("That palette has no saved versions.");
  return toLoaded(rows[0] as never);
}

export async function loadVersion(db: SupabaseClient, versionId: string): Promise<LoadedVersion> {
  const row = check(await db.from("palette_versions").select("id, palette_id, state, palettes(name)").eq("id", versionId).single());
  return toLoaded(row as never);
}

/** Saves a snapshot. History is append-only: nothing already saved is changed. */
export async function saveVersion(db: SupabaseClient, paletteId: string, state: PaletteState, note: string): Promise<VersionSummary> {
  const row = check(
    await db
      .from("palette_versions")
      .insert({ palette_id: paletteId, state, note: note.trim() || null })
      .select("id, note, created_at")
      .single(),
  );
  return { id: row.id as string, note: (row.note as string | null) ?? null, createdAt: Date.parse(row.created_at as string) };
}

export async function createPalette(db: SupabaseClient, name: string, state: PaletteState, note: string): Promise<{ paletteId: string; version: VersionSummary }> {
  const palette = check(await db.from("palettes").insert({ name: name.trim() || "Untitled" }).select("id").single());
  const paletteId = palette.id as string;
  try {
    return { paletteId, version: await saveVersion(db, paletteId, state, note) };
  } catch (e) {
    await db.from("palettes").delete().eq("id", paletteId);
    throw e;
  }
}

export async function renamePalette(db: SupabaseClient, paletteId: string, name: string): Promise<void> {
  const { error } = await db.from("palettes").update({ name: name.trim() || "Untitled" }).eq("id", paletteId);
  if (error) throw new Error(error.message);
}

export async function deletePalette(db: SupabaseClient, paletteId: string): Promise<void> {
  const { error } = await db.from("palettes").delete().eq("id", paletteId);
  if (error) throw new Error(error.message);
}

/** Fixes a version's note. The saved palette itself can't be changed, only its description. */
export async function updateVersionNote(db: SupabaseClient, versionId: string, note: string): Promise<string | null> {
  const next = note.trim() || null;
  const { error } = await db.from("palette_versions").update({ note: next }).eq("id", versionId);
  if (error) throw new Error(error.message);
  return next;
}
