"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { GeneratedHue, PaletteState } from "@/lib/palette/types";
import { ExportPanel } from "./export-panel";
import type { ExportKind } from "./share-menu";

const COPY: Record<ExportKind, { title: string; description: string }> = {
  css: { title: "Export CSS variables", description: "Custom properties for every step. Each hue includes white (0) and black (1000)." },
  json: { title: "Export JSON tokens", description: "Design tokens you can import into a codebase or token tool. Each hue includes white (0) and black (1000)." },
  tailwind: { title: "Export Tailwind theme", description: "A color theme for Tailwind. Each hue includes white (0) and black (1000)." },
  figma: { title: "Export Figma variables", description: "A variables file for Figma. Each hue includes white (0) and black (1000)." },
};

/** Opens from the Share menu with the chosen format; closes by setting `kind` back to null. */
export function ExportDialog({ kind, onClose, state, generated }: { kind: ExportKind | null; onClose: () => void; state: PaletteState; generated: GeneratedHue[] }) {
  // Remember the last format so the content doesn't blank out while the dialog animates closed.
  const [shown, setShown] = React.useState<ExportKind>(kind ?? "css");
  if (kind && kind !== shown) setShown(kind);

  return (
    <Dialog open={kind !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{COPY[shown].title}</DialogTitle>
          <DialogDescription>{COPY[shown].description}</DialogDescription>
        </DialogHeader>
        <ExportPanel key={shown} tab={shown} state={state} generated={generated} />
      </DialogContent>
    </Dialog>
  );
}
