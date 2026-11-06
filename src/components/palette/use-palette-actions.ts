"use client";

import { toast } from "sonner";
import { getCloud } from "@/lib/cloud/client";
import { type PaletteSummary, createPalette, loadLatest } from "@/lib/cloud/palettes";

/**
 * What you can do to a saved palette from outside it: duplicate it. It reports failures as a toast and resolves to
 * whether it worked. `onChange` runs after a duplicate.
 */
export function usePaletteActions(onChange: () => void) {
  const act = async (task: () => Promise<void>): Promise<boolean> => {
    try {
      await task();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
      return false;
    }
  };

  const duplicate = (p: PaletteSummary) =>
    act(async () => {
      const cloud = getCloud();
      if (!cloud) return;
      const { state } = await loadLatest(cloud, p.id);
      const name = `${p.name} copy`.slice(0, 80);
      await createPalette(cloud, name, state);
      onChange();
      toast.success(`Created ${name}`);
    });

  return { duplicate };
}
