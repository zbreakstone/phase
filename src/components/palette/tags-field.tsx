"use client";

import * as React from "react";
import { Moon, X } from "lucide-react";
import { assignToken, normalizePath, refLabel, removeToken, sameRef, tokensAt } from "@/lib/palette/tokens";
import type { PaletteState, TokenRef } from "@/lib/palette/types";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Hint } from "./hint";

/** A labeled, full-width spot for a tags field, with a line explaining what tags do there. */
export function TagsBlock({ htmlFor, hint, children }: { htmlFor: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor} className="text-sm font-normal text-muted-foreground">
        Semantic tags
      </Label>
      {children}
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

type Option = { path: string; isNew: boolean; elsewhere: string | null };

const MAX_OPTIONS = 8;

/**
 * The semantic tokens on one color or step, as chips. Typing offers the palette's other tokens; Enter adds
 * the highlighted one, or the typed name as a new token. A name that's on something else
 * moves here.
 */
export function TagsField({
  id,
  state,
  at,
  onApply,
}: {
  id: string;
  state: PaletteState;
  at: TokenRef;
  onApply: (fn: (s: PaletteState) => PaletteState) => void;
}) {
  const here = tokensAt(state, at);
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listId = `${id}-options`;

  const options = React.useMemo<Option[]>(() => {
    const typed = normalizePath(query);
    const q = query.trim().toLowerCase().replace(/\s+/g, "-").replace(/\./g, "/");
    const taken = new Set(here.map((t) => t.path));
    const byPath = new Map((state.tokens ?? []).map((t) => [t.path, t]));
    const option = (path: string): Option => {
      const owner = byPath.get(path)?.light;
      return { path, isNew: !byPath.has(path), elsewhere: owner && !sameRef(owner, at) ? refLabel(state, owner) : null };
    };
    const matches = [...byPath.keys()]
      .sort((a, b) => a.localeCompare(b))
      .filter((p) => !taken.has(p) && (!q || p.includes(q)))
      .slice(0, MAX_OPTIONS)
      .map(option);
    // An existing name the list cut off comes first; a brand-new one comes last, so Enter picks the closest match.
    if (typed && !taken.has(typed) && !matches.some((m) => m.path === typed)) {
      const o = option(typed);
      if (o.isNew) matches.push(o);
      else matches.unshift(o);
    }
    return matches;
  }, [query, here, state, at]);

  const add = (path: string) => addAll([path]);

  /** Adds several names as one edit, so a pasted list undoes in one step. */
  const addAll = (paths: string[]) => {
    if (paths.length) onApply((s) => paths.reduce((next, p) => assignToken(next, p, at), s));
    setQuery("");
    setActive(0);
  };

  const splitNames = (text: string) => text.split(/[,\n]/).map(normalizePath).filter((p): p is string => !!p);

  const showList = open && options.length > 0;

  return (
    <div className="relative">
      <div
        className="flex min-h-8 w-full flex-wrap items-center gap-1 rounded-lg bg-white px-1 py-1 shadow-(--shadow-default) transition-[box-shadow] focus-within:ring-3 focus-within:ring-ring/50 hover:shadow-(--shadow-large) dark:bg-input/30"
        onClick={() => inputRef.current?.focus()}
      >
        {here.map((t) => (
          <span key={t.id} className="inline-flex h-6 items-center gap-1 rounded-md bg-muted pr-0.5 pl-1.5 font-mono text-[11px]">
            {t.path}
            {t.dark !== undefined ? (
              <Hint label={t.dark ? `Dark: ${refLabel(state, t.dark)}` : "Dark value not set"}>
                <Moon aria-label="Has its own dark value" className="size-3 text-muted-foreground" />
              </Hint>
            ) : null}
            <button
              type="button"
              aria-label={`Remove ${t.path}`}
              onClick={(e) => {
                e.stopPropagation();
                onApply((s) => removeToken(s, t.id));
              }}
              className="grid size-5 place-items-center rounded-sm text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList ? `${listId}-${active}` : undefined}
          value={query}
          placeholder={here.length ? "" : "Add tags, like border/subtle, warning"}
          onChange={(e) => {
            const value = e.target.value;
            // A comma finishes the name before it; whatever follows stays in the field.
            const cut = value.lastIndexOf(",");
            if (cut >= 0) {
              addAll(splitNames(value.slice(0, cut)));
              setQuery(value.slice(cut + 1).trimStart());
            } else {
              setQuery(value);
              setActive(0);
            }
            setOpen(true);
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            if (!/[,\n]/.test(text)) return;
            e.preventDefault();
            addAll(splitNames(query + text));
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && options.length) {
              e.preventDefault();
              setOpen(true);
              setActive((i) => (i + 1) % options.length);
            } else if (e.key === "ArrowUp" && options.length) {
              e.preventDefault();
              setActive((i) => (i - 1 + options.length) % options.length);
            } else if (e.key === "Enter") {
              e.preventDefault();
              const pick = showList ? options[active] : null;
              const typed = normalizePath(query);
              if (pick) add(pick.path);
              else if (typed) add(typed);
            } else if (e.key === "Escape" && showList) {
              // Close the list first; the next Esc is the sidebar's.
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
            } else if (e.key === "Backspace" && query === "" && here.length) {
              const last = here[here.length - 1];
              onApply((s) => removeToken(s, last.id));
            }
          }}
          className="h-6 min-w-24 flex-1 bg-transparent px-1.5 text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      {showList ? (
        <div
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-50 mt-1 rounded-xl bg-popover p-1 text-popover-foreground shadow-(--shadow-large)"
        >
          {options.map((o, i) => (
            <div
              key={o.path}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // Keep focus in the input so the list doesn't close before the click lands.
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => add(o.path)}
              className={cn("flex cursor-default items-center justify-between gap-2 rounded-lg px-1.5 py-1 text-sm", i === active && "bg-accent text-accent-foreground")}
            >
              <span className="truncate font-mono text-xs">{o.isNew ? `Add “${o.path}”` : o.path}</span>
              {o.elsewhere ? <span className="shrink-0 text-xs text-muted-foreground">Moves from {o.elsewhere}</span> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
