"use client";

import * as React from "react";
import { FolderOpen, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uid } from "@/lib/palette/defaults";
import type { PaletteState } from "@/lib/palette/types";
import { getStorage, type SavedPalette } from "@/lib/storage";

export const AUTOSAVE_ID = "__autosave__";

interface Props {
  state: PaletteState;
  onOpen: (state: PaletteState) => void;
}

export function SavedDialog({ state, onOpen }: Props) {
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<SavedPalette[] | null>(null);
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const storage = React.useMemo(() => getStorage(), []);

  const refresh = React.useCallback(async () => {
    try {
      const all = await storage.list();
      setItems(all.filter((p) => p.id !== AUTOSAVE_ID));
      setError(null);
    } catch {
      setItems([]);
      setError("Saved palettes couldn't be loaded. Your browser may be blocking storage.");
    }
  }, [storage]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) void refresh();
  };

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name your palette before saving.");
      return;
    }
    try {
      await storage.save({ id: uid("palette"), name: trimmed, updatedAt: Date.now(), state });
      setName("");
      toast.success(`Saved “${trimmed}”`);
      await refresh();
    } catch {
      setError("Couldn't save. Your browser's storage may be full or disabled.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Save />
        <span className="hidden sm:inline">Save / open</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Saved palettes</DialogTitle>
          <DialogDescription>
            Palettes are stored in this browser ({storage.driver} storage). Your current work is also restored automatically when you return.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="save-name" className="text-sm">
              Save current palette as
            </Label>
            <Input id="save-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Brand v2" maxLength={60} />
          </div>
          <Button type="submit">Save</Button>
        </form>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="space-y-2">
          <p className="text-sm font-medium">Your palettes</p>
          {items === null ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">Nothing saved yet. Name this palette above to keep it.</p>
          ) : (
            <ul className="max-h-60 space-y-1.5 overflow-y-auto">
              {items.map((p) => (
                <li key={p.id} className="flex items-center gap-2 rounded-lg border p-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.state.hues.length} hue{p.state.hues.length === 1 ? "" : "s"} · {new Date(p.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onOpen(p.state);
                      setOpen(false);
                      toast.success(`Opened “${p.name}”`);
                    }}
                  >
                    <FolderOpen />
                    Open
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete ${p.name}`}
                    onClick={async () => {
                      await storage.remove(p.id);
                      await refresh();
                    }}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
