"use client";

import * as React from "react";
import { Check, Crosshair, Pin, X } from "lucide-react";
import { readableOn } from "@/lib/color/contrast";
import { type Gamut, cssColor } from "@/lib/color/gamut";
import { displayHex, displayShade, middleShade, swatchMeta, type Overlay } from "@/lib/palette/overlay";
import { tweakAt } from "@/lib/palette/tweaks";
import type { ContrastRule, GeneratedHue, Shade } from "@/lib/palette/types";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type SquareMode = "smooth" | "cells";

/** How neighbouring swatches are blended in Smooth mode. */
export type Blend = "mitchell" | "catmull" | "bspline" | "lanczos" | "gaussian" | "bilinear" | "smoothstep";
export const BLENDS: { id: Blend; label: string }[] = [
  { id: "mitchell", label: "Balanced" },
  { id: "bspline", label: "Smoothest" },
  { id: "gaussian", label: "Soft" },
  { id: "catmull", label: "Sharp" },
  { id: "lanczos", label: "Crisp" },
  { id: "bilinear", label: "Linear" },
  { id: "smoothstep", label: "Eased (original)" },
];

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
  blend: Blend;
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
/**
 * Resampling kernels, each with support of at most 2 swatches either side. Unlike smoothstep, none of
 * them drops to zero slope at a swatch center, so the grid doesn't show through as flat plateaus.
 */
const mitchell = (B: number) => {
  const K = (1 - B) / 2;
  return (x: number) => {
    const t = Math.abs(x);
    if (t < 1) return ((12 - 9 * B - 6 * K) * t ** 3 + (-18 + 12 * B + 6 * K) * t ** 2 + (6 - 2 * B)) / 6;
    if (t < 2) return ((-B - 6 * K) * t ** 3 + (6 * B + 30 * K) * t ** 2 + (-12 * B - 48 * K) * t + (8 * B + 24 * K)) / 6;
    return 0;
  };
};
const sinc = (x: number) => (x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x));
const KERNELS: Record<Blend, (x: number) => number> = {
  mitchell: mitchell(0.25),
  catmull: mitchell(0),
  bspline: mitchell(1),
  lanczos: (x) => (Math.abs(x) < 2 ? sinc(x) * sinc(x / 2) : 0),
  gaussian: (x) => (Math.abs(x) < 2 ? Math.exp(-(x * x) / (2 * 0.55 * 0.55)) : 0),
  bilinear: (x) => Math.max(0, 1 - Math.abs(x)),
  /** The original: bilinear eased with smoothstep. Flat at every swatch center, so the grid shows. */
  smoothstep: (x) => {
    const t = Math.abs(x);
    return t < 1 ? 1 - t * t * (3 - 2 * t) : 0;
  },
};

type Level = "all" | "hue" | "step";
interface View {
  level: Level;
  hueIdx: number;
  gradeIdx: number;
  /** Rows when every color shows; 0 otherwise. */
  R: number;
  /** Columns: a color's steps. */
  C: number;
}

/** A layer's motion: where it scales from, how far, and whether it fades. */
interface LayerAnim {
  origin: string;
  from: string;
  to: string;
  fade: "in" | "out" | "none";
  duration: number;
}

const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
const REST = "scale(1, 1)";
const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The square arriving, for instance from the palettes page: settles from slightly small. */
const ARRIVE: LayerAnim = { origin: "50% 50%", from: "scale(0.97, 0.97)", to: REST, fade: "in", duration: 320 };
const DISSOLVE: LayerAnim = { origin: "50% 50%", from: REST, to: REST, fade: "out", duration: 200 };
const SETTLE: LayerAnim = { origin: "50% 50%", from: "scale(0.985, 0.985)", to: REST, fade: "none", duration: 200 };

const pin = (idx: number, n: number) => (n > 1 ? idx / (n - 1) : 0.5);

/**
 * How two levels connect. Going into a row (or a column of that row) the old picture scales up around it until
 * it fills the square while the new one grows to meet it; going back out is the reverse. Anything else (another
 * color at the same level, say) just dissolves.
 */
