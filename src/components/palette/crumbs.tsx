"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

export interface Crumb {
  label: string;
  /** Omit on the current page. */
  onClick?: () => void;
}

/** Where you are in the palette (All colors, one color, one step), with each earlier level a button back. */
export function Crumbs({ items }: { items: Crumb[] }) {
  const parent = [...items].reverse().find((c) => c.onClick);
  return (
    <nav aria-label="Where you are" className="flex items-center gap-1 text-xs text-muted-foreground">
      {parent ? (
        <button type="button" onClick={parent.onClick} aria-label={`Back to ${parent.label}`} className="-ml-1 flex size-6 items-center justify-center rounded-md hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          <ChevronLeft className="size-4" />
        </button>
      ) : null}
      <ol className="flex min-w-0 items-center gap-1">
        {items.map((c, i) => (
          <li key={i} className="flex min-w-0 items-center gap-1">
            {i > 0 ? <ChevronRight className="size-3 shrink-0 opacity-60" /> : null}
            {c.onClick ? (
              <button type="button" onClick={c.onClick} className="truncate rounded-sm hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                {c.label}
              </button>
            ) : (
              <span aria-current="page" className="truncate font-medium text-foreground">
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
