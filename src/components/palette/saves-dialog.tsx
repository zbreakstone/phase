"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import type { Session } from "@supabase/supabase-js";
import {
  Check,
  ChevronRight,
  Mail,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AddVersionDialog } from "./add-version-dialog";
import { cloudEnabled, getCloud } from "@/lib/cloud/client";
import {
  type LoadedVersion,
  type PaletteSummary,
  type VersionDetails,
  type VersionSummary,
  createPalette,
  deletePalette,
  listPalettes,
  listVersions,
  loadLatest,
  loadVersion,
  renamePalette,
  saveVersion,
  updateVersionDetails,
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
  /** The palette's name, edited in the header. Saved along with each version. */
  name: string;
  /** Encoded form of `state`, comparable with `CurrentPalette.savedKey`. */
  stateKey: string;
  current: CurrentPalette | null;
  /** True when the editor holds work that opening something else would replace. */
  hasUnsaved: boolean;
  onCurrent: (current: CurrentPalette | null) => void;
  onOpen: (loaded: LoadedVersion) => void;
  /** Asks to throw the palette away for the starter one. The caller confirms. */
  onReset: () => void;
  /** Whether the version history sidebar is showing, and the element it is drawn into. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slot: HTMLElement | null;
}

const when = (ms: number) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(ms);

export function SavesDialog({
  state,
  name,
  stateKey,
  current,
  hasUnsaved,
  onCurrent,
  onOpen,
  onReset,
  open,
  onOpenChange,
  slot,
}: Props) {
  const enabled = cloudEnabled();
  const [session, setSession] = React.useState<Session | null>(null);
  const [authReady, setAuthReady] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  /** The last save, open or load failed. Cleared by the next one that works. */
  const [failed, setFailed] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [code, setCode] = React.useState("");
  /** The "Add to version history" dialog. */
  const [adding, setAdding] = React.useState(false);
  const [showAutosaves, setShowAutosaves] = React.useState(false);
  const [palettes, setPalettes] = React.useState<PaletteSummary[]>([]);
  const [versions, setVersions] = React.useState<VersionSummary[]>([]);
  const [editing, setEditing] = React.useState<{
    id: string;
    title: string;
    description: string;
  } | null>(null);

  React.useEffect(() => {
    const cloud = getCloud();
    if (!cloud) return;
    cloud.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data } = cloud.auth.onAuthStateChange((_event, next) =>
      setSession(next),
    );
    return () => data.subscription.unsubscribe();
  }, []);

  // ⌘⌥S adds to the version history, as in Figma. The physical key is used because Option changes what S types.
  React.useEffect(() => {
    if (!session) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.defaultPrevented ||
        e.code !== "KeyS" ||
        !e.altKey ||
        !(e.metaKey || e.ctrlKey)
      )
        return;
      e.preventDefault();
      setAdding(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [session]);

  const refresh = React.useCallback(async (paletteId: string | null) => {
    const cloud = getCloud();
    if (!cloud) return;
    try {
      const [p, v] = await Promise.all([
        listPalettes(cloud),
        paletteId ? listVersions(cloud, paletteId) : Promise.resolve([]),
      ]);
      setPalettes(p);
      setVersions(v);
      setFailed(false);
    } catch (e) {
      setFailed(true);
      toast.error(
        e instanceof Error ? e.message : "Couldn't load your palettes.",
      );
    }
  }, []);

  if (!enabled) return null;

  const signedIn = Boolean(session);
  const dirty =
    current !== null &&
    (current.savedKey !== stateKey || name.trim() !== current.name);

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    try {
      await task();
      setFailed(false);
    } catch (e) {
      setFailed(true);
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const toggle = () => {
    const next = !open;
    onOpenChange(next);
    setEditing(null);
    if (next) {
      setSent(false);
      setCode("");
      if (session) void refresh(current?.id ?? null);
    }
  };

  const signIn = () =>
    run(async () => {
      const cloud = getCloud();
      if (!cloud) return;
      const { error } = await cloud.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
        },
      });
      if (error) throw new Error(error.message);
      setSent(true);
    });

  // Typing the emailed code works in any browser, unlike the link, which only finishes sign-in where it was requested.
  const verifyCode = () =>
    run(async () => {
      const cloud = getCloud();
      if (!cloud) return;
      const { error } = await cloud.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: "email",
      });
      if (error) throw new Error(error.message);
      setCode("");
      await refresh(current?.id ?? null);
    });

  /** Adds a named version. A palette that was never saved is created along with it. */
  const addVersion = (details: VersionDetails) =>
    run(async () => {
      const cloud = getCloud();
      if (!cloud) return;
      const trimmed = name.trim();
      if (!current) {
        const { paletteId, version } = await createPalette(
          cloud,
          trimmed,
          state,
          details,
        );
        onCurrent({
          id: paletteId,
          name: trimmed || "Untitled",
          versionId: version.id,
          savedKey: stateKey,
        });
        await refresh(paletteId);
      } else {
        if (trimmed && trimmed !== current.name)
          await renamePalette(cloud, current.id, trimmed);
        const version = await saveVersion(cloud, current.id, state, details);
        onCurrent({
          ...current,
          name: trimmed || current.name,
          versionId: version.id,
          savedKey: stateKey,
        });
        await refresh(current.id);
      }
      setAdding(false);
      toast.success("Added to version history");
    });

  const saveDetails = () =>
    run(async () => {
      const cloud = getCloud();
      if (!cloud || !editing) return;
      const next = await updateVersionDetails(cloud, editing.id, {
        title: editing.title,
        description: editing.description,
      });
      setVersions((list) =>
        list.map((v) =>
          v.id === editing.id
            ? { ...v, title: next.title, description: next.description }
            : v,
        ),
      );
      setEditing(null);
      toast.success("Version updated");
    });

  const confirmReplace = () =>
    !hasUnsaved ||
    window.confirm(
      "Opening this replaces the changes you haven't saved. Continue?",
    );

  const open_ = (task: () => Promise<LoadedVersion>) => {
    if (!confirmReplace()) return;
    void run(async () => {
      const loaded = await task();
      onOpen(loaded);
      onCurrent({
        id: loaded.paletteId,
        name: loaded.paletteName,
        versionId: loaded.versionId,
        savedKey: encodeState(loaded.state),
      });
      toast.success(`Opened ${loaded.paletteName}`);
    });
  };

  const remove = (p: PaletteSummary) => {
    if (
      !window.confirm(
        `Delete "${p.name}" and all of its versions? This can't be undone.`,
      )
    )
      return;
    void run(async () => {
      const cloud = getCloud();
      if (!cloud) return;
      await deletePalette(cloud, p.id);
      if (current?.id === p.id) onCurrent(null);
      await refresh(current?.id === p.id ? null : (current?.id ?? null));
    });
  };

  const status = failed
    ? { label: "The last save failed", color: "bg-red-500" }
    : dirty
      ? { label: "Unsaved changes", color: "bg-amber-400" }
      : current
        ? { label: "All changes saved", color: "bg-green-500" }
        : null;
  const label = !authReady
    ? "Save"
    : !signedIn
      ? "Sign in"
      : failed
        ? "Save failed"
        : dirty
          ? "Unsaved"
          : current
            ? "Saved"
            : "Not saved";

  const panel = (
    <div className="divide-y divide-border">
      <section className="space-y-1 px-5 py-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">
            {signedIn ? "Version history" : "Sign in to save"}
          </h2>
          <div className="-mr-2 flex items-center">
            {signedIn ? (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Add to version history"
                title="Add to version history (⌘⌥S)"
                disabled={busy}
                onClick={() => setAdding(true)}
              >
                <Plus />
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Close version history"
              onClick={() => onOpenChange(false)}
            >
              <X />
            </Button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {signedIn
            ? "Your palette saves itself. Add a named version to mark a moment you want to come back to."
            : "Saved palettes follow you across browsers. We email you a sign-in code, so there's no password."}
        </p>
      </section>

      {!signedIn ? (
        <section className="space-y-3 px-5 py-4">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (email.trim()) void signIn();
            }}
          >
            <Input
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              aria-label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button type="submit" disabled={busy || !email.trim()}>
              <Mail />
              {sent ? "Email me a new code" : "Email me a sign-in code"}
            </Button>
            {sent ? (
              <p className="text-xs text-muted-foreground">
                Check your inbox, then enter the code below. Your current
                palette stays as it is.
              </p>
            ) : null}
          </form>
          {sent ? (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (code.length >= 6) void verifyCode();
              }}
            >
              <Input
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="Code from the email"
                aria-label="Sign-in code"
                maxLength={10}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
              <Button type="submit" disabled={busy || code.length < 6}>
                Sign in
              </Button>
            </form>
          ) : null}
        </section>
      ) : (
        <>
          <section className="space-y-3 px-5 py-4">
            <div className="flex items-center gap-2 rounded-lg bg-muted px-2.5 py-2 text-xs">
              <span
                aria-hidden
                className={`size-1.5 shrink-0 rounded-full ${status?.color ?? "bg-muted-foreground/40"}`}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {current ? name.trim() || current.name : "Not saved yet"}
                </span>
                <span className="text-muted-foreground">
                  {status?.label ??
                    "Changes save themselves once you start editing."}
                </span>
              </span>
            </div>
            {current ? (
              <VersionList
                versions={versions}
                currentId={current.versionId}
                editing={editing}
                onEditing={setEditing}
                onSaveDetails={() => void saveDetails()}
                showAutosaves={showAutosaves}
                onToggleAutosaves={() => setShowAutosaves((v) => !v)}
                busy={busy}
                onOpen={(id) => open_(() => loadVersion(getCloud()!, id))}
              />
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Press + or ⌘⌥S to name a version once the palette is saved.
              </p>
            )}
          </section>

          <section className="space-y-2 px-5 py-4">
            <h3 className="text-xs font-semibold tracking-wide uppercase">
              Your palettes
            </h3>
            {palettes.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nothing saved yet.
              </p>
            ) : (
              <ul className="max-h-48 divide-y divide-border overflow-y-auto rounded-lg border border-border">
                {palettes.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-2 px-2.5 py-1.5 text-xs"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {p.name}
                      </span>
                      <span className="text-muted-foreground">
                        {when(p.updatedAt)}
                      </span>
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => open_(() => loadLatest(getCloud()!, p.id))}
                    >
                      Open latest
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${p.name}`}
                      disabled={busy}
                      onClick={() => remove(p)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <section className="flex items-center justify-between gap-3 px-5 py-4">
        <p className="text-xs text-muted-foreground">
          Start over from the starter palette.
        </p>
        <Button
          variant="destructive"
          size="sm"
          className="shrink-0"
          onClick={() => {
            onOpenChange(false);
            onReset();
          }}
        >
          <RotateCcw />
          Reset
        </Button>
      </section>
    </div>
  );

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        aria-label="Version history"
        aria-expanded={open}
        onClick={toggle}
        className={open ? "bg-muted" : undefined}
      >
        {status ? (
          <span
            aria-hidden
            className={`size-1.5 shrink-0 rounded-full ${status.color}`}
          />
        ) : null}
        <span className="hidden sm:inline">{label}</span>
      </Button>
      {open && slot ? createPortal(panel, slot) : null}
      <AddVersionDialog
        open={adding}
        onOpenChange={setAdding}
        busy={busy}
        onSubmit={(details) => void addVersion(details)}
      />
    </>
  );
}

interface EditingVersion {
  id: string;
  title: string;
  description: string;
}

/** Named versions first, newest on top, with the unnamed autosaves folded into one group. */
function VersionList({
  versions,
  currentId,
  editing,
  onEditing,
  onSaveDetails,
  showAutosaves,
  onToggleAutosaves,
  busy,
  onOpen,
}: {
  versions: VersionSummary[];
  currentId: string;
  editing: EditingVersion | null;
  onEditing: (next: EditingVersion | null) => void;
  onSaveDetails: () => void;
  showAutosaves: boolean;
  onToggleAutosaves: () => void;
  busy: boolean;
  onOpen: (versionId: string) => void;
}) {
  const named = versions.filter((v) => v.title !== null);
  const autosaves = versions.filter((v) => v.title === null);

  const open = (v: VersionSummary) =>
    v.id === currentId ? (
      <span className="shrink-0 text-[11px] text-muted-foreground">
        Open now
      </span>
    ) : (
      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={() => onOpen(v.id)}
      >
        Open
      </Button>
    );

  return (
    <div className="space-y-2">
      {named.length > 0 ? (
        <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-lg border border-border">
          {named.map((v) => (
            <li key={v.id} className="px-2.5 py-2 text-xs">
              {editing?.id === v.id ? (
                <form
                  className="space-y-1.5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    onSaveDetails();
                  }}
                >
                  <Input
                    autoFocus
                    aria-label="Version title"
                    maxLength={80}
                    value={editing.title}
                    onChange={(e) =>
                      onEditing({ ...editing, title: e.target.value })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        e.stopPropagation();
                        onEditing(null);
                      }
                    }}
                    className="h-7 text-xs"
                  />
                  <Textarea
                    aria-label="Version description"
                    maxLength={200}
                    value={editing.description}
                    onChange={(e) =>
                      onEditing({ ...editing, description: e.target.value })
                    }
                    className="min-h-12 text-xs md:text-xs"
                  />
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onEditing(null)}
                    >
                      <X />
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={busy || !editing.title.trim()}
                    >
                      <Check />
                      Save
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="flex items-start gap-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {v.title}
                    </span>
                    {v.description ? (
                      <span className="block text-muted-foreground">
                        {v.description}
                      </span>
                    ) : null}
                    <span className="text-muted-foreground">
                      {when(v.createdAt)}
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${v.title}`}
                    disabled={busy}
                    onClick={() =>
                      onEditing({
                        id: v.id,
                        title: v.title ?? "",
                        description: v.description ?? "",
                      })
                    }
                    className="text-muted-foreground"
                  >
                    <Pencil />
                  </Button>
                  {open(v)}
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          No named versions yet. Press + or ⌘⌥S to add one.
        </p>
      )}
      {autosaves.length > 0 ? (
        <div>
          <button
            type="button"
            aria-expanded={showAutosaves}
            onClick={onToggleAutosaves}
            className="flex w-full items-center gap-1 rounded-md py-1 text-xs text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <ChevronRight
              className={`size-3.5 transition-transform ${showAutosaves ? "rotate-90" : ""}`}
            />
            {autosaves.length} autosave{" "}
            {autosaves.length === 1 ? "version" : "versions"}
          </button>
          {showAutosaves ? (
            <ul className="max-h-40 divide-y divide-border overflow-y-auto rounded-lg border border-border">
              {autosaves.map((v) => (
                <li
                  key={v.id}
                  className="flex items-center gap-2 px-2.5 py-1.5 text-xs"
                >
                  <span className="min-w-0 flex-1 text-muted-foreground">
                    {when(v.createdAt)}
                  </span>
                  {open(v)}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
