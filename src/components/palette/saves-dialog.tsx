"use client";

import * as React from "react";
import type { Session } from "@supabase/supabase-js";
import { Check, Cloud, CloudOff, LogOut, Mail, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cloudEnabled, getCloud } from "@/lib/cloud/client";
import {
  type LoadedVersion,
  type PaletteSummary,
  type VersionSummary,
  createPalette,
  deletePalette,
  listPalettes,
  listVersions,
  loadLatest,
  loadVersion,
  renamePalette,
  saveVersion,
  updateVersionNote,
} from "@/lib/cloud/palettes";
import { encodeState } from "@/lib/palette/serialize";
import type { PaletteState } from "@/lib/palette/types";

/** The saved palette the editor is working on, and what it looked like when last saved. */
export interface CurrentPalette {
  id: string;
  name: string;
  versionId: string;
  /** Encoded state at the last save or open, to tell whether there are unsaved changes. */
  savedKey: string;
}

interface Props {
  state: PaletteState;
  /** Encoded form of `state`, comparable with `CurrentPalette.savedKey`. */
  stateKey: string;
  current: CurrentPalette | null;
  /** True when the editor holds work that opening something else would replace. */
  hasUnsaved: boolean;
  onCurrent: (current: CurrentPalette | null) => void;
  onOpen: (loaded: LoadedVersion) => void;
}

const when = (ms: number) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(ms);

