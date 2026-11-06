"use client";

import * as React from "react";
import { useRovingFocus } from "./use-roving-focus";
import { Check, Crosshair, Pin, TriangleAlert, X } from "lucide-react";
import { readableOn } from "@/lib/color/contrast";
import { type Gamut, cssColor } from "@/lib/color/gamut";
import { displayHex, displayShade, middleShade, swatchMeta, type Overlay } from "@/lib/palette/overlay";
import { tweakAt } from "@/lib/palette/tweaks";
import type { ContrastRule, GeneratedHue, Shade } from "@/lib/palette/types";
import type { Failure } from "@/lib/palette/validate";
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
  /** Mark every swatch with whether it keeps the contrast rules, using the failing pairs below. */
  showRules?: boolean;
  failures?: Failure[];
  gamut: Gamut;
  mode: SquareMode;
  /** Visible film grain over the smooth gradient. A faint dither is always applied to hide banding. */
  grain: boolean;
  blend: Blend;
  /** The shade other swatches are compared against when the overlay says "selected". */
  reference: Shade | null;
  onOpenHue: (hueId: string) => void;
  onOpenStep: (hueId: string, grade: number) => void;
  /** The color and step you last opened: where the keyboard lands when you come back to a level. */
  currentHueId?: string | null;
  currentGrade?: number | null;
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
  easing?: string;
  /** Scales one axis only, which would stretch any text in the picture, so labels hide while it plays. */
  stretch?: boolean;
}

/** Labels and marks drawn in a layer: hidden at once while it stretches, faded back in once it settles. */
const LABEL_MOTION = "transition-opacity duration-150 group-data-[stretching]/layer:opacity-0 group-data-[stretching]/layer:duration-0";

