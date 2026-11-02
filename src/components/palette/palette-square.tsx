"use client";

import * as React from "react";
import { Check, Crosshair, Pin, X } from "lucide-react";
import { readableOn } from "@/lib/color/contrast";
import { type Gamut, cssColor } from "@/lib/color/gamut";
import { displayHex, displayShade, middleShade, swatchMeta, type Overlay } from "@/lib/palette/overlay";
import { tweakAt } from "@/lib/palette/tweaks";
import type { ContrastRule, GeneratedHue, Shade } from "@/lib/palette/types";
import { cn } from "@/lib/utils";

export type SquareMode = "smooth" | "cells";

interface Props {
  generated: GeneratedHue[];
  /** The color whose steps fill the square, or null to show every color. */
  focusHueId: string | null;
  /** The step that fills the square (needs a focused color), or null to show all of the color's steps. */
  focusGrade: number | null;
  rules: ContrastRule[];
  overlay: Overlay;
  gamut: Gamut;
  mode: SquareMode;
  /** Visible film grain over the smooth gradient. A faint dither is always applied to hide banding. */
  grain: boolean;
  /** The shade other swatches are compared against when the overlay says "selected". */
  reference: Shade | null;
  onOpenHue: (hueId: string) => void;
  onOpenStep: (hueId: string, grade: number) => void;
}

interface Row {
  g: GeneratedHue;
  shades: Shade[];
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
/** Eases a 0–1 blend so each swatch keeps a soft plateau at its center instead of a straight-line ramp. */
const ease = (t: number) => t * t * (3 - 2 * t);

/**
 * One rounded square that stands in for the whole palette. With every color it is rows of hues; with
 * one color it is that color's steps side by side; with one step it is that single color. In
 * "smooth" mode the colors melt into each other like a gradient, in "cells" mode they stay crisp.
 * Hovering shows a dot on each thing you can open.
 */
export function PaletteSquare({ generated, focusHueId, focusGrade, rules, overlay, gamut, mode, grain, reference, onOpenHue, onOpenStep }: Props) {
  const focused = focusHueId ? generated.find((g) => g.hue.id === focusHueId) ?? null : null;
  const focusShade = focused && focusGrade !== null ? focused.shades.find((s) => s.grade === focusGrade) ?? null : null;
  const level: "all" | "hue" | "step" = focused ? (focusShade ? "step" : "hue") : "all";

  const rows: Row[] = React.useMemo(() => {
    if (focused && focusShade) return [{ g: focused, shades: [focusShade] }];
    if (focused) return [{ g: focused, shades: focused.shades }];
    return generated.map((g) => ({ g, shades: g.shades }));
  }, [generated, focused, focusShade]);

  const R = rows.length;
  const C = rows[0]?.shades.length ?? 0;
  const colors = React.useMemo(() => rows.map((r) => r.shades.map((s) => displayShade(s, overlay, gamut))), [rows, overlay, gamut]);

  const boxRef = React.useRef<HTMLDivElement>(null);
  const [hover, setHover] = React.useState<{ row: number; col: number } | null>(null);

  const locate = (e: React.PointerEvent | React.MouseEvent) => {
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect || R === 0 || C === 0) return null;
    return {
      row: clamp(Math.floor(((e.clientY - rect.top) / rect.height) * R), 0, R - 1),
      col: clamp(Math.floor(((e.clientX - rect.left) / rect.width) * C), 0, C - 1),
    };
  };

  const open = (row: number, col: number) => {
    if (level === "all") onOpenHue(rows[row].g.hue.id);
    else if (level === "hue") onOpenStep(rows[0].g.hue.id, rows[0].shades[col].grade);
  };

  const label = (r: number, c: number) => {
    const shade = rows[r].shades[c];
    const meta = swatchMeta(shade, overlay, reference, rules);
    return { shade, ...meta };
  };

