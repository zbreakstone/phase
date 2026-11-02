"use client";

import * as React from "react";
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
  side,
  children,
}: {
  label: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  children: React.ReactElement;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side={side} className="max-w-64 text-balance">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
