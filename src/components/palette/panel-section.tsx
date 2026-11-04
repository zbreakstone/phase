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

const SectionGroupContext = React.createContext<{ openId: string | null; setOpenId: (id: string | null) => void } | null>(null);

/** Sections inside behave like an accordion: opening one closes the others. Without a group each section folds on its own. */
export function SectionGroup({ defaultOpen = null, children }: { defaultOpen?: string | null; children: React.ReactNode }) {
  const [openId, setOpenId] = React.useState<string | null>(defaultOpen);
  const value = React.useMemo(() => ({ openId, setOpenId }), [openId]);
  return <SectionGroupContext.Provider value={value}>{children}</SectionGroupContext.Provider>;
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
  const group = React.useContext(SectionGroupContext);
  const [ownOpen, setOwnOpen] = React.useState(defaultOpen);
  const open = group ? group.openId === id : ownOpen;
  const toggle = () => (group ? group.setOpenId(open ? null : id) : setOwnOpen((o) => !o));
  return (
    <PanelSection role="region" aria-labelledby={`${id}-heading`}>
      <div className="flex min-h-8 items-center justify-between gap-2">
        <h2 id={`${id}-heading`} className="min-w-0 text-sm font-semibold">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={`${id}-body`}
            onClick={toggle}
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
      {/* Height animates through the grid row (0fr to 1fr); inert keeps a folded body out of the tab order. */}
      <div
        id={`${id}-body`}
        inert={!open}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="-mx-2 min-h-0 overflow-hidden px-2">
          <div className={cn("pt-3", className)}>{children}</div>
        </div>
      </div>
    </PanelSection>
  );
}
