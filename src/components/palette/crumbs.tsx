"use client";

import type * as React from "react";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Hint } from "./hint";

export interface Crumb {
  label: string;
  /** Omit on the current page. */
  onClick?: () => void;
  /** Shown in place of the back button when this is the parent, e.g. a menu that goes straight to a sibling. */
  render?: React.ReactNode;
}

/** Where you are: a button back to the parent level ("< Green"), or the plain current level at the top. */
export function Crumbs({ items }: { items: Crumb[] }) {
  const current = items[items.length - 1];
  const parent = [...items].reverse().find((c) => c.onClick);
  if (!current) return null;
  const label = <span className="truncate font-medium">{current.label}</span>;
  return (
    <nav
      aria-label="Where you are"
      className="flex min-w-0 text-sm text-muted-foreground"
    >
      {parent?.render ? (
        parent.render
      ) : parent ? (
        // A button that names where it goes, not where you are. Styled like the toolbar toggles (white fill,
        // small shadow) so it reads as clickable.
        <Hint label={`Back to ${parent.label}`} shortcut={["Esc"]}>
          <Button
            variant="ghost"
            size="sm"
            onClick={parent.onClick}
            aria-label={`Back to ${parent.label}`}
            aria-keyshortcuts="Escape"
            className="min-w-0 border-0 bg-white pr-3 pl-1.5 text-sm text-foreground shadow-(--shadow-default) transition-[color,box-shadow] hover:bg-white hover:shadow-(--shadow-large) dark:bg-input/30 dark:hover:bg-input/30"
          >
            <ChevronLeft className="shrink-0" />
            <span className="truncate font-medium">{parent.label}</span>
          </Button>
        </Hint>
      ) : (
        <span
          aria-current="page"
          className="flex h-7 items-center text-foreground"
        >
          {label}
        </span>
      )}
    </nav>
  );
}
