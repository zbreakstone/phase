"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { cloudEnabled, getCloud } from "@/lib/cloud/client";
import { listPalettes } from "@/lib/cloud/palettes";
import { useSession } from "@/lib/cloud/use-session";
import { Skeleton } from "@/components/ui/skeleton";
import { PaletteApp } from "./palette-app";

/**
 * Signed-in users pick up where they left off: the palette they edited most recently, or a new one when they
 * have none. Everyone else goes straight into the editor.
 */
export function Home() {
  const { session, ready } = useSession();
  const router = useRouter();
  const signedIn = cloudEnabled() && !!session;

  React.useEffect(() => {
    if (!ready || !signedIn) return;
    const cloud = getCloud();
    if (!cloud) return;
    let canceled = false;
    listPalettes(cloud)
      .then((list) => {
        if (!canceled) router.replace(list[0] ? `/p/${list[0].id}` : "/p/new");
      })
      .catch(() => {
        if (!canceled) router.replace("/p/new");
      });
    return () => {
      canceled = true;
    };
  }, [ready, signedIn, router]);

  if (ready && !signedIn) return <PaletteApp />;
  return <Skeleton aria-busy="true" aria-label="Loading" className="min-h-dvh rounded-none" />;
}
