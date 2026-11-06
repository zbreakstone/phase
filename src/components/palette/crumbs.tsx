"use client";

import * as React from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleVariants } from "@/components/ui/toggle";
import { Hint } from "./hint";
import { useRovingFocus } from "./use-roving-focus";

export interface Crumb {
  label: string;
  /** Omit on the current page (unless it has a `render`, which makes it a parent without a back action). */
  onClick?: () => void;
  /** Shown in place of the back button when this is the parent, e.g. a menu that goes straight to a sibling. */
  render?: React.ReactNode;
}

/** Previous/next buttons beside the crumbs, for moving between siblings at this level (null disables one). */
export interface Stepper {
  /** Horizontal for steps along a scale, vertical for colors in a list. */
  axis: "horizontal" | "vertical";
  label: string;
  onPrevious: (() => void) | null;
  onNext: (() => void) | null;
}

/** Where you are: a button back to the parent level ("< Green"), or the plain current level at the top. */
export function Crumbs({ items, stepper }: { items: Crumb[]; stepper?: Stepper }) {
  const ref = React.useRef<HTMLDivElement>(null);
  useRovingFocus(ref);
  const current = items[items.length - 1];
  const parent = [...items].reverse().find((c) => c.onClick || c.render);
  if (!current) return null;
  const label = <span className="truncate font-medium">{current.label}</span>;
  const vertical = stepper?.axis === "vertical";
  const [PrevIcon, NextIcon] = vertical ? [ArrowUp, ArrowDown] : [ArrowLeft, ArrowRight];
  return (
    <div ref={ref} {...(parent || stepper ? { role: "toolbar", "aria-label": "Navigate", "data-region": "navigate" } : {})} className="flex min-w-0 items-center gap-2">
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
    {stepper ? (
      <div role="group" aria-label={`Move between ${stepper.label}`} className="flex shrink-0 items-center gap-2">
        {(
          [
            { name: `Previous ${stepper.label.replace(/s$/, "")}`, Icon: PrevIcon, run: stepper.onPrevious, key: vertical ? "ArrowUp" : "ArrowLeft", glyph: vertical ? "↑" : "←" },
            { name: `Next ${stepper.label.replace(/s$/, "")}`, Icon: NextIcon, run: stepper.onNext, key: vertical ? "ArrowDown" : "ArrowRight", glyph: vertical ? "↓" : "→" },
          ] as const
        ).map(({ name, Icon, run, key, glyph }) => (
          <Hint key={name} label={name} shortcut={[glyph]}>
            {/* A disabled button gets no pointer events, so the tooltip hangs off a wrapper instead. */}
            <span className="inline-flex">
              <button type="button" className={toggleVariants({ variant: "outline", size: "sm" })} onClick={() => run?.()} disabled={!run} aria-label={name} aria-keyshortcuts={key}>
                <Icon />
              </button>
            </span>
          </Hint>
        ))}
      </div>
    ) : null}
    </div>
  );
}
