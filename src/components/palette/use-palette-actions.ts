"use client";

import { toast } from "sonner";
import { getCloud } from "@/lib/cloud/client";
import { type PaletteSummary, createPalette, createShare, deletePalette, loadLatest, renamePalette } from "@/lib/cloud/palettes";

/**
 * What you can do to a saved palette from a list of them: copy its link, duplicate it, rename it, delete it.
 * Each one reports failures as a toast and resolves to whether it worked. `onChange` runs after a duplicate, rename or
 * delete so the list can load again.
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

  const copyLink = (p: PaletteSummary) =>
    act(async () => {
      const cloud = getCloud();
      if (!cloud) return;
      const { state } = await loadLatest(cloud, p.id);
      const url = `${window.location.origin}/s/${await createShare(cloud, state)}`;
      try {
        await navigator.clipboard.writeText(url);
        toast.success(`Link copied: ${url}`);
      } catch {
        toast.message(url);
      }
    });

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

  /** Asks first. Resolves to false when you decline as well as when it fails. */
  const remove = async (p: PaletteSummary) => {
    if (!window.confirm(`Delete "${p.name}" and all of its versions? This can't be undone.`)) return false;
    return act(async () => {
      const cloud = getCloud();
      if (!cloud) return;
      await deletePalette(cloud, p.id);
      onChange();
      toast.success(`Deleted ${p.name}`);
    });
  };

  const rename = (p: PaletteSummary, name: string) =>
    act(async () => {
      const cloud = getCloud();
      if (!cloud) return;
      await renamePalette(cloud, p.id, name);
      onChange();
    });

  return { copyLink, duplicate, remove, rename };
}
