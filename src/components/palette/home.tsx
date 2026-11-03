"use client";

import { cloudEnabled } from "@/lib/cloud/client";
import { useSession } from "@/lib/cloud/use-session";
import { Skeleton } from "@/components/ui/skeleton";
import { PaletteApp } from "./palette-app";
import { PalettesHome } from "./palettes-home";

/** Signed-in users start at their list of palettes. Everyone else goes straight into the editor. */
export function Home() {
  const { session, ready } = useSession();
  if (!ready) return <Skeleton aria-busy="true" aria-label="Loading" className="min-h-dvh rounded-none" />;
  if (!cloudEnabled() || !session) return <PaletteApp />;
  return <PalettesHome />;
}
