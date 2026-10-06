"use client";

import { Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HUE_PRESETS, type HuePreset } from "@/lib/palette/defaults";

interface Props {
  onAdd: (preset: HuePreset) => void;
  onAddBlank: () => void;
  variant?: "column" | "button";
}

export function AddHueMenu({ onAdd, onAddBlank, variant = "button" }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          variant === "column" ? (
            <button
              type="button"
              className="flex w-full flex-col items-center justify-center gap-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
            />
          ) : (
            <Button variant="secondary" size="sm" className="rounded-none" />
          )
        }
      >
        <Plus className={variant === "column" ? "size-5" : undefined} />
        Add hue
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Start from a preset</DropdownMenuLabel>
          {HUE_PRESETS.map((p) => (
            <DropdownMenuItem key={p.key} onClick={() => onAdd(p)}>
              <span className="size-3 shrink-0" style={{ backgroundColor: p.swatch }} />
              {p.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onAddBlank}>
          <Sparkles />
          Blank hue
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