function levelMotion(from: View, to: View): { enter: LayerAnim; exit: LayerAnim } {
  const zoom = (axis: "x" | "y", at: number, k: number, deeper: boolean) => {
    const scale = (n: number) => (axis === "y" ? `scale(1, ${n})` : `scale(${n}, 1)`);
    // The fixed point that makes cell `idx` of `n` fill the square when scaled by n (and a layer shrunk by 1/n line up with that cell).
    const origin = axis === "y" ? `50% ${at * 100}%` : `${at * 100}% 50%`;
    const duration = 320;
    // Going in, the old picture stays opaque underneath (the new one, shrunk to the row, doesn't cover the square yet) and the new one fades in on top.
    return deeper
      ? { enter: { origin, from: scale(1 / k), to: REST, fade: "in", duration } as LayerAnim, exit: { origin, from: REST, to: scale(k), fade: "none", duration } as LayerAnim }
      : { enter: { origin, from: scale(k), to: REST, fade: "none", duration } as LayerAnim, exit: { origin, from: REST, to: scale(1 / k), fade: "out", duration } as LayerAnim };
  };
  if (from.level === "all" && to.level === "hue" && from.R > 0) return zoom("y", pin(to.hueIdx, from.R), from.R, true);
  if (from.level === "hue" && to.level === "all" && to.R > 0) return zoom("y", pin(from.hueIdx, to.R), to.R, false);
  if (from.level === "hue" && to.level === "step" && from.hueIdx === to.hueIdx && from.C > 0) return zoom("x", pin(to.gradeIdx, from.C), from.C, true);
  if (from.level === "step" && to.level === "hue" && from.hueIdx === to.hueIdx && to.C > 0) return zoom("x", pin(from.gradeIdx, to.C), to.C, false);
  return { enter: SETTLE, exit: DISSOLVE };
}

/** One full-size picture of the square. Plays `enter` when it mounts and `exit` when it is told to leave. */
function Layer({ children, enter, exit, onExited }: { children: React.ReactNode; enter?: LayerAnim | null; exit?: LayerAnim; onExited?: () => void }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const play = (a: LayerAnim, leaving: boolean) => {
    const el = ref.current;
    if (!el) return null;
    el.style.transformOrigin = a.origin;
    const opacity = a.fade === "none" ? [1, 1] : a.fade === "in" ? [0, 1] : [1, 0];
    return el.animate(
      [
        { transform: a.from, opacity: opacity[0] },
        { transform: a.to, opacity: opacity[1] },
      ],
      { duration: a.duration, easing: EASE_OUT, fill: leaving ? "forwards" : "backwards" },
    );
  };
  React.useLayoutEffect(() => {
    if (enter) play(enter, false);
    // Only on mount: the layer keeps its picture while the level it shows stays the same.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  React.useLayoutEffect(() => {
    if (!exit) return;
    const a = play(exit, true);
    if (!a) {
      onExited?.();
      return;
    }
    a.finished.then(() => onExited?.()).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exit]);
  return (
    <div ref={ref} className={cn("absolute inset-0", exit && "pointer-events-none")}>
      {children}
    </div>
  );
}

/** A small, non-interactive copy of the all-colors gradient, for thumbnails. Fills whatever box it's put in. */
export function PalettePreview({ generated, gamut }: { generated: GeneratedHue[]; gamut: Gamut }) {
  const colors = React.useMemo(
    () => generated.map((g) => g.shades.map((s) => displayShade(s, { metric: "contrast", against: "white", grayscale: false, vision: "normal" }, gamut))),
    [generated, gamut],
  );
  return <SmoothCanvas colors={colors} grain={false} blend="mitchell" size={160} />;
}

/**
 * One rounded square that stands in for the whole palette. With every color it is rows of hues; with
 * one color it is that color's steps side by side; with one step it is that single color. In
 * "smooth" mode the colors melt into each other like a gradient, in "cells" mode they stay crisp.
 * Hovering shows a dot on each thing you can open.
 */
