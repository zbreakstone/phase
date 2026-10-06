"use client";

import { Check, Scissors } from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { readableOn } from "@/lib/color/contrast";
import { SPACES, type SpaceId } from "@/lib/color/spaces";
import type { GeneratedHue, Shade } from "@/lib/palette/types";
import { cn } from "@/lib/utils";

interface Props {
  generated: GeneratedHue[];
  space: SpaceId;
  selectedHueId: string | null;
  onSelect: (id: string) => void;
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`Copied ${text}`);
  } catch {
    toast.error("Couldn't access the clipboard. Select the hex value and copy it manually.");
  }
}

export function SwatchGrid({ generated, space, selectedHueId, onSelect }: Props) {
  const grades = generated[0]?.shades ?? [];
  const chroma = SPACES[space].chroma;

  return (
    <div className="overflow-x-auto pb-1">
      <div className="min-w-[640px] space-y-1.5">
        <div className="grid items-end gap-1.5" style={{ gridTemplateColumns: `5.5rem repeat(${grades.length}, minmax(0, 1fr))` }}>
          <div />
          {grades.map((s) => (
            <div key={s.grade} className="text-center font-mono text-xs tabular-nums text-muted-foreground">
              {s.grade}
            </div>
          ))}
        </div>
        {generated.map((g) => {
          const selected = g.hue.id === selectedHueId;
          return (
            <div
              key={g.hue.id}
              className="grid items-stretch gap-1.5"
              style={{ gridTemplateColumns: `5.5rem repeat(${g.shades.length}, minmax(0, 1fr))` }}
            >
              <button
                type="button"
                onClick={() => onSelect(g.hue.id)}
                aria-pressed={selected}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2 text-left text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  selected ? "bg-foreground text-background" : "hover:bg-muted",
                )}
              >
                {selected ? <Check className="size-3.5 shrink-0" /> : null}
                <span className="truncate">{g.hue.name}</span>
              </button>
              {g.shades.map((s) => (
                <SwatchCell key={s.grade} shade={s} chromaDecimals={chroma.decimals} hueName={g.hue.name} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SwatchCell({ shade, hueName, chromaDecimals }: { shade: Shade; hueName: string; chromaDecimals: number }) {
  const fg = readableOn(shade.hex);
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={() => copy(shade.hex)}
            aria-label={`${hueName} ${shade.grade}, ${shade.hex}. Click to copy.`}
            className="group relative flex h-14 items-end justify-center rounded-md ring-1 ring-black/10 transition-transform hover:z-10 hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:h-16"
            style={{ backgroundColor: shade.hex, color: fg }}
          />
        }
      >
        <span className="pb-1 font-mono text-[10px] leading-none opacity-80 group-hover:opacity-100">
          {shade.hex.slice(1)}
        </span>
        {shade.clipped ? (
          <span
            className="absolute top-1 right-1 rounded-full p-0.5"
            style={{ backgroundColor: fg === "#000000" ? "#00000026" : "#ffffff33" }}
          >
            <Scissors className="size-3" aria-label="Chroma reduced to fit sRGB" />
          </span>
        ) : null}
      </TooltipTrigger>
      <TooltipContent>
        <div className="space-y-0.5 text-xs">
          <p className="font-semibold">
            {hueName} {shade.grade} <span className="font-mono font-normal">{shade.hex}</span>
          </p>
          <p>Luminance {shade.luminance.toFixed(3)}</p>
          {shade.anchor ? (
            <p>Fixed anchor</p>
          ) : (
            <p>
              Chroma {shade.chroma.toFixed(chromaDecimals)}
              {shade.clipped ? ` (wanted ${shade.requestedChroma.toFixed(chromaDecimals)}, clipped to fit sRGB)` : ""}
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
