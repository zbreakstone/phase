import { LocalPaletteStorage } from "./local-storage";
import type { PaletteStorage } from "./types";

export type { PaletteStorage, SavedPalette } from "./types";

let instance: PaletteStorage | null = null;

/**
 * Returns the storage driver chosen by NEXT_PUBLIC_STORAGE_DRIVER.
 * Only "local" exists today. To add Supabase later, implement PaletteStorage
 * in a new file and return it from the matching case below.
 */
export function getStorage(): PaletteStorage {
  if (instance) return instance;
  const driver = process.env.NEXT_PUBLIC_STORAGE_DRIVER ?? "local";
  switch (driver) {
    case "local":
    default:
      instance = new LocalPaletteStorage();
  }
  return instance;
}
