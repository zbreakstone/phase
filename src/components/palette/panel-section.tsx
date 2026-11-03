"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** One block of the sidebar. The card draws full-width dividers between sections, so padding lives here. */
export function PanelSection({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={cn("px-5 py-4", className)} {...props} />;
}

/** A setting with its label on the left and its control on the right. */
export function SettingRow({
  id,
  label,
  children,
}: {
  id?: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-4">
      <Label htmlFor={id} className="text-sm font-normal text-muted-foreground">
        {label}
      </Label>
      <div className="flex w-40 shrink-0 justify-end">{children}</div>
    </div>
  );
}

/**
 * A sidebar section with a semibold header that folds the body away. `action` sits at the right of the
 * header (e.g. an add button) and stays visible when the section is collapsed.
 */
export function CollapsibleSection({
  id,
  title,
  count,
  action,
  defaultOpen = true,
  className,
  children,
}: {
  id: string;
  title: React.ReactNode;
  /** How many things the section holds, shown as a badge next to the title. */
  count?: number;
  action?: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <PanelSection role="region" aria-labelledby={`${id}-heading`}>
      <div className="flex min-h-8 items-center justify-between gap-2">
        <h2 id={`${id}-heading`} className="min-w-0 text-sm font-semibold">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={`${id}-body`}
            onClick={() => setOpen((o) => !o)}
            className="-mx-1 flex items-center gap-1 rounded-md px-1 py-0.5 outline-none hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            {title}
            {count !== undefined ? (
              <Badge size="sm">
                {count}
              </Badge>
            ) : null}
            <ChevronDown
              className={cn(
                "size-4 text-muted-foreground transition-transform",
                !open && "-rotate-90",
              )}
            />
          </button>
        </h2>
        {action}
      </div>
      <div id={`${id}-body`} hidden={!open} className={cn("pt-3", className)}>
        {children}
      </div>
    </PanelSection>
  );
}
