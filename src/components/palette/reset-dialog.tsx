"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Confirms throwing the current palette away for the starter one. */
export function ResetDialog({
  open,
  onOpenChange,
  onReset,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReset: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Reset to the starter palette?</DialogTitle>
          <DialogDescription>
            This replaces your current colors, steps, tweaks and contrast rules.
            Your saved palettes aren&apos;t touched, and you can undo it right
            after with ⌘Z.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onOpenChange(false);
              onReset();
            }}
          >
            Reset palette
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
