"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { parseHex } from "@/lib/color/convert";
import { HUE_PRESETS, type HuePreset } from "@/lib/palette/defaults";

interface Props {
  onAddPreset: (preset: HuePreset) => void;
  onAddHex: (hex: string) => void;
  /** The element that opens the popover, e.g. `<button />`; its content is `children`. */
  render: React.ReactElement;
  children: React.ReactNode;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
}

/** Adds a color from a hex or a preset. Opens from wherever the color will land, so the choice stays next to the result. */
export function AddColorPopover({ onAddPreset, onAddHex, render, children, align = "start", side = "bottom" }: Props) {
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState("");
  const hexId = React.useId();
  const parsed = parseHex(text);

  const submit = () => {
    if (!parsed) return;
    onAddHex(parsed);
    setText("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={render}>{children}</PopoverTrigger>
      <PopoverContent align={align} side={side} className="w-72 space-y-3 rounded-none">
        <form
          className="space-y-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label htmlFor={hexId} className="text-xs font-medium">
            From a hex color
          </label>
          <div className="flex gap-2">
            <Input id={hexId} placeholder="#3b82f6" value={text} onChange={(e) => setText(e.target.value)} aria-invalid={text && !parsed ? true : undefined} className="h-8 font-mono text-xs md:text-xs" />
            <Button type="submit" size="sm" className="rounded-none" disabled={!parsed}>
              Add
            </Button>
          </div>
          {text && !parsed ? <p className="text-[11px] text-destructive">Use a hex color such as #3b82f6.</p> : null}
        </form>
        <div className="space-y-1.5">
          <p className="text-xs font-medium">Or a preset</p>
          <div className="grid grid-cols-3 gap-px bg-border">
            {HUE_PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => {
                  onAddPreset(p);
                  setOpen(false);
                }}
                className="flex items-center gap-1.5 bg-popover p-1.5 text-left text-xs hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span className="size-3 shrink-0" style={{ backgroundColor: p.swatch }} />
                {p.name}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
