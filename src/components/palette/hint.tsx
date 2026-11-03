"use client";

import * as React from "react";
import { KbdGroup } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Wraps one element (usually an icon button) in a shadcn tooltip, in place of the browser's slow, unstyled
 * `title`. Keep an `aria-label` on the element; the tooltip is visual extra, not its accessible name.
 */
export function Hint({
  label,
  shortcut,
  side,
  children,
}: {
  label: React.ReactNode;
  /** Keys to show next to the label, such as `["⌘", "Z"]`. */
  shortcut?: string[];
  side?: "top" | "bottom" | "left" | "right";
  children: React.ReactElement;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side={side} className="max-w-64 text-balance">
        {label}
        {shortcut ? <KbdGroup keys={shortcut} size="sm" inverted /> : null}
      </TooltipContent>
    </Tooltip>
  );
}
