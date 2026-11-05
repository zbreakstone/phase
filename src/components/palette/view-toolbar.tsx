"use client";

import * as React from "react";
import { Contrast, Eye, EyeOff, Moon, Sun, SunMoon, SwatchBook, Wheat } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toggle, toggleVariants } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { VISIONS, type VisionId } from "@/lib/color/vision";
import type { Overlay } from "@/lib/palette/overlay";
import { Crumbs, type Crumb } from "./crumbs";
import type { SquareMode } from "./palette-square";
import { Hint } from "./hint";
import { isPopupOpen, isTextEntry } from "./text-entry";
import { useTheme } from "./use-theme";
import type { Theme } from "@/lib/theme";

const THEMES: { id: Theme; label: string }[] = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

type Lens = "luminance" | Exclude<VisionId, "normal">;

/** What the preview can show: equal-luminance grays first, then each color vision type. */
const LENSES: { id: Lens; label: string; note?: string }[] = [
  {
    id: "luminance",
    label: "Luminance",
    note: "Each swatch as the gray with the same luminance, to check steps line up across hues",
  },
  ...VISIONS.filter((v) => v.id !== "normal").map((v) => ({
    id: v.id as Lens,
    label: v.label,
    note: v.note,
  })),
];

/** Quick ways to look at the square differently: as equal-luminance grays, or as someone with color blindness would. */
export function ViewToolbar({
  overlay,
  onOverlay,
  crumbs,
  mode,
  onMode,
  grain,
  onGrain,
}: {
  overlay: Overlay;
  onOverlay: (o: Overlay) => void;
  crumbs: Crumb[];
  mode: SquareMode;
  onMode: (m: SquareMode) => void;
  grain: boolean;
  onGrain: (on: boolean) => void;
}) {
  const [theme, pickTheme] = useTheme();
  // One switch turns the preview on and off; the dropdown picks the lens. The last lens is remembered while
  // the switch is off.
  const [last, setLast] = React.useState<Lens>("luminance");
  const [lensOpen, setLensOpen] = React.useState(false);
  const [themeOpen, setThemeOpen] = React.useState(false);
  const active = overlay.grayscale || overlay.vision !== "normal";
  const lens: Lens = overlay.grayscale
    ? "luminance"
    : overlay.vision !== "normal"
      ? overlay.vision
      : last;
  const apply = (next: Lens | null) =>
    onOverlay({
      ...overlay,
      grayscale: next === "luminance",
      vision: next && next !== "luminance" ? next : "normal",
    });

  // / turns the preview on and off, M opens the lens menu, T the theme menu, G toggles grain, [ and ] pick smooth or cells. Typing in a field or having a dialog open takes priority.
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.defaultPrevented ||
        e.isComposing ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      )
        return;
      if (
        e.key !== "/" &&
        e.key !== "[" &&
        e.key !== "]" &&
        e.key.toLowerCase() !== "m" &&
        e.key.toLowerCase() !== "t" &&
        e.key.toLowerCase() !== "g"
      )
        return;
      if (isTextEntry(e.target)) return;
      if (
        isPopupOpen(
          '[data-slot="dialog-content"], [data-slot="select-content"], [role="menu"]',
        )
      )
        return;
      e.preventDefault();
      if (e.key === "/") apply(active ? null : lens);
      else if (e.key.toLowerCase() === "m") setLensOpen(true);
      else if (e.key.toLowerCase() === "t") setThemeOpen(true);
      else if (e.key.toLowerCase() === "g") {
        if (mode === "smooth") onGrain(!grain);
      } else onMode(e.key === "[" ? "smooth" : "cells");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-4 px-2">
      <div className="min-w-0">
        <Crumbs items={crumbs} />
      </div>
      <div className="flex items-center gap-2">
        <Select
          items={LENSES.map((l) => ({ value: l.id, label: l.label }))}
          value={lens}
          open={lensOpen}
          onOpenChange={setLensOpen}
          onValueChange={(v) => {
            if (!v) return;
            setLast(v as Lens);
            apply(v as Lens);
          }}
        >
          <Hint label="Change preview mode" shortcut={["M"]}>
            <SelectTrigger
              size="sm"
              className="w-40"
              aria-label="Change preview mode"
            >
              <SelectValue />
            </SelectTrigger>
          </Hint>
          <SelectContent
            alignItemWithTrigger={false}
            align="start"
            className="max-h-72 w-80"
          >
            {LENSES.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                <span className="flex flex-col">
                  <span>{l.label}</span>
                  {l.note ? (
                    <span className="text-[11px] whitespace-normal text-muted-foreground">
                      {l.note}
                    </span>
                  ) : null}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Hint label="Toggle preview mode" shortcut={["/"]}>
          <Toggle
            variant="outline"
            size="sm"
            pressed={active}
            onPressedChange={(on) => apply(on ? lens : null)}
            aria-label="Toggle preview mode"
          >
            {active ? <Eye /> : <EyeOff />}
          </Toggle>
        </Hint>
      </div>
      <div className="flex items-center justify-end gap-2">
        <DropdownMenu open={themeOpen} onOpenChange={setThemeOpen}>
          <Hint label="Change theme" shortcut={["T"]}>
            <DropdownMenuTrigger aria-label="Change theme" className={toggleVariants({ variant: "outline", size: "sm" })}>
              {theme === "light" ? <Sun /> : theme === "dark" ? <Moon /> : <SunMoon />}
            </DropdownMenuTrigger>
          </Hint>
          <DropdownMenuContent align="end" className="min-w-36">
            <DropdownMenuRadioGroup value={theme} onValueChange={(v) => pickTheme(v as Theme)}>
              {THEMES.map((t) => (
                <DropdownMenuRadioItem key={t.id} value={t.id}>
                  {t.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <Hint label={mode === "smooth" ? "Toggle grain" : "Grain only applies to the smooth view"} shortcut={mode === "smooth" ? ["G"] : undefined}>
          <Toggle variant="outline" size="sm" pressed={grain && mode === "smooth"} disabled={mode !== "smooth"} onPressedChange={onGrain} aria-label="Toggle grain">
            <Wheat />
          </Toggle>
        </Hint>
        <ToggleGroup
          value={[mode]}
          onValueChange={(v) => v[0] && onMode(v[0] as SquareMode)}
          variant="outline"
          size="sm"
          spacing={0}
          aria-label="How the square is drawn"
        >
          <Hint label="Show gradient" shortcut={["["]}>
            <ToggleGroupItem value="smooth" aria-label="Show gradient">
              <Contrast />
            </ToggleGroupItem>
          </Hint>
          <Hint label="Show swatches" shortcut={["]"]}>
            <ToggleGroupItem value="cells" aria-label="Show swatches">
              <SwatchBook />
            </ToggleGroupItem>
          </Hint>
        </ToggleGroup>
      </div>
    </div>
  );
}
