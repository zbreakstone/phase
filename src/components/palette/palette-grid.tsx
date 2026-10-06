"use client";

import * as React from "react";
import { Check, Crosshair, GripVertical, Pin, X } from "lucide-react";
import { contrastFromLuminance, readableOn } from "@/lib/color/contrast";
import { luminanceGray, simulateVision, type VisionId } from "@/lib/color/vision";
import { requiredRatio } from "@/lib/palette/scale";
import type { ContrastRule, GeneratedHue, Shade } from "@/lib/palette/types";
import { cn } from "@/lib/utils";

export type Metric = "contrast" | "luminance" | "off";
export type Against = "white" | "black" | "selected";

export interface Overlay {
  metric: Metric;
  against: Against;
  /** Paint each swatch as the grey of equal luminance. */
  grayscale: boolean;
  vision: VisionId;
}

export function displayHex(hex: string, overlay: Overlay): string {
  return overlay.grayscale ? luminanceGray(hex) : simulateVision(hex, overlay.vision);
}

const fmtLuminance = (y: number) => `${(y * 100).toFixed(y < 0.1 ? 2 : 1)}%`;

interface Props {
  generated: GeneratedHue[];
  rules: ContrastRule[];
  overlay: Overlay;
  selectedHueId: string | null;
  selectedGrade: number | null;
  onSelect: (hueId: string, grade: number | null) => void;
  /** Move a hue so it ends up at `toIndex` in the list. */
  onReorder: (hueId: string, toIndex: number) => void;
}

const fmtRatio = (r: number) => (r >= 10 ? r.toFixed(1) : r.toFixed(2));

type DropSide = "before" | "after";

/** Handlers spread on every element of a row so the whole row is a drop target. */
interface RowDrop {
  onDragOver: (e: React.DragEvent<HTMLElement>) => void;
  onDrop: (e: React.DragEvent<HTMLElement>) => void;
}