export function SavesDialog({ state, stateKey, current, hasUnsaved, onCurrent, onOpen }: Props) {
  const enabled = cloudEnabled();
  const [session, setSession] = React.useState<Session | null>(null);
  const [authReady, setAuthReady] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [name, setName] = React.useState("");
  const [note, setNote] = React.useState("");
  const [palettes, setPalettes] = React.useState<PaletteSummary[]>([]);
  const [versions, setVersions] = React.useState<VersionSummary[]>([]);
  const [editing, setEditing] = React.useState<{ id: string; text: string } | null>(null);

  React.useEffect(() => {
    const cloud = getCloud();
    if (!cloud) return;
    cloud.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data } = cloud.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const refresh = React.useCallback(async (paletteId: string | null) => {
    const cloud = getCloud();
    if (!cloud) return;
    try {
      const [p, v] = await Promise.all([listPalettes(cloud), paletteId ? listVersions(cloud, paletteId) : Promise.resolve([])]);
      setPalettes(p);
      setVersions(v);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't load your palettes.");
    }
  }, []);

  if (!enabled) return null;

  const signedIn = Boolean(session);
  const dirty = current !== null && current.savedKey !== stateKey;

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    try {
      await task();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    setEditing(null);
    if (next) {
      setSent(false);
      setName(current?.name ?? "");
      setNote("");
      if (session) void refresh(current?.id ?? null);
    }
  };

  const signIn = () =>
    run(async () => {
      const cloud = getCloud();
      if (!cloud) return;
      const { error } = await cloud.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: `${window.location.origin}${window.location.pathname}` } });
      if (error) throw new Error(error.message);
      setSent(true);
    });

  const signOut = () =>
    run(async () => {
      await getCloud()?.auth.signOut();
      onCurrent(null);
      setPalettes([]);
      setVersions([]);
      setOpen(false);
      toast.success("Signed out. Your palettes are still in your account.");
    });

  const saveNew = () =>
    run(async () => {
      const cloud = getCloud();
      if (!cloud) return;
      const { paletteId, version } = await createPalette(cloud, name, state, note);
      onCurrent({ id: paletteId, name: name.trim() || "Untitled", versionId: version.id, savedKey: stateKey });
      setNote("");
      await refresh(paletteId);
      toast.success("Saved as a new palette");
    });

  const saveAgain = () =>
    run(async () => {
      const cloud = getCloud();
      if (!cloud || !current) return;
      if (name.trim() && name.trim() !== current.name) await renamePalette(cloud, current.id, name);
      const version = await saveVersion(cloud, current.id, state, note);
      onCurrent({ ...current, name: name.trim() || current.name, versionId: version.id, savedKey: stateKey });
      setNote("");
      await refresh(current.id);
      toast.success("Saved a new version");
    });

  const saveNote = () =>
    run(async () => {
      const cloud = getCloud();
      if (!cloud || !editing) return;
      const next = await updateVersionNote(cloud, editing.id, editing.text);
      setVersions((list) => list.map((v) => (v.id === editing.id ? { ...v, note: next } : v)));
      setEditing(null);
      toast.success("Note updated");
    });

  const confirmReplace = () => !hasUnsaved || window.confirm("Opening this replaces the changes you haven't saved. Continue?");

  const open_ = (task: () => Promise<LoadedVersion>) => {
    if (!confirmReplace()) return;
    void run(async () => {
      const loaded = await task();
      onOpen(loaded);
      onCurrent({ id: loaded.paletteId, name: loaded.paletteName, versionId: loaded.versionId, savedKey: encodeState(loaded.state) });
      setOpen(false);
      toast.success(`Opened ${loaded.paletteName}`);
    });
  };

  const remove = (p: PaletteSummary) => {
    if (!window.confirm(`Delete "${p.name}" and all of its versions? This can't be undone.`)) return;
    void run(async () => {
      const cloud = getCloud();
      if (!cloud) return;
      await deletePalette(cloud, p.id);
      if (current?.id === p.id) onCurrent(null);
      await refresh(current?.id === p.id ? null : (current?.id ?? null));
    });
  };

  const label = !signedIn ? "Sign in" : current ? current.name : "Save";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="ghost" size="sm" className="max-w-40 rounded-none" aria-label="Saved palettes" />}>
        {signedIn || !authReady ? <Cloud /> : <CloudOff />}
        <span className="hidden truncate sm:inline">{authReady ? label : "Save"}</span>
        {dirty ? <span aria-label="Unsaved changes" className="size-1.5 shrink-0 rounded-full bg-amber-400" /> : null}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{signedIn ? "Saved palettes" : "Sign in to save"}</DialogTitle>
          <DialogDescription>
            {signedIn
              ? "Every save adds a version you can come back to. Sign in on another browser to pick up where you left off."
              : "Saved palettes follow you across browsers. We email you a sign-in link, so there's no password."}
          </DialogDescription>
        </DialogHeader>

        {!signedIn ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (email.trim()) void signIn();
            }}
          >
            <Input type="email" required autoComplete="email" placeholder="you@example.com" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button type="submit" disabled={busy || !email.trim()}>
              <Mail />
              Email me a sign-in link
            </Button>
            {sent ? (
              <p className="text-xs text-muted-foreground">Check your inbox, then open the link in this browser. Your current palette stays as it is.</p>
            ) : null}
          </form>
        ) : (
          <div className="space-y-5">
            <section className="space-y-2">
              <h3 className="text-xs font-semibold tracking-wide uppercase">{current ? "This palette" : "Save this palette"}</h3>
              <Input aria-label="Palette name" placeholder="Palette name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
              <Input aria-label="Version note" placeholder="Note for this version (optional)" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="flex flex-wrap gap-2">
                {current ? (
                  <Button onClick={saveAgain} disabled={busy}>
                    Save new version
                  </Button>
                ) : null}
                <Button variant={current ? "outline" : "default"} onClick={saveNew} disabled={busy || !name.trim()}>
                  {current ? "Save as new palette" : "Save palette"}
                </Button>
              </div>
              {current && !dirty ? <p className="text-[11px] text-muted-foreground">No changes since the last save.</p> : null}
            </section>

            {current && versions.length > 0 ? (
              <section className="space-y-2">
                <h3 className="text-xs font-semibold tracking-wide uppercase">Versions</h3>
                <ul className="max-h-48 divide-y divide-border overflow-y-auto border border-border">
                  {versions.map((v, i) => (
                    <li key={v.id} className="flex items-center gap-2 px-2 py-1.5 text-xs">
                      {editing?.id === v.id ? (
                        <form
                          className="flex min-w-0 flex-1 items-center gap-1"
                          onSubmit={(e) => {
                            e.preventDefault();
                            void saveNote();
                          }}
                        >
                          <Input
                            autoFocus
                            aria-label="Version note"
                            maxLength={200}
                            value={editing.text}
                            onChange={(e) => setEditing({ id: v.id, text: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === "Escape") {
                                e.stopPropagation();
                                setEditing(null);
                              }
                            }}
                            className="h-7 text-xs"
                          />
                          <Button type="submit" variant="ghost" size="icon" aria-label="Save note" disabled={busy}>
                            <Check />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" aria-label="Cancel" onClick={() => setEditing(null)}>
                            <X />
                          </Button>
                        </form>
                      ) : (
                        <>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate">{v.note ?? "No note"}</span>
                            <span className="text-muted-foreground">
                              {when(v.createdAt)}
                              {i === 0 ? " · latest" : ""}
                              {v.id === current.versionId ? " · open" : ""}
                            </span>
                          </span>
                          <Button variant="ghost" size="icon" aria-label="Edit note" disabled={busy} onClick={() => setEditing({ id: v.id, text: v.note ?? "" })} className="text-muted-foreground">
                            <Pencil />
                          </Button>
                          <Button variant="ghost" size="sm" disabled={busy || v.id === current.versionId} onClick={() => open_(() => loadVersion(getCloud()!, v.id))}>
                            Open
                          </Button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className="space-y-2">
              <h3 className="text-xs font-semibold tracking-wide uppercase">Your palettes</h3>
              {palettes.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nothing saved yet.</p>
              ) : (
                <ul className="max-h-48 divide-y divide-border overflow-y-auto border border-border">
                  {palettes.map((p) => (
                    <li key={p.id} className="flex items-center gap-2 px-2 py-1.5 text-xs">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{p.name}</span>
                        <span className="text-muted-foreground">{when(p.updatedAt)}</span>
                      </span>
                      <Button variant="ghost" size="sm" disabled={busy} onClick={() => open_(() => loadLatest(getCloud()!, p.id))}>
                        Open latest
                      </Button>
                      <Button variant="ghost" size="icon" aria-label={`Delete ${p.name}`} disabled={busy} onClick={() => remove(p)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
              <span className="truncate">{session?.user.email}</span>
              <Button variant="ghost" size="sm" onClick={signOut} disabled={busy}>
                <LogOut />
                Sign out
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
