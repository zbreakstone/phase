"use client";

import { ChevronLeft } from "lucide-react";

export interface Crumb {
  label: string;
  /** Omit on the current page. */
  onClick?: () => void;
}

/** Where you are (all colors, one color, one step): the current level, with a back button to its parent. */
export function Crumbs({ items }: { items: Crumb[] }) {
  const current = items[items.length - 1];
  const parent = [...items].reverse().find((c) => c.onClick);
  if (!current) return null;
  return (
    <nav aria-label="Where you are" className="flex items-center gap-1 text-xs text-muted-foreground">
      {parent ? (
        <button
          type="button"
          onClick={parent.onClick}
          aria-label={`Back to ${parent.label}`}
          title={`Back to ${parent.label}`}
          className="-ml-1 flex size-6 items-center justify-center rounded-md hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <ChevronLeft className="size-4" />
        </button>
      ) : null}
      <span aria-current="page" className="truncate font-medium text-foreground">
        {current.label}
      </span>
    </nav>
  );
}
