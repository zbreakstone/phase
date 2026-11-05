"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import type { Session } from "@supabase/supabase-js";
import { Check, Mail, MoreHorizontal, Plus, RotateCcwClock, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toggleVariants } from "@/components/ui/toggle";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { KbdGroup } from "@/components/ui/kbd";
import { Hint } from "./hint";
import { isPopupOpen, isTextEntry } from "./text-entry";
import { AddVersionDialog } from "./add-version-dialog";
import { cloudEnabled, getCloud } from "@/lib/cloud/client";
import {
  type LoadedVersion,
  type VersionDetails,
  type VersionSummary,
  createPalette,
  createShare,
  listVersions,
  loadVersion,
  renamePalette,
  saveVersion,
  updateVersionDetails,
} from "@/lib/cloud/palettes";
import { contentKey } from "@/lib/palette/serialize";
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
  open,
  onOpenChange,
  slot,
}: Props) {
  const enabled = cloudEnabled();
  const [session, setSession] = React.useState<Session | null>(null);
  const [, setAuthReady] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  /** The last save, open or load failed. Cleared by the next one that works. */
  const [failed, setFailed] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [code, setCode] = React.useState("");
  /** The "Add to version history" dialog. */
  const [adding, setAdding] = React.useState(false);
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

  // V shows or hides the version history, unless you're typing or a dialog or menu is open.
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || e.metaKey || e.ctrlKey || e.altKey || e.key.toLowerCase() !== "v") return;
      if (isTextEntry(e.target)) return;
      if (isPopupOpen('[data-slot="dialog-content"], [data-slot="popover-content"], [data-slot="select-content"], [role="menu"]')) return;
      if (!buttonRef.current) return;
      e.preventDefault();
      buttonRef.current.click();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const refresh = React.useCallback(async (paletteId: string | null) => {
    const cloud = getCloud();
    if (!cloud) return;
    try {
      setVersions(paletteId ? await listVersions(cloud, paletteId) : []);
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
        savedKey: contentKey(loaded.state),
      });
      toast.success(`Opened ${loaded.paletteName}`);
    });
  };

  /** Puts an older version back on top of the work in progress. Unsaved edits are kept as a version first. */
  const restore = (v: VersionSummary) =>
    run(async () => {
      const cloud = getCloud();
      if (!cloud || !current) return;
      const loaded = await loadVersion(cloud, v.id);
      if (dirty) await saveVersion(cloud, current.id, state);
      const label = v.title ?? when(v.createdAt);
      const restored = await saveVersion(cloud, current.id, loaded.state, {
        title: `Restored ${label}`.slice(0, 80),
        description: "",
      });
      onOpen({ ...loaded, versionId: restored.id });
      onCurrent({
        ...current,
        versionId: restored.id,
        savedKey: contentKey(loaded.state),
      });
      await refresh(current.id);
      toast.success("Version restored");
    });

  /** Starts a new palette from a version, leaving the original alone. */
  const duplicate = (v: VersionSummary) => {
    if (!confirmReplace()) return;
    void run(async () => {
      const cloud = getCloud();
      if (!cloud) return;
      const loaded = await loadVersion(cloud, v.id);
      const copyName = `${loaded.paletteName} copy`.slice(0, 80);
      const { paletteId, version } = await createPalette(
        cloud,
        copyName,
        loaded.state,
      );
      onOpen({
        ...loaded,
        paletteId,
        paletteName: copyName,
        versionId: version.id,
      });
      onCurrent({
        id: paletteId,
        name: copyName,
        versionId: version.id,
        savedKey: contentKey(loaded.state),
      });
      await refresh(paletteId);
      toast.success(`Created ${copyName}`);
    });
  };

  const copyLink = (v: VersionSummary) =>
    run(async () => {
      const cloud = getCloud();
      if (!cloud) return;
      const loaded = await loadVersion(cloud, v.id);
      const url = `${window.location.origin}/s/${await createShare(cloud, loaded.state)}`;
      try {
        await navigator.clipboard.writeText(url);
        toast.success(`Link copied: ${url}`);
      } catch {
        toast.message(url);
      }
    });

  /** The dot on the history button: how the last save went. Nothing until there is a saved palette to report on. */
  const status = failed
    ? { label: "The last save failed", color: "bg-red-500" }
    : dirty
      ? { label: "Unsaved changes", color: "bg-amber-400" }
      : current
        ? { label: "All changes saved", color: "bg-green-500" }
        : null;

  const panel = (
    <div className="flex h-full min-h-0 flex-col divide-y divide-border">
      <section className="flex items-center justify-between gap-2 px-5 py-4">
        <h2 className="text-sm font-semibold">
          {signedIn ? "Version history" : "Sign in to save"}
        </h2>
        <div className="-mr-2 flex items-center">
          {signedIn ? (
            <Hint label="Add to version history" shortcut={["⌘", "⌥", "S"]}>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Add to version history"
                disabled={busy}
                onClick={() => setAdding(true)}
              >
                <Plus />
              </Button>
            </Hint>
          ) : null}
          <Hint label="Close version history">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Close version history"
              onClick={() => onOpenChange(false)}
            >
              <X />
            </Button>
          </Hint>
        </div>
      </section>

      {!signedIn ? (
        <section className="space-y-3 px-5 py-4">
          <p className="text-xs text-muted-foreground">
            Saved palettes follow you across browsers. We email you a sign-in
            code, so there&apos;s no password.
          </p>
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
        <section className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
          <p className="text-xs text-muted-foreground">
            Press{" "}
            <KbdGroup keys={["⌘", "⌥", "S"]} size="sm" className="align-middle" />{" "}
            to add to version history while editing.
          </p>
          {current ? (
            <VersionList
              versions={versions}
              currentId={current.versionId}
              editing={editing}
              onEditing={setEditing}
              onSaveDetails={() => void saveDetails()}
              busy={busy}
              onOpen={(id) => open_(() => loadVersion(getCloud()!, id))}
              onRestore={(v) => void restore(v)}
              onDuplicate={duplicate}
              onCopyLink={(v) => void copyLink(v)}
            />
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Press + or ⌘⌥S to name a version once the palette is saved.
            </p>
          )}
        </section>
      )}
    </div>
  );

  return (
    <>
      <Hint label="Show version history" shortcut={["V"]}>
        <button
          ref={buttonRef}
          type="button"
          aria-label="Version history"
          aria-expanded={open}
          onClick={toggle}
          className={toggleVariants({ variant: "outline", size: "sm", className: open ? "relative bg-muted hover:bg-muted" : "relative" })}
        >
          <RotateCcwClock />
          {status ? (
            <>
              <span aria-hidden className={`absolute -top-0.5 -right-0.5 size-2 rounded-full ring-2 ring-background ${status.color}`} />
              <span className="sr-only">{status.label}</span>
            </>
          ) : null}
        </button>
      </Hint>
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

/** Every version on one timeline, newest first. Named versions stand out; autosaves are quieter dots. */
function VersionList({
  versions,
  currentId,
  editing,
  onEditing,
  onSaveDetails,
  busy,
  onOpen,
  onRestore,
  onDuplicate,
  onCopyLink,
}: {
  versions: VersionSummary[];
  currentId: string;
  editing: EditingVersion | null;
  onEditing: (next: EditingVersion | null) => void;
  onSaveDetails: () => void;
  busy: boolean;
  onOpen: (versionId: string) => void;
  onRestore: (version: VersionSummary) => void;
  onDuplicate: (version: VersionSummary) => void;
  onCopyLink: (version: VersionSummary) => void;
}) {
  return (
    <ol className="relative space-y-1 before:absolute before:top-3 before:bottom-3 before:left-[0.4375rem] before:w-px before:bg-border">
      {versions.map((v, i) => {
        const named = v.title !== null;
        const latest = i === 0;
        const isOpen = v.id === currentId;
        return (
          <li key={v.id} className="relative pl-6 text-xs">
            <span
              aria-hidden
              className={
                named
                  ? "absolute top-4 left-0 size-3.5 rounded-full border-2 border-white bg-foreground dark:border-black"
                  : "absolute top-[1.1875rem] left-[0.1875rem] size-2 rounded-full border-2 border-white bg-muted-foreground/60 dark:border-black"
              }
            />
            {editing?.id === v.id ? (
              <form
                className="space-y-1.5 py-2"
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
              <div
                className={`flex items-start gap-1 rounded-lg px-2 py-2 ${isOpen ? "bg-muted" : "hover:bg-muted/50"}`}
              >
                <button
                  type="button"
                  aria-current={isOpen ? "true" : undefined}
                  disabled={busy || isOpen}
                  onClick={() => onOpen(v.id)}
                  className="min-w-0 flex-1 cursor-pointer rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
                >
                  <span
                    className={`block truncate ${named || latest ? "font-medium" : "text-muted-foreground"}`}
                  >
                    {latest ? "Current version" : (v.title ?? "Autosave")}
                  </span>
                  {latest && named ? (
                    <span className="block truncate">{v.title}</span>
                  ) : null}
                  {v.description ? (
                    <span className="block text-muted-foreground">
                      {v.description}
                    </span>
                  ) : null}
                  <span className="text-muted-foreground">
                    {when(v.createdAt)}
                  </span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Actions for ${v.title ?? "autosave"}`}
                        disabled={busy}
                        className="text-muted-foreground"
                      />
                    }
                  >
                    <MoreHorizontal />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem
                      onClick={() =>
                        onEditing({
                          id: v.id,
                          title: v.title ?? "",
                          description: v.description ?? "",
                        })
                      }
                    >
                      Edit info
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={latest}
                      onClick={() => onRestore(v)}
                    >
                      Restore this version
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDuplicate(v)}>
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onCopyLink(v)}>
                      Copy link
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
