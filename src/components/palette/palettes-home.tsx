"use client";

import { rememberCardOrigin } from "@/lib/palette/card-origin";
import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCloud } from "@/lib/cloud/client";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  type PaletteSummary,
  createPalette,
  createShare,
  deletePalette,
  listPalettes,
  loadLatest,
  renamePalette,
} from "@/lib/cloud/palettes";
import type { Gamut } from "@/lib/color/gamut";
import { generatePalette } from "@/lib/palette/generate";
import type { GeneratedHue } from "@/lib/palette/types";
import { AccountMenu } from "./account-menu";
import { PAGE_WIDTH } from "./page-width";
import { PalettePreview } from "./palette-square";
import { RenamePaletteDialog } from "./rename-palette-dialog";

const when = (ms: number) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(ms);

/** What a card draws: the palette's generated colors and the gamut to show them in. */
interface Preview {
  generated: GeneratedHue[];
  gamut: Gamut;
}

/** What a signed-in user sees first: every palette they've saved, newest first. */
// Hover zooms the thumbnail to 125%, which leaves 25% of its size to pan across.
const HOVER_ZOOM_PAN = 25;

export function PalettesHome() {
  const [palettes, setPalettes] = React.useState<PaletteSummary[] | null>(null);
  /** Previews by palette id. A palette missing here is still loading, or its latest version couldn't be read. */
  const [previews, setPreviews] = React.useState<Record<string, Preview>>({});

  const router = useRouter();
  /** Bumped to load the list again after a duplicate, rename or delete. */
  const [reload, setReload] = React.useState(0);
  const [renaming, setRenaming] = React.useState<PaletteSummary | null>(null);

  const act = async (task: () => Promise<void>) => {
    try {
      await task();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
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
      setReload((n) => n + 1);
      toast.success(`Created ${name}`);
    });

  const remove = (p: PaletteSummary) => {
    if (
      !window.confirm(
        `Delete "${p.name}" and all of its versions? This can't be undone.`,
      )
    )
      return;
    void act(async () => {
      const cloud = getCloud();
      if (!cloud) return;
      await deletePalette(cloud, p.id);
      setReload((n) => n + 1);
      toast.success(`Deleted ${p.name}`);
    });
  };

  const rename = (p: PaletteSummary, name: string) =>
    act(async () => {
      const cloud = getCloud();
      if (!cloud) return;
      await renamePalette(cloud, p.id, name);
      setRenaming(null);
      setReload((n) => n + 1);
    });

  const menuItems = (p: PaletteSummary) => (
    <>
      <DropdownMenuItem onClick={() => router.push(`/p/${p.id}`)}>
        Open
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setRenaming(p)}>
        Edit info
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => void copyLink(p)}>
        Copy link
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => void duplicate(p)}>
        Duplicate
      </DropdownMenuItem>
      <DropdownMenuItem variant="destructive" onClick={() => remove(p)}>
        Delete
      </DropdownMenuItem>
    </>
  );

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
              const generated = generatePalette(
                state.space,
                state.scale,
                state.hues,
                state.gamut,
              );
              if (!canceled)
                setPreviews((prev) => ({
                  ...prev,
                  [p.id]: { generated, gamut: state.gamut },
                }));
            } catch {
              // A palette without a readable version just shows an empty preview.
            }
          }),
        );
      } catch (e) {
        if (!canceled) {
          setPalettes([]);
          toast.error(
            e instanceof Error ? e.message : "Couldn't load your palettes.",
            { id: "palettes-load-failed" },
          );
        }
      }
    })();
    return () => {
      canceled = true;
    };
  }, [reload]);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border bg-white dark:bg-black">
        <div
          className={`${PAGE_WIDTH} flex h-14 items-center justify-between gap-3`}
        >
          <Image
            src="/phase-lockup-white.png"
            alt="Phase"
            width={276}
            height={90}
            priority
            className="h-6 w-auto invert dark:invert-0"
          />
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
          <div
            aria-busy="true"
            aria-label="Loading your palettes"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="aspect-[4/3] rounded-3xl" />
            ))}
          </div>
        ) : palettes.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border p-12 text-center">
            <p className="font-medium">No palettes yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Start one and save it. It will show up here every time you sign
              in.
            </p>
            <Button
              render={<Link href="/p/new" />}
              nativeButton={false}
              variant="secondary"
            >
              <Plus />
              New palette
            </Button>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {palettes.map((p) => (
              <ContextMenu key={p.id}>
                <ContextMenuTrigger
                  render={<li className="group/card relative" />}
                >
                  <Link
                    href={`/p/${p.id}`}
                    onClick={(e) => {
                      // The editor's square zooms out of this thumbnail.
                      const thumb = e.currentTarget.querySelector("[data-card-preview]");
                      if (thumb) rememberCardOrigin(thumb.getBoundingClientRect());
                    }}
                    className="block rounded-3xl bg-white p-2 shadow-(--shadow-default) transition-shadow hover:shadow-(--shadow-large) focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none dark:bg-black"
                  >
                    <div
                      aria-hidden
                      data-card-preview
                      onPointerMove={(e) => {
                        // Pan the zoomed gradient so the point under the pointer drifts toward the middle of the card.
                        const box = e.currentTarget.getBoundingClientRect();
                        const inner = e.currentTarget.firstElementChild as HTMLElement | null;
                        if (!inner || box.width === 0) return;
                        const x = (e.clientX - box.left) / box.width;
                        const y = (e.clientY - box.top) / box.height;
                        inner.style.setProperty("--tx", `${(0.5 - x) * HOVER_ZOOM_PAN}%`);
                        inner.style.setProperty("--ty", `${(0.5 - y) * HOVER_ZOOM_PAN}%`);
                      }}
                      className="aspect-[16/10] overflow-hidden rounded-2xl bg-muted shadow-(--shadow-border)"
                    >
                      {previews[p.id] ? (
                        <div className="size-full origin-center transition-transform duration-200 ease-out group-hover/card:[transform:translate(var(--tx,0%),var(--ty,0%))_scale(1.25)] motion-reduce:transition-none motion-reduce:group-hover/card:transform-none">
                          <PalettePreview
                            generated={previews[p.id].generated}
                            gamut={previews[p.id].gamut}
                          />
                        </div>
                      ) : (
                        <Skeleton className="size-full rounded-none" />
                      )}
                    </div>
                    <div className="min-w-0 pr-10 pl-2 pt-3 pb-2">
                      <p className="truncate font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Edited {when(p.updatedAt)}
                      </p>
                    </div>
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Actions for ${p.name}`}
                          className="absolute right-3 bottom-3 text-muted-foreground opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100 pointer-coarse:opacity-100"
                        />
                      }
                    >
                      <MoreHorizontal />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      {menuItems(p)}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </ContextMenuTrigger>
                <ContextMenuContent>{menuItems(p)}</ContextMenuContent>
              </ContextMenu>
            ))}
          </ul>
        )}
      </main>
      <RenamePaletteDialog
        name={renaming?.name ?? null}
        onClose={() => setRenaming(null)}
        onSubmit={(name) => renaming && void rename(renaming, name)}
      />
    </div>
  );
}