  return (
    <div className="relative">
      <div
        ref={boxRef}
        role="group"
        aria-label={level === "all" ? "Your palette" : level === "hue" ? `${focused?.hue.name} steps` : `${focused?.hue.name} ${focusShade?.grade}`}
        onPointerMove={(e) => {
          if (level === "step") return;
          const at = locate(e);
          setHover((prev) => (prev && at && prev.row === at.row && prev.col === at.col ? prev : at));
        }}
        onPointerLeave={() => setHover(null)}
        onClick={(e) => {
          const at = locate(e);
          if (at) open(at.row, at.col);
        }}
        className={cn("group/square relative aspect-square w-full rounded-3xl shadow-(--shadow-canvas)", level !== "step" && "cursor-pointer")}
      >
        <div key={`${level}-${focusHueId}-${focusGrade}`} className="absolute inset-0 animate-in overflow-hidden rounded-[inherit] duration-300 fade-in">
          {mode === "smooth" ? (
            <SmoothCanvas colors={colors} grain={grain} />
          ) : (
            <div className="grid size-full" style={{ gridTemplateRows: `repeat(${R}, minmax(0, 1fr))`, gridTemplateColumns: `repeat(${C}, minmax(0, 1fr))` }}>
              {rows.map((row, r) =>
                row.shades.map((shade, c) => {
                  const { label: text, status } = label(r, c);
                  const fg = readableOn(displayHex(shade, overlay));
                  return (
                    <div key={`${row.g.hue.id}-${shade.grade}`} className="relative flex items-center justify-center font-mono text-[11px] tabular-nums" style={{ backgroundColor: colors[r][c], color: fg }}>
                      <span className={cn(level === "hue" && "mt-24", level === "step" && "text-3xl")}>
                        {status === "pass" ? <Check className="mr-0.5 inline size-3" aria-label="Meets its rule" /> : null}
                        {status === "fail" ? <X className="mr-0.5 inline size-3" aria-label="Breaks its rule" /> : null}
                        {text}
                      </span>
                      {status === "fail" ? <span aria-hidden className="pointer-events-none absolute inset-0 border-2 border-red-500" /> : null}
                      {shade.isSource ? (
                        <span className="pointer-events-none absolute top-1 right-1 opacity-80">
                          {shade.pinned ? <Pin className="size-2.5" aria-label="Pinned source color" /> : <Crosshair className="size-2.5" aria-label="Source color landed here" />}
                        </span>
                      ) : null}
                      {!shade.anchor && (tweakAt(row.g.hue, shade.grade).dh !== 0 || tweakAt(row.g.hue, shade.grade).dc !== 0) ? (
                        <span aria-hidden title="Tuned" className="pointer-events-none absolute bottom-1 left-1 size-1.5 rounded-full bg-current opacity-80" />
                      ) : null}
                    </div>
                  );
                }),
              )}
            </div>
          )}
        </div>

        {/* The row or column under the pointer. */}
        {hover && level !== "step" ? (
          <div
            aria-hidden
            className="pointer-events-none absolute rounded-xl ring-2 ring-white/70 transition-[top,left] duration-100 ring-inset"
            style={
              level === "all"
                ? { left: 0, right: 0, top: `${(hover.row / R) * 100}%`, height: `${100 / R}%` }
                : { top: 0, bottom: 0, left: `${(hover.col / C) * 100}%`, width: `${100 / C}%` }
            }
          />
        ) : null}

        {/* One dot per thing you can open: a color's middle shade, or each step. */}
        {level === "all"
          ? rows.map((row, r) => {
              const mid = middleShade(row.shades);
              const active = hover?.row === r;
              return (
                <Dot
                  key={row.g.hue.id}
                  x={50}
                  y={((r + 0.5) / R) * 100}
                  color={displayShade(mid, overlay, gamut)}
                  active={active}
                  label={`Open ${row.g.hue.name || "Unnamed"}`}
                  chip={row.g.hue.name || "Unnamed"}
                  chipSide="right"
                  onOpen={() => onOpenHue(row.g.hue.id)}
                />
              );
            })
          : null}
        {level === "hue"
          ? rows[0].shades.map((shade, c) => {
              const { label: text } = label(0, c);
              const hex = cssColor(shade.hex, shade.linear, gamut);
              return (
                <Dot
                  key={shade.grade}
                  x={((c + 0.5) / C) * 100}
                  y={50}
                  color={colors[0][c]}
                  active={hover?.col === c}
                  label={`Open ${rows[0].g.hue.name} ${shade.grade}`}
                  chip={`${shade.grade} · ${text || hex}`}
                  chipSide="top"
                  onOpen={() => onOpenStep(rows[0].g.hue.id, shade.grade)}
                />
              );
            })
          : null}
      </div>
    </div>
  );
}

