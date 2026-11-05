"use client";

import * as React from "react";
import { Braces, ChevronRight, Link2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Hint } from "./hint";
import { useKeyShortcut } from "./use-key-shortcut";
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
  useKeyShortcut("KeyS", () => setOpen(true), { shift: true, enabled: !disabled });

  // A menu rather than a popover, so the arrow keys, Home and End, and typing a name move through the choices.
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <Hint label="Share or export" shortcut={["⇧", "S"]}>
        <DropdownMenuTrigger render={<Button size="sm" disabled={disabled} aria-label="Share or export" className="bg-clip-border shadow-(--shadow-default) transition-[background-color,box-shadow] hover:shadow-(--shadow-large)" />}>
          <Share2 />
          Share
        </DropdownMenuTrigger>
      </Hint>
      <DropdownMenuContent align="end" className="w-80 gap-0 p-1.5">
        <DropdownMenuItem onClick={onCopyLink} className="gap-3 rounded-lg p-1.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Link2 className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">Copy link</span>
            <span className="block text-xs font-normal text-muted-foreground">Anyone with it sees this exact palette.</span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="-mx-1.5 my-1.5" />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-1.5 pt-1 pb-1.5">Export</DropdownMenuLabel>
          {EXPORTS.map(({ kind, title, description, icon: Icon }) => (
            <DropdownMenuItem key={kind} onClick={() => onExport(kind)} className="gap-3 rounded-lg p-1.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Icon className={kind === "json" ? "size-4" : "size-5 shrink-0"} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{title}</span>
                <span className="block truncate text-xs font-normal text-muted-foreground">{description}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
