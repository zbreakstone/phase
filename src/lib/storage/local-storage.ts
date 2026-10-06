import { sanitizeState } from "../palette/serialize";
import type { PaletteStorage, SavedPalette } from "./types";

const KEY = "phase:palettes:v1";

function read(): SavedPalette[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: SavedPalette[] = [];
    for (const item of parsed as Record<string, unknown>[]) {
      const state = sanitizeState(item?.state);
      if (state && typeof item.id === "string") {
        out.push({
          id: item.id,
          name: typeof item.name === "string" ? item.name : "Untitled",
          updatedAt: typeof item.updatedAt === "number" ? item.updatedAt : 0,
          state,
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}

function write(items: SavedPalette[]): void {
  window.localStorage.setItem(KEY, JSON.stringify(items));
}

export class LocalPaletteStorage implements PaletteStorage {
  readonly driver = "local";

  async list() {
    return read().sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async get(id: string) {
    return read().find((p) => p.id === id) ?? null;
  }

  async save(palette: SavedPalette) {
    const items = read().filter((p) => p.id !== palette.id);
    items.push(palette);
    write(items);
  }

  async remove(id: string) {
    write(read().filter((p) => p.id !== id));
  }
}
