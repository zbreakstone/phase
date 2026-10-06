import type { PaletteState } from "../palette/types";

export interface SavedPalette {
  id: string;
  name: string;
  updatedAt: number;
  state: PaletteState;
}

/**
 * Everything the UI needs from a persistence layer. The default driver keeps
 * data in the browser's localStorage; a remote driver (for example Supabase)
 * only has to implement these five methods.
 */
export interface PaletteStorage {
  readonly driver: string;
  list(): Promise<SavedPalette[]>;
  get(id: string): Promise<SavedPalette | null>;
  save(palette: SavedPalette): Promise<void>;
  remove(id: string): Promise<void>;
}
