"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

/** Renames a saved palette. */
export function RenamePaletteDialog({ name, onClose, onSubmit }: { name: string | null; onClose: () => void; onSubmit: (name: string) => void }) {
  const [value, setValue] = React.useState("");
  const [seen, setSeen] = React.useState<string | null>(null);
  // Start from the palette's current name each time the dialog opens.
  if (name !== seen) {
    setSeen(name);
    if (name !== null) setValue(name);
  }

  return (
    <Dialog open={name !== null} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit info</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (value.trim()) onSubmit(value.trim());
          }}
        >
          <Input autoFocus aria-label="Palette name" placeholder="Palette name" maxLength={80} value={value} onChange={(e) => setValue(e.target.value)} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!value.trim()}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
