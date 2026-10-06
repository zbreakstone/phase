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

/** Relative luminance on the 0–1 scale used by the USWDS and Envoy tables. */
const fmtLuminance = (y: number) => y.toFixed(3);

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

/** Pointer handlers for a row's name cell, which is the drag handle. */
interface DragHandle {
  ref: (el: HTMLElement | null) => void;
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
  onClickCapture: (e: React.MouseEvent<HTMLElement>) => void;
}

/** Movement (px) before a press on a row name becomes a drag rather than a click. */
const DRAG_THRESHOLD = 4;

export function PaletteGrid({ generated, rules, overlay, selectedHueId, selectedGrade, onSelect, onReorder }: Props) {
  const steps = generated[0]?.shades ?? [];
  const selectedHue = generated.find((g) => g.hue.id === selectedHueId);
  const anchorShade = selectedHue?.shades.find((s) => s.grade === selectedGrade) ?? null;
  const cols = `7rem repeat(${steps.length}, minmax(3.25rem, 1fr))`;

  const handles = React.useRef(new Map<string, HTMLElement>());
  const suppressClick = React.useRef(false);
  const order = React.useRef<string[]>([]);
  const reorder = React.useRef(onReorder);
  React.useEffect(() => {
    order.current = generated.map((g) => g.hue.id);
    reorder.current = onReorder;
  });
  /** Row being dragged and the index it would be inserted before (0..n, in the current order). */
  const [drag, setDrag] = React.useState<{ id: string; insert: number } | null>(null);

  const insertionAt = (clientY: number) => {
    const ids = order.current;
    for (let i = 0; i < ids.length; i++) {
      const rect = handles.current.get(ids[i])?.getBoundingClientRect();
      if (rect && clientY < rect.top + rect.height / 2) return i;
    }
    return ids.length;
  };

  /**
   * Follows the pointer on window from the moment of the press, so fast moves
   * that leave the row and releases anywhere on the page are still seen.
   */
  const startPress = (hueId: string, startY: number) => {
    let active = false;
    let insert = -1;
    const move = (ev: PointerEvent) => {
      if (!active) {
        if (Math.abs(ev.clientY - startY) < DRAG_THRESHOLD) return;
        active = true;
        document.body.style.cursor = "grabbing";
      }
      const next = insertionAt(ev.clientY);
      if (next !== insert) {
        insert = next;
        setDrag({ id: hueId, insert: next });
      }
    };
    const finish = (commit: boolean) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      document.body.style.cursor = "";
      if (active) {
        suppressClick.current = true;
        if (commit) {
          const from = order.current.indexOf(hueId);
          const to = insert > from ? insert - 1 : insert;
          if (from >= 0 && insert >= 0 && to !== from) reorder.current(hueId, to);
        }
      }
      setDrag(null);
    };
    const up = () => finish(true);
    const cancel = () => finish(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
  };

  const handleFor = (hueId: string): DragHandle => ({
    ref: (el) => {
      if (el) handles.current.set(hueId, el);
      else handles.current.delete(hueId);
    },
    onPointerDown: (e) => {
      if (e.button !== 0) return;
      suppressClick.current = false;
      startPress(hueId, e.clientY);
    },
    onClickCapture: (e) => {
      if (!suppressClick.current) return;
      suppressClick.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
  });

  const fromIndex = drag ? generated.findIndex((g) => g.hue.id === drag.id) : -1;
  const isNoop = !drag || drag.insert === fromIndex || drag.insert === fromIndex + 1;
  const dropSideFor = (i: number): DropSide | null => {
    if (isNoop || !drag) return null;
    if (drag.insert === i) return "before";
    if (drag.insert === generated.length && i === generated.length - 1) return "after";
    return null;
  };

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
              edge={generated.length === 1 ? "only" : i === 0 ? "top" : i === generated.length - 1 ? "bottom" : null}
              handle={handleFor(g.hue.id)}
              dragging={drag?.id === g.hue.id}
              dropSide={dropSideFor(i)}
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
  edge,
  handle,
  dragging,
  dropSide,
  onMove,
}: {
  g: GeneratedHue;
  rules: ContrastRule[];
  overlay: Overlay;
  rowSelected: boolean;
  selectedGrade: number | null;
  reference: Shade | null;
  onSelect: (hueId: string, grade: number | null) => void;
  edge: "top" | "bottom" | "only" | null;
  handle: DragHandle;
  dragging: boolean;
  dropSide: DropSide | null;
  onMove: (delta: number) => void;
}) {
  const indicator = dropSide ? (
    <span aria-hidden className={cn("pointer-events-none absolute inset-x-0 z-20 h-0.5 bg-primary", dropSide === "before" ? "-top-px" : "-bottom-px")} />
  ) : null;

  return (
    <>
      <div
        {...handle}
        className={cn(
          "group/row sticky left-0 z-10 flex h-11 cursor-grab touch-none items-center bg-background select-none active:cursor-grabbing",
          dragging && "opacity-40",
        )}
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
      {g.shades.map((s, i, all) => (
        <Cell
          key={s.grade}
          corner={cn(
            i === 0 && (edge === "top" || edge === "only") && "rounded-tl-lg",
            i === all.length - 1 && (edge === "top" || edge === "only") && "rounded-tr-lg",
            i === 0 && (edge === "bottom" || edge === "only") && "rounded-bl-lg",
            i === all.length - 1 && (edge === "bottom" || edge === "only") && "rounded-br-lg",
          )}
          g={g}
          shade={s}
          rules={rules}
          overlay={overlay}
          selected={rowSelected && selectedGrade === s.grade}
          reference={reference}
          onSelect={() => onSelect(g.hue.id, s.grade)}
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
  corner,
  dimmed,
  indicator,
}: {
  /** Rounds the outside corner when this swatch sits at a corner of the table. */
  corner: string;
  g: GeneratedHue;
  shade: Shade;
  rules: ContrastRule[];
  overlay: Overlay;
  selected: boolean;
  reference: Shade | null;
  onSelect: () => void;
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
      type="button"
      onClick={onSelect}
      aria-label={`${g.hue.name} ${shade.grade}, ${shade.hex}${label ? `, ${label}` : ""}`}
      title={`${g.hue.name} ${shade.grade} · ${shade.hex}\nOKLCH ${shade.oklch.L.toFixed(3)} ${shade.oklch.C.toFixed(3)} ${Math.round(shade.oklch.h)}°`}
      className={cn(
        "relative flex h-11 items-center justify-center font-mono text-[11px] tabular-nums focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset",
        (status === "none" || dimmed) && "opacity-40",
        corner,
      )}
      style={{ backgroundColor: shown, color: fg }}
    >
      {status === "pass" ? <Check className="mr-0.5 size-3" aria-label="Meets its rule" /> : null}
      {status === "fail" ? <X className="mr-0.5 size-3" aria-label="Breaks its rule" /> : null}
      {label}
      {status === "fail" ? <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] border-2 border-red-500" /> : null}
      {selected ? <span aria-hidden className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] border-2 border-white mix-blend-difference" /> : null}
      {shade.isSource ? (
        <span className="pointer-events-none absolute top-0.5 right-0.5 opacity-80">
          {shade.pinned ? <Pin className="size-2.5" aria-label="Pinned source colour" /> : <Crosshair className="size-2.5" aria-label="Source colour landed here" />}
        </span>
      ) : null}
      {indicator}
    </button>
  );
}
