"use client";

import { Check, Crosshair, Pin, Scissors, X } from "lucide-react";
import { contrastFromLuminance, readableOn } from "@/lib/color/contrast";
import { requiredRatio } from "@/lib/palette/scale";
import type { ContrastRule, GeneratedHue, Shade } from "@/lib/palette/types";
import { cn } from "@/lib/utils";

export type Metric = "contrast" | "lightness" | "off";
export type Against = "white" | "black" | "selected";

export interface Overlay {
  metric: Metric;
  against: Against;
}

interface Props {
  generated: GeneratedHue[];
  rules: ContrastRule[];
  overlay: Overlay;
  selectedHueId: string | null;
  selectedGrade: number | null;
  onSelect: (hueId: string, grade: number | null) => void;
}

const fmtRatio = (r: number) => (r >= 10 ? r.toFixed(1) : r.toFixed(2));

export function PaletteGrid({ generated, rules, overlay, selectedHueId, selectedGrade, onSelect }: Props) {
  const steps = generated[0]?.shades ?? [];
  const selectedHue = generated.find((g) => g.hue.id === selectedHueId);
  const anchorShade = selectedHue?.shades.find((s) => s.grade === selectedGrade) ?? null;
  const cols = `7rem repeat(${steps.length}, minmax(3.25rem, 1fr))`;

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[44rem]" style={{ gridTemplateColumns: cols }} role="grid" aria-label="Palette: hues as rows, steps as columns">
        <div />
        {steps.map((s) => (
          <div key={s.grade} className="pb-1.5 text-center font-mono text-[11px] text-muted-foreground tabular-nums">
            {s.grade}
          </div>
        ))}

        {generated.map((g) => {
          const rowSelected = g.hue.id === selectedHueId;
          return (
            <Row
              key={g.hue.id}
              g={g}
              rules={rules}
              overlay={overlay}
              rowSelected={rowSelected}
              selectedGrade={rowSelected ? selectedGrade : null}
              reference={anchorShade}
              onSelect={onSelect}
            />
          );
        })}

        {overlay.metric === "lightness" ? (
          <>
            <div className="pt-2 text-[11px] text-muted-foreground">Spread across hues</div>
            {steps.map((s, i) => {
              if (s.anchor) return <div key={s.grade} />;
              const Ls = generated.map((g) => g.shades[i].oklch.L);
              const spread = Math.max(...Ls) - Math.min(...Ls);
              return (
                <div
                  key={s.grade}
                  className={cn(
                    "pt-2 text-center font-mono text-[11px] tabular-nums",
                    spread <= 0.02 ? "text-emerald-400" : spread <= 0.05 ? "text-amber-400" : "text-red-400",
                  )}
                >
                  {spread.toFixed(2)}
                </div>
              );
            })}
          </>
        ) : null}
      </div>
    </div>
  );
}

function Row({
  g,
  rules,
  overlay,
  rowSelected,
  selectedGrade,
  reference,
  onSelect,
}: {
  g: GeneratedHue;
  rules: ContrastRule[];
  overlay: Overlay;
  rowSelected: boolean;
  selectedGrade: number | null;
  reference: Shade | null;
  onSelect: (hueId: string, grade: number | null) => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={() => onSelect(g.hue.id, selectedGrade)}
        aria-pressed={rowSelected}
        className={cn(
          "sticky left-0 z-10 flex h-11 items-center truncate bg-background pr-2 text-left text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          rowSelected ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <span className="truncate">{g.hue.name || "Unnamed"}</span>
      </button>
      {g.shades.map((s) => (
        <Cell
          key={s.grade}
          g={g}
          shade={s}
          rules={rules}
          overlay={overlay}
          selected={rowSelected && selectedGrade === s.grade}
          reference={reference}
          onSelect={() => onSelect(g.hue.id, s.grade)}
        />
      ))}
    </>
  );
}

function Cell({
  g,
  shade,
  rules,
  overlay,
  selected,
  reference,
  onSelect,
}: {
  g: GeneratedHue;
  shade: Shade;
  rules: ContrastRule[];
  overlay: Overlay;
  selected: boolean;
  reference: Shade | null;
  onSelect: () => void;
}) {
  const fg = readableOn(shade.hex);
  let label = "";
  let status: "pass" | "fail" | "none" | "self" | null = null;

  if (overlay.metric === "lightness") label = shade.oklch.L.toFixed(2);
  else if (overlay.metric === "contrast" && overlay.against === "white") label = fmtRatio(contrastFromLuminance(1, shade.luminance));
  else if (overlay.metric === "contrast" && overlay.against === "black") label = fmtRatio(contrastFromLuminance(0, shade.luminance));
  else if (overlay.metric === "contrast" && reference) {
    if (reference === shade) {
      status = "self";
      label = "";
    } else {
      const ratio = contrastFromLuminance(reference.luminance, shade.luminance);
      const required = requiredRatio(Math.abs(reference.grade - shade.grade), rules);
      status = required === null ? "none" : ratio + 1e-9 >= required ? "pass" : "fail";
      label = fmtRatio(ratio);
    }
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`${g.hue.name} ${shade.grade}, ${shade.hex}${label ? `, ${label}` : ""}`}
      title={`${g.hue.name} ${shade.grade} · ${shade.hex}\nOKLCH ${shade.oklch.L.toFixed(3)} ${shade.oklch.C.toFixed(3)} ${Math.round(shade.oklch.h)}°`}
      className={cn(
        "relative flex h-11 items-center justify-center font-mono text-[11px] tabular-nums focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset",
        status === "none" && "opacity-40",
      )}
      style={{ backgroundColor: shade.hex, color: fg }}
    >
      {status === "pass" ? <Check className="mr-0.5 size-3" aria-label="Meets its rule" /> : null}
      {status === "fail" ? <X className="mr-0.5 size-3" aria-label="Breaks its rule" /> : null}
      {label}
      {status === "fail" ? <span aria-hidden className="pointer-events-none absolute inset-0 border-2 border-red-500" /> : null}
      {selected ? <span aria-hidden className="pointer-events-none absolute inset-0 z-10 border-2 border-white mix-blend-difference" /> : null}
      {shade.isSource || shade.clipped ? (
        <span className="pointer-events-none absolute top-0.5 right-0.5 flex gap-0.5 opacity-80">
          {shade.pinned ? <Pin className="size-2.5" aria-label="Pinned source colour" /> : shade.isSource ? <Crosshair className="size-2.5" aria-label="Source colour landed here" /> : null}
          {shade.clipped ? <Scissors className="size-2.5" aria-label="Chroma reduced to fit sRGB" /> : null}
        </span>
      ) : null}
    </button>
  );
}
