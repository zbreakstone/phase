"use client";

import { Crosshair, Pin, Scissors } from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { contrastFromLuminance, readableOn, relativeLuminance } from "@/lib/color/contrast";
import { SPACES, type SpaceId } from "@/lib/color/spaces";
import type { GeneratedHue, Shade } from "@/lib/palette/types";
import { cn } from "@/lib/utils";

interface Props {
  generated: GeneratedHue[];
  space: SpaceId;
  referenceHex: string;
  selectedHueId: string | null;
  onSelect: (id: string) => void;
  addColumn: React.ReactNode;
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`Copied ${text}`);
  } catch {
    toast.error("Couldn't access the clipboard. Select the hex value and copy it manually.");
  }
}

function level(ratio: number): string {
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  if (ratio >= 3) return "AA+";
  return "";
}

const f3 = (n: number) => n.toFixed(3).replace(/^0\./, ".");

export function PaletteGrid({ generated, space, referenceHex, selectedHueId, onSelect, addColumn }: Props) {
  const stepRows = generated[0]?.shades ?? [];
  const refY = relativeLuminance(referenceHex);
  const cols = `9.5rem repeat(${generated.length}, minmax(8.5rem, 1fr)) 6rem`;

  return (
    <div className="overflow-x-auto border border-border">
      <div className="grid min-w-max" style={{ gridTemplateColumns: cols }} role="grid" aria-label="Palette: hues as columns, steps as rows">
        <div className="sticky left-0 z-20 flex flex-col justify-end border-r border-b border-border bg-card p-2">
          <p className="text-[11px] font-semibold tracking-wide uppercase">Source</p>
          <p className="text-[10px] leading-tight text-muted-foreground">original above, adjusted below</p>
        </div>
        {generated.map((g) => (
          <ColumnHeader key={g.hue.id} g={g} selected={g.hue.id === selectedHueId} onSelect={() => onSelect(g.hue.id)} />
        ))}
        <div className="flex items-stretch border-b border-l border-border bg-card">{addColumn}</div>

        {stepRows.map((row, i) => {
          const targetRatio = contrastFromLuminance(refY, row.targetLuminance);
          const Ls = generated.map((g) => g.shades[i].oklch.L);
          const spread = Math.max(...Ls) - Math.min(...Ls);
          return (
            <Row
              key={row.grade}
              row={row}
              index={i}
              generated={generated}
              space={space}
              refY={refY}
              targetRatio={targetRatio}
              spread={row.anchor ? null : spread}
            />
          );
        })}

        <div className="sticky left-0 z-20 flex flex-col justify-center border-t border-r border-border bg-card p-2">
          <p className="text-[11px] font-semibold tracking-wide uppercase">OKLCH hue</p>
          <p className="text-[10px] leading-tight text-muted-foreground">lightest → darkest step</p>
        </div>
        {generated.map((g) => {
          const ramp = g.shades.filter((s) => !s.anchor);
          const a = ramp[0];
          const b = ramp[ramp.length - 1];
          const clipped = ramp.filter((s) => s.clipped).length;
          const achromatic = ramp.every((s) => s.oklch.C < 0.01);
          return (
            <div key={g.hue.id} className="border-t border-border bg-card p-2 font-mono text-[11px] leading-tight">
              {achromatic ? (
                <span className="text-muted-foreground">neutral</span>
              ) : (
                <>
                  <span>
                    {Math.round(a?.oklch.h ?? 0)}° → {Math.round(b?.oklch.h ?? 0)}°
                  </span>
                  <br />
                  <span className="text-muted-foreground">{clipped ? `${clipped} clipped` : "all in gamut"}</span>
                </>
              )}
            </div>
          );
        })}
        <div className="border-t border-l border-border bg-card" />
      </div>
      <span className="sr-only">Space: {SPACES[space].label}</span>
    </div>
  );
}

function ColumnHeader({ g, selected, onSelect }: { g: GeneratedHue; selected: boolean; onSelect: () => void }) {
  const src = g.source;
  const ramp = g.shades.filter((s) => !s.anchor);
  const mid = ramp[Math.floor(ramp.length / 2)];
  return (
    <div className="flex flex-col border-b border-border">
      {src ? (
        <div className="flex h-24 flex-col">
          <div className="flex flex-1 items-start justify-between p-1.5" style={{ backgroundColor: src.original.hex, color: readableOn(src.original.hex) }}>
            <span className="font-mono text-[10px] leading-none">{src.original.hex}</span>
            <span className="text-[9px] leading-none uppercase opacity-80">original</span>
          </div>
          <div className="flex flex-1 items-start justify-between p-1.5" style={{ backgroundColor: src.pinned ? src.original.hex : src.adjusted.hex, color: readableOn(src.pinned ? src.original.hex : src.adjusted.hex) }}>
            <span className="font-mono text-[10px] leading-none">{src.pinned ? src.original.hex : src.adjusted.hex}</span>
            <span className="flex items-center gap-0.5 text-[9px] leading-none uppercase opacity-90">
              {src.pinned ? <Pin className="size-2.5" /> : <Crosshair className="size-2.5" />}
              {src.pinned ? "pinned" : "adjusted"} · {src.grade}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex h-24 items-end bg-muted/30 p-1.5 text-[10px] text-muted-foreground" style={{ backgroundImage: mid ? `linear-gradient(to bottom, transparent 55%, ${mid.hex}33)` : undefined }}>
          No source colour. Curve set by its two ends.
        </div>
      )}
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={cn(
          "h-9 truncate px-2 text-left text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset",
          selected ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
        )}
      >
        {g.hue.name || "Unnamed"}
      </button>
    </div>
  );
}