export function PaletteGrid({ generated, rules, overlay, selectedHueId, selectedGrade, onSelect, onReorder }: Props) {
  const steps = generated[0]?.shades ?? [];
  const selectedHue = generated.find((g) => g.hue.id === selectedHueId);
  const anchorShade = selectedHue?.shades.find((s) => s.grade === selectedGrade) ?? null;
  const cols = `7rem repeat(${steps.length}, minmax(3.25rem, 1fr))`;
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [target, setTarget] = React.useState<{ id: string; side: DropSide } | null>(null);

  const endDrag = () => {
    setDragId(null);
    setTarget(null);
  };

  const dropFor = (hueId: string, index: number): RowDrop => ({
    onDragOver: (e) => {
      if (!dragId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const rect = e.currentTarget.getBoundingClientRect();
      const side: DropSide = e.clientY < rect.top + rect.height / 2 ? "before" : "after";
      if (target?.id !== hueId || target.side !== side) setTarget({ id: hueId, side });
    },
    onDrop: (e) => {
      if (!dragId) return;
      e.preventDefault();
      const from = generated.findIndex((g) => g.hue.id === dragId);
      let to = target?.side === "after" ? index + 1 : index;
      if (from < to) to -= 1;
      if (from !== to) onReorder(dragId, to);
      endDrag();
    },
  });

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[44rem]" style={{ gridTemplateColumns: cols }} role="grid" aria-label="Palette: hues as rows, steps as columns">
        <div />
        {steps.map((s) => (
          <div key={s.grade} className="pb-1.5 text-center font-mono text-[11px] text-muted-foreground tabular-nums">
            {s.grade}
          </div>
        ))}

        {generated.map((g, i) => {
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
              drop={dropFor(g.hue.id, i)}
              dragging={dragId === g.hue.id}
              dropSide={dragId && dragId !== g.hue.id && target?.id === g.hue.id ? target.side : null}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", g.hue.name);
                setDragId(g.hue.id);
              }}
              onDragEnd={endDrag}
              onMove={(delta) => {
                const to = i + delta;
                if (to >= 0 && to < generated.length) onReorder(g.hue.id, to);
              }}
            />
          );
        })}

        {overlay.grayscale ? (
          <>
            <div className="pt-2 text-[11px] text-muted-foreground" title="Difference in OKLCH lightness between the lightest and darkest hue at each step">
              Lightness spread
            </div>
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
  drop,
  dragging,
  dropSide,
  onDragStart,
  onDragEnd,
  onMove,
}: {
  g: GeneratedHue;
  rules: ContrastRule[];
  overlay: Overlay;
  rowSelected: boolean;
  selectedGrade: number | null;
  reference: Shade | null;
  onSelect: (hueId: string, grade: number | null) => void;
  drop: RowDrop;
  dragging: boolean;
  dropSide: DropSide | null;
  onDragStart: (e: React.DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  onMove: (delta: number) => void;
}) {
  const indicator = dropSide ? (
    <span aria-hidden className={cn("pointer-events-none absolute inset-x-0 z-20 h-0.5 bg-primary", dropSide === "before" ? "-top-px" : "-bottom-px")} />
  ) : null;

  return (
    <>
      <div
        {...drop}
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        className={cn("group/row sticky left-0 z-10 flex h-11 cursor-grab items-center bg-background active:cursor-grabbing", dragging && "opacity-40")}
      >
        <button
          type="button"
          aria-label={`Reorder ${g.hue.name}. Drag, or press Alt and an arrow key.`}
          title="Drag to reorder (or Alt + ↑ / ↓)"
          onKeyDown={(e) => {
            if (!e.altKey) return;
            if (e.key === "ArrowUp") {
              e.preventDefault();
              onMove(-1);
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              onMove(1);
            }
          }}
          className="flex h-full w-5 shrink-0 items-center justify-center text-muted-foreground/0 group-hover/row:text-muted-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <GripVertical className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onSelect(g.hue.id, selectedGrade)}
          aria-pressed={rowSelected}
          className={cn(
            "flex h-full min-w-0 flex-1 items-center pr-2 text-left text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            rowSelected ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <span className="truncate">{g.hue.name || "Unnamed"}</span>
        </button>
        {indicator}
      </div>
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
          drop={drop}
          dimmed={dragging}
          indicator={indicator}
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
  drop,
  dimmed,
  indicator,
}: {
  g: GeneratedHue;
  shade: Shade;
  rules: ContrastRule[];
  overlay: Overlay;
  selected: boolean;
  reference: Shade | null;
  onSelect: () => void;
  drop: RowDrop;
  dimmed: boolean;
  indicator: React.ReactNode;
}) {
  const shown = displayHex(shade.hex, overlay);
  const fg = readableOn(shown);
  let label = "";
  let status: "pass" | "fail" | "none" | "self" | null = null;

  if (overlay.metric === "luminance") label = fmtLuminance(shade.luminance);
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
      {...drop}
      type="button"
      onClick={onSelect}
      aria-label={`${g.hue.name} ${shade.grade}, ${shade.hex}${label ? `, ${label}` : ""}`}
      title={`${g.hue.name} ${shade.grade} · ${shade.hex}\nOKLCH ${shade.oklch.L.toFixed(3)} ${shade.oklch.C.toFixed(3)} ${Math.round(shade.oklch.h)}°`}
      className={cn(
        "relative flex h-11 items-center justify-center font-mono text-[11px] tabular-nums focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset",
        (status === "none" || dimmed) && "opacity-40",
      )}
      style={{ backgroundColor: shown, color: fg }}
    >
      {status === "pass" ? <Check className="mr-0.5 size-3" aria-label="Meets its rule" /> : null}
      {status === "fail" ? <X className="mr-0.5 size-3" aria-label="Breaks its rule" /> : null}
      {label}
      {status === "fail" ? <span aria-hidden className="pointer-events-none absolute inset-0 border-2 border-red-500" /> : null}
      {selected ? <span aria-hidden className="pointer-events-none absolute inset-0 z-10 border-2 border-white mix-blend-difference" /> : null}
      {shade.isSource ? (
        <span className="pointer-events-none absolute top-0.5 right-0.5 opacity-80">
          {shade.pinned ? <Pin className="size-2.5" aria-label="Pinned source colour" /> : <Crosshair className="size-2.5" aria-label="Source colour landed here" />}
        </span>
      ) : null}
      {indicator}
    </button>
  );
}
