"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCloud } from "@/lib/cloud/client";
import { type PaletteSummary, listPalettes, loadLatest } from "@/lib/cloud/palettes";
import type { Gamut } from "@/lib/color/gamut";
import { generatePalette } from "@/lib/palette/generate";
import type { GeneratedHue } from "@/lib/palette/types";
import { AccountMenu } from "./account-menu";
import { PAGE_WIDTH } from "./page-width";
import { PalettePreview } from "./palette-square";

const when = (ms: number) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(ms);

/** What a card draws: the palette's generated colors and the gamut to show them in. */
interface Preview {
  generated: GeneratedHue[];
  gamut: Gamut;
}

/** What a signed-in user sees first: every palette they've saved, newest first. */
export function PalettesHome() {
  const [palettes, setPalettes] = React.useState<PaletteSummary[] | null>(null);
  /** Previews by palette id. A palette missing here is still loading, or its latest version couldn't be read. */
  const [previews, setPreviews] = React.useState<Record<string, Preview>>({});

  React.useEffect(() => {
    const cloud = getCloud();
    if (!cloud) return;
    let canceled = false;
    (async () => {
      try {
        const list = await listPalettes(cloud);
        if (canceled) return;
        setPalettes(list);
        await Promise.all(
          list.map(async (p) => {
            try {
              const loaded = await loadLatest(cloud, p.id);
              const { state } = loaded;
              const generated = generatePalette(state.space, state.scale, state.hues, state.gamut);
              if (!canceled) setPreviews((prev) => ({ ...prev, [p.id]: { generated, gamut: state.gamut } }));
            } catch {
              // A palette without a readable version just shows an empty preview.
            }
          }),
        );
      } catch (e) {
        if (!canceled) {
          setPalettes([]);
          toast.error(e instanceof Error ? e.message : "Couldn't load your palettes.", { id: "palettes-load-failed" });
        }
      }
    })();
    return () => {
      canceled = true;
    };
  }, []);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border bg-white dark:bg-black">
        <div className={`${PAGE_WIDTH} flex h-14 items-center justify-between gap-3`}>
          <Image src="/phase-lockup-white.png" alt="Phase" width={276} height={90} priority className="h-6 w-auto invert dark:invert-0" />
          <AccountMenu onSignedOut={() => undefined} />
        </div>
      </header>
      <main className={`${PAGE_WIDTH} w-full flex-1 py-8`}>
        <div className="mb-6 flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">Palettes</h1>
          <Button render={<Link href="/p/new" />} nativeButton={false}>
            <Plus />
            New palette
          </Button>
        </div>
        {palettes === null ? (
          <div aria-busy="true" aria-label="Loading your palettes" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="aspect-[4/3] rounded-3xl" />
            ))}
          </div>
        ) : palettes.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border p-12 text-center">
            <p className="font-medium">No palettes yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">Start one and save it. It will show up here every time you sign in.</p>
            <Button render={<Link href="/p/new" />} nativeButton={false} variant="secondary">
              <Plus />
              New palette
            </Button>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {palettes.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/p/${p.id}`}
                  className="block rounded-3xl bg-white p-2 shadow-(--shadow-default) transition-shadow hover:shadow-(--shadow-large) focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none dark:bg-black"
                >
                  <div aria-hidden className="aspect-[16/10] overflow-hidden rounded-2xl bg-muted shadow-(--shadow-border)">
                    {previews[p.id] ? <PalettePreview generated={previews[p.id].generated} gamut={previews[p.id].gamut} /> : <Skeleton className="size-full rounded-none" />}
                  </div>
                  <div className="min-w-0 px-2 pt-3 pb-2">
                    <p className="truncate font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">Edited {when(p.updatedAt)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
