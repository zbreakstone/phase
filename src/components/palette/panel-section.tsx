"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { SlidingPill } from "./sliding-pill";
import { useRovingFocus } from "./use-roving-focus";

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

type Tab = { id: string; title: React.ReactNode };
type Group = {
  tabs: Tab[];
  activeId: string | null;
  select: (id: string) => void;
  register: (tab: Tab) => () => void;
};
const SectionGroupContext = React.createContext<Group | null>(null);

/**
 * Sections inside become tabs: each registers itself, <SectionTabs /> draws the bar, and only the chosen one shows.
 * If the chosen tab isn't there (stepping to a step that has no Adjustments, say) the first one stands in.
 */
export function SectionGroup({ defaultOpen = null, children }: { defaultOpen?: string | null; children: React.ReactNode }) {
  const [openId, setOpenId] = React.useState<string | null>(defaultOpen);
  const [tabs, setTabs] = React.useState<Tab[]>([]);
  const register = React.useCallback((tab: Tab) => {
    setTabs((prev) => (prev.some((t) => t.id === tab.id) ? prev.map((t) => (t.id === tab.id ? tab : t)) : [...prev, tab]));
    return () => setTabs((prev) => prev.filter((t) => t.id !== tab.id));
  }, []);
  const activeId = tabs.find((t) => t.id === openId)?.id ?? tabs[0]?.id ?? null;
  const value = React.useMemo(() => ({ tabs, activeId, select: setOpenId, register }), [tabs, activeId, register]);
  return <SectionGroupContext.Provider value={value}>{children}</SectionGroupContext.Provider>;
}

/** The tab bar for the sections in the group, styled like the chart's metric tabs. */
export function SectionTabs() {
  const group = React.useContext(SectionGroupContext);
  const ref = React.useRef<HTMLDivElement>(null);
  useRovingFocus(ref, { items: '[role="tab"]' });
  if (!group) return null;
  const { tabs, activeId, select } = group;
  return (
    <div className="flex shrink-0 items-center px-5 pt-4">
      <div ref={ref} role="tablist" aria-label="Sidebar sections" className="relative -ml-1.5 flex min-w-0 items-center gap-0.5">
        <SlidingPill activeKey={activeId} />
        {tabs.map((t) => {
          const on = t.id === activeId;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`${t.id}-tab`}
              aria-selected={on}
              aria-controls={`${t.id}-body`}
              data-current={on || undefined}
              data-active={on}
              onClick={() => select(t.id)}
              // Arrow keys move focus along the tabs, and the tab under focus is the one shown.
              onFocus={(e) => e.currentTarget.matches(":focus-visible") && select(t.id)}
              className={cn(
                "relative flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring",
                on ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.title}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * One tab's content in the sidebar.
 * Once opened, a tab stays mounted while hidden, so a half-edited field survives a visit to another tab.
 */
export function CollapsibleSection({
  id,
  title,
  className,
  children,
}: {
  id: string;
  title: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const group = React.useContext(SectionGroupContext);
  const register = group?.register;
  React.useLayoutEffect(() => register?.({ id, title }), [register, id, title]);
  const open = !group || group.activeId === id;
  // Content mounts the first time its tab opens: Base UI sliders measure on mount and keep their thumbs hidden
  // if that happens under `display: none`.
  const [seen, setSeen] = React.useState(open);
  if (open && !seen) setSeen(true);
  return (
    <PanelSection role="tabpanel" id={`${id}-body`} aria-labelledby={`${id}-tab`} hidden={!open}>
      {seen ? <div className={className}>{children}</div> : null}
    </PanelSection>
  );
}
