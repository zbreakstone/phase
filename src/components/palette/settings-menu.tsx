"use client";

import * as React from "react";
import { RotateCcw, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GAMUTS, GAMUT_ORDER, type Gamut } from "@/lib/color/gamut";
import { SPACES, SPACE_ORDER, type SpaceId } from "@/lib/color/spaces";
import type { ScaleConfig } from "@/lib/palette/types";
import { RulesSettings } from "./scale-settings";

interface Props {
  space: SpaceId;
  gamut: Gamut;
  scale: ScaleConfig;
  onSpace: (space: SpaceId) => void;
  onGamut: (gamut: Gamut) => void;
  onScale: (scale: ScaleConfig) => void;
  /** Replaces everything with the starter palette. Recorded in the undo history. */
  onReset: () => void;
}

/** The settings you pick once per project: how colors are computed, which screens they target, and the contrast rules. */
export function SettingsMenu({ space, gamut, scale, onSpace, onGamut, onScale, onReset }: Props) {
  const [open, setOpen] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);

  return (
    <>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Settings" title="Settings" />}>
        <Settings />
      </PopoverTrigger>
      <PopoverContent align="end" className="max-h-[calc(100dvh-5rem)] w-[26rem] gap-5 overflow-y-auto p-4">
        <section className="space-y-1.5">
          <Label htmlFor="settings-space" className="text-xs font-semibold tracking-wide uppercase">
            Color space
          </Label>
          <Select items={SPACE_ORDER.map((id) => ({ value: id, label: SPACES[id].label }))} value={space} onValueChange={(v) => onSpace(v as SpaceId)}>
            <SelectTrigger id="settings-space" size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SPACE_ORDER.map((id) => (
                <SelectItem key={id} value={id}>
                  {SPACES[id].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">{SPACES[space].description}</p>
        </section>

        <section className="space-y-1.5">
          <Label htmlFor="settings-gamut" className="text-xs font-semibold tracking-wide uppercase">
            Gamut
          </Label>
          <Select items={GAMUT_ORDER.map((id) => ({ value: id, label: GAMUTS[id].label }))} value={gamut} onValueChange={(v) => onGamut(v as Gamut)}>
            <SelectTrigger id="settings-gamut" size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GAMUT_ORDER.map((id) => (
                <SelectItem key={id} value={id}>
                  {GAMUTS[id].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">{GAMUTS[gamut].description}</p>
        </section>

        <section className="space-y-3 border-t border-border pt-4">
          <h3 className="text-xs font-semibold tracking-wide uppercase">Contrast rules</h3>
          <RulesSettings scale={scale} onChange={onScale} />
        </section>

        <section className="space-y-2 border-t border-border pt-4">
          <h3 className="text-xs font-semibold tracking-wide text-destructive uppercase">Danger zone</h3>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-muted-foreground">Replace your colors, steps and rules with the starter palette.</p>
            <Button
              variant="destructive"
              size="sm"
              className="shrink-0"
              onClick={() => {
                setOpen(false);
                setConfirming(true);
              }}
            >
              <RotateCcw />
              Reset palette
            </Button>
          </div>
        </section>
      </PopoverContent>
    </Popover>
    <Dialog open={confirming} onOpenChange={setConfirming}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Reset to the starter palette?</DialogTitle>
          <DialogDescription>
            This replaces your current colors, steps, tweaks and contrast rules. Your saved palettes aren&apos;t touched, and you can undo it right after with ⌘Z.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              setConfirming(false);
              onReset();
            }}
          >
            Reset palette
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