// Zooming in covers a lot of ground (the picture scales up to 13x), so it eases in as well as out and takes longer, or it reads as a cut.
const EASE_IN_OUT = "cubic-bezier(0.65, 0, 0.35, 1)";
const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
const REST = "scale(1, 1)";
const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The square arriving: settles in from slightly small. */
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
    // Going in, the old picture zooms into the row underneath while the new one, already full size, fades in over it. (Growing the new one from the row left its hard edges visible against the old picture's soft blend between rows.)
    return deeper
      ? { enter: { origin, from: REST, to: REST, fade: "in", duration: 320, easing: EASE_IN_OUT } as LayerAnim, exit: { origin, from: REST, to: scale(k), fade: "none", duration: 320, easing: EASE_IN_OUT, stretch: true } as LayerAnim }
      : { enter: { origin, from: scale(k), to: REST, fade: "none", duration, stretch: true } as LayerAnim, exit: { origin, from: REST, to: scale(1 / k), fade: "out", duration, stretch: true } as LayerAnim };
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
    if (a.stretch) el.dataset.stretching = "";
    const anim = el.animate(
      [
        { transform: a.from, opacity: opacity[0] },
        { transform: a.to, opacity: opacity[1] },
      ],
      { duration: a.duration, easing: a.easing ?? EASE_OUT, fill: leaving ? "forwards" : "backwards" },
    );
    // A leaving layer stays stretched until it unmounts; an arriving one shows its labels again once it lands.
    if (a.stretch && !leaving) anim.finished.then(() => delete el.dataset.stretching).catch(() => {});
    return anim;
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
    <div ref={ref} className={cn("group/layer absolute inset-0", exit && "pointer-events-none")}>
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
export function PaletteSquare({ generated, focusHueId, focusGrade, rules, overlay, showRules = false, failures = [], gamut, mode, grain, blend, reference, onOpenHue, onOpenStep, currentHueId = null, currentGrade = null }: Props) {
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

  // For every swatch, the other swatches it fails its contrast rule against.
  const misses = React.useMemo(() => {
    const map = new Map<string, string[]>();
    const add = (hueId: string, grade: number, text: string) => map.set(`${hueId}:${grade}`, [...(map.get(`${hueId}:${grade}`) ?? []), text]);
    for (const f of failures) {
      const ratio = `${f.ratio.toFixed(2)}:1, needs ${f.required}:1`;
      add(f.fgHueId, f.fg.grade, `${f.bgHue || "Unnamed"} ${f.bg.grade} (${ratio})`);
      add(f.bgHueId, f.bg.grade, `${f.fgHue || "Unnamed"} ${f.fg.grade} (${ratio})`);
    }
    return map;
  }, [failures]);
  const missesOf = (hueId: string, grade: number) => (showRules ? (misses.get(`${hueId}:${grade}`) ?? []) : []);
  const ruleNote = (hueId: string, grade: number) => {
    const list = missesOf(hueId, grade);
    return list.length === 0 ? "" : `, misses its contrast rule against ${list.length} step${list.length === 1 ? "" : "s"}`;
  };

  /** The mark on a dot: a color is only flagged ("warn") so it can be opened; its steps then say which ones miss ("fail"). */
  const rowStatus = (row: Row): DotStatus => (!showRules || rules.length === 0 ? null : row.shades.some((sh) => missesOf(row.g.hue.id, sh.grade).length > 0) ? "warn" : "pass");
  const shadeStatus = (row: Row, shade: Shade): DotStatus => (!showRules || rules.length === 0 ? null : missesOf(row.g.hue.id, shade.grade).length > 0 ? "fail" : "pass");

  const boxRef = React.useRef<HTMLDivElement>(null);
  const [hover, setHover] = React.useState<{ row: number; col: number } | null>(null);
  // The dots are one tab stop: arrows move between them (up and down for colors, left and right for steps).
  useRovingFocus(boxRef, { orientation: level === "all" ? "vertical" : "horizontal", enabled: level !== "step" });

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
        <>
          <SmoothCanvas colors={colors} grain={grain} blend={blend} />
          {/* A color's steps show their numbers on hover, in the same spots as the swatch view. */}
          {level === "hue" ? (
            <div className={cn(LABEL_MOTION, "pointer-events-none absolute inset-0 grid")} style={{ gridTemplateColumns: `repeat(${C}, minmax(0, 1fr))` }}>
              {rows[0].shades.map((shade, c) => (
                <div key={shade.grade} className="flex items-center justify-center font-mono text-[11px] tabular-nums" style={{ color: readableOn(displayHex(shade, overlay)) }}>
                  <span className="mt-24 opacity-0 transition-opacity duration-150 group-hover/square:opacity-100 group-focus-within/square:opacity-100 pointer-coarse:opacity-100">{label(0, c).label}</span>
                </div>
              ))}
            </div>
          ) : null}
          {/* A single step is one flat color either way, so its score shows in the gradient view too. */}
          {level === "step" && label(0, 0).label ? (
            <div className={cn(LABEL_MOTION, "absolute inset-0 flex items-center justify-center font-mono text-3xl tabular-nums")} style={{ color: readableOn(displayHex(rows[0].shades[0], overlay)) }}>
              {label(0, 0).label}
            </div>
          ) : null}
        </>
      ) : (
        <div className="grid size-full" style={{ gridTemplateRows: `repeat(${R}, minmax(0, 1fr))`, gridTemplateColumns: `repeat(${C}, minmax(0, 1fr))` }}>
          {rows.map((row, r) =>
            row.shades.map((shade, c) => {
              const { label: text, status } = label(r, c);
              const fg = readableOn(displayHex(shade, overlay));
              return (
                <div key={`${row.g.hue.id}-${shade.grade}`} className="relative flex items-center justify-center font-mono text-[11px] tabular-nums" style={{ backgroundColor: colors[r][c], color: fg }}>
                  <span className={cn(LABEL_MOTION, level === "hue" && "mt-24", level === "step" && "text-3xl")}>
                    {status === "pass" ? <Check className="mr-0.5 inline size-3" aria-label="Meets its rule" /> : null}
                    {status === "fail" ? <X className="mr-0.5 inline size-3" aria-label="Breaks its rule" /> : null}
                    {level === "all" ? null : text}
                  </span>
                  {status === "fail" ? <span aria-hidden className={cn(LABEL_MOTION, "pointer-events-none absolute inset-0 border-2 border-red-500")} /> : null}
                  {shade.isSource ? (
                    <span className={cn(LABEL_MOTION, "pointer-events-none absolute top-1 right-1 opacity-80")}>
                      {shade.pinned ? <Pin className="size-2.5" aria-label="Pinned source color" /> : <Crosshair className="size-2.5" aria-label="Source color landed here" />}
                    </span>
                  ) : null}
                  {!shade.anchor && (tweakAt(row.g.hue, shade.grade).dh !== 0 || tweakAt(row.g.hue, shade.grade).dc !== 0) ? (
                    <span aria-hidden title="Tuned" className={cn(LABEL_MOTION, "pointer-events-none absolute bottom-1 left-1 size-1.5 rounded-full bg-current opacity-80")} />
                  ) : null}
                </div>
              );
            }),
          )}
        </div>
      )}
      {showRules && rules.length > 0 && level === "step" ? (
        <div aria-hidden className={cn(LABEL_MOTION, "pointer-events-none absolute inset-0 grid")} style={{ gridTemplateRows: `repeat(${R}, minmax(0, 1fr))`, gridTemplateColumns: `repeat(${C}, minmax(0, 1fr))` }}>
          {rows.map((row) =>
            row.shades.map((shade) => {
              const list = misses.get(`${row.g.hue.id}:${shade.grade}`) ?? [];
              const pair = list.length === 1 ? "1 pair" : `${list.length} pairs`;
              return (
                <div key={`${row.g.hue.id}-${shade.grade}`} className="relative">
                  <span
                    title={list.length === 0 ? "Keeps every contrast rule" : `Misses its rule against ${list.join(", ")}`}
                    className={cn("absolute top-[72%] left-1/2 inline-flex h-4 -translate-x-1/2 -translate-y-1/2 items-center gap-0.5 px-1 text-[10px] font-medium tabular-nums", inkBlend(readableOn(displayHex(shade, overlay)) === "#000000", true))}
                  >
                    {list.length === 0 ? <Check className="size-3" strokeWidth={2.5} /> : <X className="size-3" strokeWidth={2.5} />}
                    {list.length === 0 ? null : list.length}
                    {list.length === 0 ? null : <span className="sr-only">{pair}</span>}
                  </span>
                </div>
              );
            }),
          )}
        </div>
      ) : null}
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
  // The square settles in when it first appears.
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
        data-palette-square
        role="group"
        data-region="canvas"
        // A single step has nothing to move between, but the group still takes focus so the keyboard stays on the canvas.
        tabIndex={level === "step" ? -1 : undefined}
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
        className={cn("group/square relative aspect-square w-full rounded-3xl shadow-(--shadow-default) outline-none", level !== "step" && "cursor-pointer")}
      >
        <div className="absolute inset-0 overflow-hidden rounded-[inherit]">
          {/* A picture that stays opaque while the new one fades in sits beneath it; one that fades out sits on top. */}
          {leaving.filter((ex) => ex.anim.fade === "none").map(renderLeaving)}
          <Layer key={key} enter={enterAnim}>
            {content}
          </Layer>
          {leaving.filter((ex) => ex.anim.fade !== "none").map(renderLeaving)}
        </div>

        {/* The row or column under the pointer. Corners that sit in the canvas's corners share its radius; the rest are square. */}
        {hover && level !== "step" ? (
          <>
            {/* A wide ring that blends into the colors beneath it, and a faint plain one so it still shows over black. */}
            <HoverRing level={level} hover={hover} rows={R} cols={C} className="mix-blend-overlay" shadow="shadow-[inset_0_0_0_2px_#fff]" />
            <HoverRing level={level} hover={hover} rows={R} cols={C} shadow="shadow-[inset_0_0_0_1px_#ffffff40]" />
            {/* White has nothing to brighten on light colors, so a dark ring multiplied in carries it there (and vanishes on dark ones). */}
            <HoverRing level={level} hover={hover} rows={R} cols={C} className="mix-blend-multiply" shadow="shadow-[inset_0_0_0_2px_#00000026]" />
          </>
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
                  status={rowStatus(row)}
                  light={readableOn(displayHex(mid, overlay)) === "#000000"}
                  current={row.g.hue.id === currentHueId}
                  onFocus={(e) => e.currentTarget.matches(":focus-visible") && setHover({ row: r, col: 0 })}
                  onBlur={() => setHover(null)}
                  label={`Open ${row.g.hue.name || "Unnamed"}${row.shades.some((sh) => missesOf(row.g.hue.id, sh.grade).length > 0) ? `, ${row.shades.filter((sh) => missesOf(row.g.hue.id, sh.grade).length > 0).length} steps miss contrast rules` : ""}`}
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
                  status={shadeStatus(rows[0], shade)}
                  light={readableOn(displayHex(shade, overlay)) === "#000000"}
                  current={shade.grade === currentGrade}
                  onFocus={(e) => e.currentTarget.matches(":focus-visible") && setHover({ row: 0, col: c })}
                  onBlur={() => setHover(null)}
                  label={`Open ${rows[0].g.hue.name} ${shade.grade}${ruleNote(rows[0].g.hue.id, shade.grade)}`}
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

type DotStatus = "pass" | "warn" | "fail" | null;

/**
 * How a ring or mark blends into the color beneath it: plus-lighter adds white on dark colors and plus-darker takes
 * it away on light ones, so even pure black and white still show it. Browsers without plus-darker (Chrome) get the
 * nearest look from multiply.
 */
const inkBlend = (light: boolean, strong = false) =>
  cn(
    light ? "mix-blend-multiply supports-[mix-blend-mode:plus-darker]:mix-blend-plus-darker" : "mix-blend-plus-lighter",
    // Stronger while the contrast marks are on, so the marks and their rings stand out from the plain dots.
    light ? (strong ? "text-black/50" : "text-black/35") : strong ? "text-white/50" : "text-white/35",
  );

function Dot({
  x,
  y,
  color,
  active,
  status,
  light,
  current,
  onFocus,
  onBlur,
  label,
  chip,
  chipSide,
  onOpen,
}: {
  x: number;
  y: number;
  color: string;
  active: boolean;
  /** When the contrast rules are shown: the mark drawn inside the dot, which then stays visible. */
  status: DotStatus;
  /** A light color, where white has nothing to brighten, so the ring and mark go deeper instead. */
  light: boolean;
  /** Where Tab lands when it enters the dots. */
  current: boolean;
  onFocus: (e: React.FocusEvent<HTMLButtonElement>) => void;
  onBlur: () => void;
  label: string;
  chip: string;
  chipSide: "right" | "top";
  onOpen: () => void;
}) {
  // The square decides when a dot is "active" (the pointer is over its cell or column), not the dot's own hover.
  // The button itself carries no z-index, opacity or transform: those would wall the blended ring off from the
  // canvas, so they sit on the inner layers instead. The name chip is the shared tooltip, in its glass style.
  const shown = "opacity-0 transition-[opacity,scale] duration-150 group-hover/square:opacity-100 group-focus-within/square:opacity-100 pointer-coarse:opacity-100";
  const on = active && "scale-150 opacity-100";
  const marked = status ? "opacity-100 transition-[opacity,scale] duration-150" : shown;
  const Icon = status === "pass" ? Check : status === "warn" ? TriangleAlert : X;
  return (
    <Tooltip open={active}>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={label}
            data-current={current || undefined}
            onFocus={onFocus}
            onBlur={onBlur}
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
            className="absolute -mt-2 -ml-2 size-4 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            <span aria-hidden className={cn("absolute inset-0 rounded-full shadow-[0_1px_1px_-1px_#0000001a,0_1px_2px_0_#0000000d]", marked, on)} style={{ backgroundColor: color }} />
            <span aria-hidden className={cn("absolute inset-0 rounded-full shadow-[inset_0_0_0_1.5px_currentColor]", inkBlend(light, status !== null), marked, on)} />
            {status ? (
              <span aria-hidden className={cn("absolute inset-0 flex items-center justify-center", inkBlend(light, status !== null), on)}>
                <Icon className="size-2.5" strokeWidth={2.5} />
              </span>
            ) : null}
          </button>
        }
      />
      <TooltipContent side={chipSide} sideOffset={12} glass>
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
/** The outline on the row or column under the pointer, clipped to the canvas so its outer corners follow the canvas's radius. */
function HoverRing({ level, hover, rows, cols, className, shadow }: { level: "all" | "hue"; hover: { row: number; col: number }; rows: number; cols: number; className?: string; shadow: string }) {
  // The ring spans the canvas edge to edge, so its only rounded corners are the ones in the canvas's own corners;
  // anywhere else it meets a straight edge and stays square.
  const outer = "var(--radius-3xl)";
  const inner = "0px";
  const byRow = level === "all";
  const first = byRow ? hover.row === 0 : hover.col === 0;
  const last = byRow ? hover.row === rows - 1 : hover.col === cols - 1;
  const [a, b] = [first ? outer : inner, last ? outer : inner];
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]", className)}>
      <div
        className={cn("absolute transition-[top,left,border-radius] duration-100", shadow)}
        style={{
          borderRadius: byRow ? `${a} ${a} ${b} ${b}` : `${a} ${b} ${b} ${a}`,
          ...(byRow
            ? { left: 0, right: 0, top: `${(hover.row / rows) * 100}%`, height: `${100 / rows}%` }
            : { top: 0, bottom: 0, left: `${(hover.col / cols) * 100}%`, width: `${100 / cols}%` }),
        }}
      />
    </div>
  );
}

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