function Row({
  row,
  index,
  generated,
  space,
  refY,
  targetRatio,
  spread,
}: {
  row: Shade;
  index: number;
  generated: GeneratedHue[];
  space: SpaceId;
  refY: number;
  targetRatio: number;
  spread: number | null;
}) {
  const quality = spread === null ? null : spread <= 0.02 ? "even" : spread <= 0.05 ? "close" : "uneven";
  return (
    <>
      <div className="sticky left-0 z-10 flex items-center justify-between gap-2 border-r border-border bg-card px-2">
        <div className="leading-tight">
          <p className="font-mono text-sm font-semibold tabular-nums">{row.grade}</p>
          <p className="font-mono text-[10px] text-muted-foreground">
            Y {row.targetLuminance.toFixed(3)} · {targetRatio.toFixed(2)}:1
          </p>
        </div>
        {spread !== null ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <div
                  tabIndex={0}
                  className="flex w-12 flex-col items-end gap-0.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  aria-label={`OKLCH lightness spread across hues at step ${row.grade}: ${spread.toFixed(3)}, ${quality}`}
                />
              }
            >
              <span className="font-mono text-[9px] text-muted-foreground">ΔL {f3(spread)}</span>
              <span className="h-1 w-full bg-muted">
                <span
                  className={cn("block h-full", quality === "even" ? "bg-emerald-400" : quality === "close" ? "bg-amber-400" : "bg-red-400")}
                  style={{ width: `${Math.min(100, (spread / 0.06) * 100)}%` }}
                />
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-56 text-xs">
                OKLCH lightness differs by {spread.toFixed(3)} between the lightest and darkest-looking hue at this step ({quality}). Luminance is held exact, so contrast is guaranteed; this shows how evenly the hues also read perceptually.
              </p>
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      {generated.map((g) => (
        <Cell key={g.hue.id} shade={g.shades[index]} hueName={g.hue.name} space={space} refY={refY} />
      ))}
      <div className="border-l border-border bg-card/40" />
    </>
  );
}

function Cell({ shade, hueName, space, refY }: { shade: Shade; hueName: string; space: SpaceId; refY: number }) {
  const fg = readableOn(shade.hex);
  const ratio = contrastFromLuminance(refY, shade.luminance);
  const chroma = SPACES[space].chroma;
  const o = shade.oklch;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={() => copy(shade.hex)}
            aria-label={`${hueName} ${shade.grade}, ${shade.hex}, ${ratio.toFixed(2)} to 1 against the reference. Click to copy.`}
            className="relative flex h-[4.5rem] flex-col justify-between p-1.5 text-left focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
            style={{ backgroundColor: shade.hex, color: fg }}
          />
        }
      >
        <span className="font-mono text-[11px] leading-none font-semibold">{shade.hex}</span>
        <span className="font-mono text-[11px] leading-none">
          {ratio.toFixed(2)}
          <span className="ml-1 text-[9px] opacity-80">{level(ratio)}</span>
        </span>
        <span className="font-mono text-[9px] leading-none opacity-75">
          {o.L.toFixed(3)} {o.C.toFixed(3)} {Math.round(o.h)}
        </span>
        <span className="absolute top-1 right-1 flex items-center gap-0.5">
          {shade.clipped ? <Scissors className="size-3" aria-label="Chroma reduced to fit sRGB" /> : null}
          {shade.pinned ? <Pin className="size-3" aria-label="Pinned source colour" /> : shade.isSource ? <Crosshair className="size-3" aria-label="Source colour landed here" /> : null}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <div className="space-y-0.5 text-xs">
          <p className="font-semibold">
            {hueName} {shade.grade} <span className="font-mono font-normal">{shade.hex}</span>
          </p>
          <p>
            OKLCH L {o.L.toFixed(3)} · C {o.C.toFixed(3)} · h {Math.round(o.h)}°
          </p>
          <p>
            Luminance {shade.luminance.toFixed(4)} (target {shade.targetLuminance.toFixed(4)})
          </p>
          {shade.anchor ? (
            <p>Fixed anchor</p>
          ) : (
            <p>
              {SPACES[space].short} chroma {shade.chroma.toFixed(chroma.decimals)}
              {shade.clipped ? ` (wanted ${shade.requestedChroma.toFixed(chroma.decimals)}, reduced to fit sRGB)` : ""}
            </p>
          )}
          {shade.isSource ? <p>{shade.pinned ? "Pinned source colour." : "Source colour, adjusted to this step."}</p> : null}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
