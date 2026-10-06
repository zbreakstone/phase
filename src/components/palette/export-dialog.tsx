"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { GeneratedHue, PaletteState } from "@/lib/palette/types";
import { ExportPanel } from "./export-panel";

export function ExportDialog({ state, generated }: { state: PaletteState; generated: GeneratedHue[] }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" className="rounded-none" />}>
        <Download />
        Export
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Export</DialogTitle>
          <DialogDescription>CSS variables, design tokens or a Tailwind theme. Every hue includes white (0) and black (1000).</DialogDescription>
        </DialogHeader>
        <ExportPanel state={state} generated={generated} />
      </DialogContent>
    </Dialog>
  );
}
