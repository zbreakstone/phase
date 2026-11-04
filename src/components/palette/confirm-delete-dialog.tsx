"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Copy {
  title: string;
  description: string;
  confirm: string;
}

/** Asks before deleting something. Keeps its last text while it animates closed. */
export function ConfirmDeleteDialog({ open, title, description, confirm, onOpenChange, onConfirm }: Copy & { open: boolean; onOpenChange: (open: boolean) => void; onConfirm: () => void }) {
  const [last, setLast] = React.useState<Copy>({ title, description, confirm });
  if (open && (last.title !== title || last.description !== description || last.confirm !== confirm)) setLast({ title, description, confirm });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{last.title}</DialogTitle>
          <DialogDescription>{last.description}</DialogDescription>
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
            {last.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