export function PaletteSquare({ generated, focusHueId, focusGrade, rules, overlay, gamut, mode, grain, blend, reference, onOpenHue, onOpenStep }: Props) {
  const focused = focusHueId ? generated.find((g) => g.hue.id === focusHueId) ?? null : null;
  const focusShade = focused && focusGrade !== null ? focused.shades.find((s) => s.grade === focusGrade) ?? null : null;
  const level: Level = focused ? (focusShade ? "step" : "hue") : "all";

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

  const content = (
    <>
      {mode === "smooth" ? (
        <SmoothCanvas colors={colors} grain={grain} blend={blend} />
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
    </>
  );

  // Moving between levels zooms into (or back out of) the row or column you chose, so the square reads as one
  // object you travel through. The layer you leave stays mounted while it animates away.
  const key = `${level}-${focusHueId}-${focusGrade}`;
  const view: View = {
    level,
    hueIdx: focused ? generated.indexOf(focused) : -1,
    gradeIdx: focusShade && focused ? focused.shades.indexOf(focusShade) : -1,
    R: level === "all" ? generated.length : 0,
    C: focused ? focused.shades.length : (generated[0]?.shades.length ?? 0),
  };
  const [shown, setShown] = React.useState({ key, view });
  const [enterAnim, setEnterAnim] = React.useState<LayerAnim | null>(() => (prefersReducedMotion() ? null : ARRIVE));
  const [exiting, setExiting] = React.useState<{ id: string; node: React.ReactNode; anim: LayerAnim }[]>([]);
  const lastContent = React.useRef<React.ReactNode>(content);
  React.useEffect(() => {
    lastContent.current = content;
  });
  if (shown.key !== key) {
    setShown({ key, view });
    if (prefersReducedMotion()) {
      setEnterAnim(null);
    } else {
      const motion = levelMotion(shown.view, view);
      // The picture to animate away is the one last committed, which is exactly what the ref holds.
      // eslint-disable-next-line react-hooks/refs
      const departing = { id: shown.key, node: lastContent.current, anim: motion.exit };
      setEnterAnim(motion.enter);
      setExiting((list) => [...list.filter((l) => l.id !== departing.id), departing]);
    }
  }

  const leaving = exiting.filter((ex) => ex.id !== key);
  const renderLeaving = (ex: (typeof exiting)[number]) => (
    <Layer key={ex.id} exit={ex.anim} onExited={() => setExiting((list) => list.filter((l) => l.id !== ex.id))}>
      {ex.node}
    </Layer>
  );

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
        className={cn("group/square relative aspect-square w-full rounded-3xl shadow-(--shadow-extra-large)", level !== "step" && "cursor-pointer")}
      >
        <div className="absolute inset-0 overflow-hidden rounded-[inherit]">
          {/* A picture that stays opaque while the new one fades in sits beneath it; one that fades out sits on top. */}
          {leaving.filter((ex) => ex.anim.fade === "none").map(renderLeaving)}
          <Layer key={key} enter={enterAnim}>
            {content}
          </Layer>
          {leaving.filter((ex) => ex.anim.fade !== "none").map(renderLeaving)}
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
  // Controlled: the square decides when a dot is "active" (the pointer is over its cell or column), not the
  // dot's own hover. The tooltip renders in a portal, so the dot's hover scale doesn't distort it.
  return (
    <Tooltip open={active}>
      <TooltipTrigger
        render={
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
          />
        }
      />
      <TooltipContent side={chipSide} sideOffset={8}>
        {chip}
      </TooltipContent>
    </Tooltip>
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
function SmoothCanvas({ colors, grain, blend, size = SIZE }: { colors: string[][]; grain: boolean; blend: Blend; size?: number }) {
  const ref = React.useRef<HTMLCanvasElement>(null);

  // Before the first paint, so a layer that animates in is never empty.
  React.useLayoutEffect(() => {
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

    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { colorSpace: space });
    if (!ctx) return;
    const out = ctx.createImageData(size, size, { colorSpace: space });

    // For each output column / row: the four neighbouring swatch indices and their cubic weights.
    const kernel = KERNELS[blend];
    const taps = (n: number, count: number) => {
      const idx = new Int32Array(n * 4);
      const w = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        const v = ((i + 0.5) / n) * count - 0.5;
        const base = Math.floor(v);
        let total = 0;
        const raw = [0, 0, 0, 0];
        for (let k = 0; k < 4; k++) {
          raw[k] = kernel(v - (base - 1 + k));
          total += raw[k];
        }
        for (let k = 0; k < 4; k++) {
          idx[i * 4 + k] = clamp(base - 1 + k, 0, count - 1);
          w[i * 4 + k] = raw[k] / total;
        }
      }
      return { idx, w };
    };
    const xs = taps(size, C);
    const ys = taps(size, R);

    // The blend is separable, so blend each swatch row across first (R rows) and then down (once per pixel),
    // instead of all 16 swatches for every pixel. That keeps a level change from stalling its own animation.
    const across = new Float32Array(R * size * 3);
    for (let r = 0; r < R; r++) {
      for (let x = 0; x < size; x++) {
        for (let ch = 0; ch < 3; ch++) {
          let line = 0;
          for (let k = 0; k < 4; k++) line += src[(r * C + xs.idx[x * 4 + k]) * 4 + ch] * xs.w[x * 4 + k];
          across[(r * size + x) * 3 + ch] = line;
        }
      }
    }
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        // Dithering by up to one level hides the 8-bit steps that show as bands in slow, dark gradients.
        const dither = hash(x, y) + hash(x + 7919, y + 104729) - 1;
        const noise = dither + (grain ? (hash(x + 31, y + 57) - 0.5) * GRAIN : 0);
        for (let ch = 0; ch < 3; ch++) {
          let sum = 0;
          for (let j = 0; j < 4; j++) sum += across[(ys.idx[y * 4 + j] * size + x) * 3 + ch] * ys.w[y * 4 + j];
          out.data[i + ch] = sum + noise;
        }
        out.data[i + 3] = 255;
      }
    }
    ctx.putImageData(out, 0, 0);
  }, [colors, grain, blend, size]);

  return <canvas ref={ref} aria-hidden className="size-full" />;
}
