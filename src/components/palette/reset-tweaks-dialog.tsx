"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Asks before clearing every nudge on a color at once. Keeps its last text while it animates closed. */
export function ResetTweaksDialog({ open, name, count, onOpenChange, onConfirm }: { open: boolean; name: string; count: number; onOpenChange: (open: boolean) => void; onConfirm: () => void }) {
  const [last, setLast] = React.useState({ name, count });
  if (open && (last.name !== name || last.count !== count)) setLast({ name, count });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            Reset {last.count} tuned {last.count === 1 ? "step" : "steps"} in {last.name}?
          </DialogTitle>
          <DialogDescription>Every hue and colorfulness nudge on {last.name} goes back to its curve. You can undo it right after with ⌘Z.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            Reset {last.count === 1 ? "step" : "steps"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