function Dot({
  x,
  y,
  color,
  active,
  label,
  chip,
  chipSide,
  onOpen,
}: {
  x: number;
  y: number;
  color: string;
  active: boolean;
  label: string;
  chip: string;
  chipSide: "right" | "top";
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      className={cn(
        "absolute z-10 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white opacity-0 shadow-md transition-[opacity,transform] duration-150 group-hover/square:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:opacity-100",
        active && "scale-150 opacity-100",
      )}
      style={{ left: `${x}%`, top: `${y}%`, backgroundColor: color }}
    >
      {active ? (
        <span
          className={cn(
            "pointer-events-none absolute rounded-md bg-black/75 px-2 py-0.5 font-sans text-[11px] font-medium whitespace-nowrap text-white backdrop-blur",
            chipSide === "right" ? "top-1/2 left-full ml-2.5 -translate-y-1/2 scale-[0.67] origin-left" : "bottom-full left-1/2 mb-2.5 -translate-x-1/2 scale-[0.67] origin-bottom",
          )}
        >
          {chip}
        </span>
      ) : null}
    </button>
  );
}

const SIZE = 800;
const GRAIN = 8;

/** A stable per-pixel random number in [0, 1), so noise doesn't shimmer when the colors change. */
const hash = (x: number, y: number) => {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/**
 * Paints the colors as a soft gradient. Each swatch becomes one pixel of a tiny canvas (so the browser
 * parses any CSS color, including Display P3), then the pixels are blended smoothly into a larger one.
 */
function SmoothCanvas({ colors, grain }: { colors: string[][]; grain: boolean }) {
  const ref = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = ref.current;
    const R = colors.length;
    const C = colors[0]?.length ?? 0;
    if (!canvas || R === 0 || C === 0) return;

    const tiny = document.createElement("canvas");
    tiny.width = C;
    tiny.height = R;
    const tctx = tiny.getContext("2d", { colorSpace: "display-p3", willReadFrequently: true });
    if (!tctx) return;
    const space = tctx.getContextAttributes?.().colorSpace ?? "srgb";
    colors.forEach((row, r) =>
      row.forEach((color, c) => {
        tctx.fillStyle = color;
        tctx.fillRect(c, r, 1, 1);
      }),
    );
    const src = tctx.getImageData(0, 0, C, R, { colorSpace: space }).data;

    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d", { colorSpace: space });
    if (!ctx) return;
    const out = ctx.createImageData(SIZE, SIZE, { colorSpace: space });

    const sample = (r: number, c: number, ch: number) => src[(r * C + c) * 4 + ch];
    for (let y = 0; y < SIZE; y++) {
      const v = ((y + 0.5) / SIZE) * R - 0.5;
      const r0 = clamp(Math.floor(v), 0, R - 1);
      const r1 = Math.min(r0 + 1, R - 1);
      const fy = v < 0 ? 0 : ease(clamp(v - r0, 0, 1));
      for (let x = 0; x < SIZE; x++) {
        const u = ((x + 0.5) / SIZE) * C - 0.5;
        const c0 = clamp(Math.floor(u), 0, C - 1);
        const c1 = Math.min(c0 + 1, C - 1);
        const fx = u < 0 ? 0 : ease(clamp(u - c0, 0, 1));
        const i = (y * SIZE + x) * 4;
        // Dithering by up to one level hides the 8-bit steps that show as bands in slow, dark gradients.
        const dither = hash(x, y) + hash(x + 7919, y + 104729) - 1;
        const noise = dither + (grain ? (hash(x + 31, y + 57) - 0.5) * GRAIN : 0);
        for (let ch = 0; ch < 3; ch++) {
          const top = sample(r0, c0, ch) * (1 - fx) + sample(r0, c1, ch) * fx;
          const bottom = sample(r1, c0, ch) * (1 - fx) + sample(r1, c1, ch) * fx;
          out.data[i + ch] = top * (1 - fy) + bottom * fy + noise;
        }
        out.data[i + 3] = 255;
      }
    }
    ctx.putImageData(out, 0, 0);
  }, [colors, grain]);

  return <canvas ref={ref} aria-hidden className="size-full" />;
}
