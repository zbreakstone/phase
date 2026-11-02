"use client";

import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface Crumb {
  label: string;
  /** Omit on the current page. */
  onClick?: () => void;
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
      {parent ? (
        // A button that names where it goes, not where you are. Styled like the toolbar toggles (white fill,
        // small shadow) so it reads as clickable.
        <Button
          variant="ghost"
          size="sm"
          onClick={parent.onClick}
          aria-label={`Back to ${parent.label}`}
          className="min-w-0 bg-white pr-3 pl-1.5 text-sm shadow-(--shadow-default) transition-[color,box-shadow] hover:bg-white hover:shadow-(--shadow-large) dark:bg-input/30 dark:hover:bg-input/30"
        >
          <ChevronLeft className="shrink-0" />
          <span className="truncate font-medium">{parent.label}</span>
        </Button>
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
