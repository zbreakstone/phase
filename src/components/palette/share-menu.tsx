"use client";

import * as React from "react";
import { Braces, ChevronRight, Link2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CssLogo, FigmaLogo, TailwindLogo } from "./brand-icons";

export type ExportKind = "css" | "json" | "tailwind" | "figma";

const EXPORTS: { kind: ExportKind; title: string; description: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { kind: "css", title: "CSS variables", description: "Custom properties in any color format", icon: CssLogo },
  { kind: "json", title: "JSON tokens", description: "Design tokens for token tools", icon: Braces },
  { kind: "tailwind", title: "Tailwind", description: "A v4 @theme or a v3 config", icon: TailwindLogo },
  { kind: "figma", title: "Figma variables", description: "Import in Figma's Variables panel", icon: FigmaLogo },
];

/**
 * One place to get the palette out of Phase. Sharing a link is the default action, and each export
 * format sits below it; choosing one opens the export dialog with just that format's controls.
 */
export function ShareMenu({ disabled, onCopyLink, onExport }: { disabled: boolean; onCopyLink: () => void; onExport: (kind: ExportKind) => void }) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button size="sm" disabled={disabled} aria-label="Share or export" />}>
        <Share2 />
        Share
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-0 p-0">
        <div className="flex items-center gap-3 p-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Link2 className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Share a link</p>
            <p className="text-xs text-muted-foreground">Anyone with it sees this exact palette.</p>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setOpen(false);
              onCopyLink();
            }}
          >
            Copy link
          </Button>
        </div>
        <div className="border-t border-border p-1.5">
          <p className="px-1.5 pt-1 pb-1.5 text-xs font-medium text-muted-foreground">Export</p>
          {EXPORTS.map(({ kind, title, description, icon: Icon }) => (
            <button
              key={kind}
              type="button"
              onClick={() => {
                setOpen(false);
                onExport(kind);
              }}
              className="flex w-full items-center gap-3 rounded-lg p-1.5 text-left hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Icon className={kind === "json" ? "size-4" : "size-5 shrink-0"} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{title}</span>
                <span className="block truncate text-xs text-muted-foreground">{description}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
