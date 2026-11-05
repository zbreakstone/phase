"use client";

import * as React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type Gamut, toGamutSpace } from "@/lib/color/gamut";
import { maxChromaAt } from "@/lib/color/solve";
import { SPACES, type SpaceId } from "@/lib/color/spaces";
import type { GeneratedHue, Shade } from "@/lib/palette/types";
import { cn } from "@/lib/utils";

type Metric = "lightness" | "chroma" | "hue";

const METRICS: { id: Metric; label: string; title: string }[] = [
  { id: "lightness", label: "Lightness", title: "How light each color looks (OKLCH L)" },
  { id: "chroma", label: "Chroma", title: "How colorful each color is. Hatching marks what the screen can't show." },
  { id: "hue", label: "Hue", title: "Which way each color points around the wheel" },
];

const W = 296;
const H = 128;
const PAD_X = 20;
const PAD_Y = 12;

interface Point {
  key: string;
  label: string;
  /** Position along the line: where a step sits between white and black, or the color's place in the list. */
  t: number;
  hex: string;
  value: number;
  /** The most the screen can show here. Chroma only. */
  limit?: number;
  /** What the curve asked for. Chroma only. */
  asked?: number;
  grade: number | null;
  /** The color in OKLCH, used to find what the screen can show around it. */
  L: number;
  C: number;
  h: number;
}

const NX = 148;
const NY = 90;
const OKLCH = SPACES.oklch;

const xAt = (t: number, lo: number, hi: number) => PAD_X + (hi === lo ? 0.5 : (t - lo) / (hi - lo)) * (W - PAD_X * 2);

/** What the y axis covers for a metric. Hue zooms in on where the colors are so the line has some shape. */
function domainFor(metric: Metric, points: Point[], useLimit = true): [number, number] {
  if (metric === "lightness") return [0, 1];
  if (metric === "chroma") return [0, Math.max(0.1, ...points.flatMap((p) => [p.value, useLimit ? (p.limit ?? 0) : 0]))];
  const hs = points.map((p) => p.value);
  const lo = Math.min(...hs);
  const hi = Math.max(...hs);
  const span = Math.min(360, Math.max(60, (hi - lo) * 1.6));
  const start = Math.min(360 - span, Math.max(0, (lo + hi) / 2 - span / 2));
  return [start, start + span];
}

/** Catmull-Rom through four values, so the area around the line bends the way the line does. */
function spline(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (3 * p1 - p0 - 3 * p2 + p3) * t3);
}

/** How far a color is outside the screen's range: above 0 means it clips. Smooth, so the edge can be traced exactly. */
function overshoot(rgb: [number, number, number], gamut: Gamut): number {
  const c = toGamutSpace(rgb, gamut);
  return Math.max(c[0] - 1, c[1] - 1, c[2] - 1, -c[0], -c[1], -c[2]);
}

/** Where the screen can't show the color: lightness or hue values that clip, given the other two. `fill` is the hatched area, `edge` its traced outline. */
function unreachable(metric: "lightness" | "hue", points: Point[], domain: [number, number], gamut: Gamut): { fill: string; edge: string } {
  const [yMin, yMax] = domain;
  const ts = points.map((p) => p.t);
  const lo = Math.min(...ts);
  const hi = Math.max(...ts);
  const xs = points.map((p) => xAt(p.t, lo, hi));
  const cw = W / NX;
  const ch = H / NY;
  // Hues go the short way round the wheel between neighbors, so 350° to 20° doesn't sweep through every hue.
  const hues = points.map((p) => p.h);
  for (let n = 1; n < hues.length; n++) {
    while (hues[n] - hues[n - 1] > 180) hues[n] -= 360;
    while (hues[n] - hues[n - 1] < -180) hues[n] += 360;
  }
  const vOfY = (y: number) => Math.min(yMax, Math.max(yMin, yMin + ((H - PAD_Y - y) / (H - PAD_Y * 2)) * (yMax - yMin)));
  const f1 = (n: number) => n.toFixed(1);

  // One value per grid corner.
  const grid: number[][] = [];
  for (let i = 0; i <= NX; i++) {
    const x = i * cw;
    let k = 0;
    while (k < xs.length - 2 && x > xs[k + 1]) k++;
    const a = points[k];
    const b = points[Math.min(k + 1, points.length - 1)];
    const f = xs[k + 1] === undefined || xs[k + 1] === xs[k] ? 0 : Math.min(1, Math.max(0, (x - xs[k]) / (xs[k + 1] - xs[k])));
    const before = points[Math.max(0, k - 1)];
    const after = points[Math.min(points.length - 1, k + 2)];
    const L = spline(before.L, a.L, b.L, after.L, f);
    const C = Math.max(0, spline(before.C, a.C, b.C, after.C, f));
    const h = spline(hues[Math.max(0, k - 1)], hues[k], hues[Math.min(k + 1, points.length - 1)], hues[Math.min(points.length - 1, k + 2)], f);
    const col: number[] = [];
    for (let j = 0; j <= NY; j++) {
      const v = vOfY(j * ch);
      col.push(overshoot(metric === "lightness" ? OKLCH.toLinear(v, C, h) : OKLCH.toLinear(L, C, ((v % 360) + 360) % 360), gamut));
    }
    grid.push(col);
  }

  let fill = "";
  let edge = "";
  for (let i = 0; i < NX; i++) {
    let runStart = -1;
    for (let j = 0; j <= NY; j++) {
      const out = j < NY && grid[i][j] + grid[i + 1][j] + grid[i][j + 1] + grid[i + 1][j + 1] > 0;
      if (out && runStart < 0) runStart = j;
      if (!out && runStart >= 0) {
        fill += `M${f1(i * cw)} ${f1(runStart * ch)}h${f1(cw + 0.3)}v${f1((j - runStart) * ch)}h${f1(-cw - 0.3)}z`;
        runStart = -1;
      }
      if (j === NY) continue;
      // Marching squares: where the edge crosses this square, by linear interpolation.
      const v = [grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]];
      const px = [i * cw, (i + 1) * cw, (i + 1) * cw, i * cw];
      const py = [j * ch, j * ch, (j + 1) * ch, (j + 1) * ch];
      const hits: [number, number][] = [];
      for (let e = 0; e < 4; e++) {
        const n = (e + 1) % 4;
        if (v[e] > 0 !== v[n] > 0) {
          const t = v[e] / (v[e] - v[n]);
          hits.push([px[e] + (px[n] - px[e]) * t, py[e] + (py[n] - py[e]) * t]);
        }
      }
      for (let m = 0; m + 1 < hits.length; m += 2) edge += `M${f1(hits[m][0])} ${f1(hits[m][1])}L${f1(hits[m + 1][0])} ${f1(hits[m + 1][1])}`;
    }
  }
  return { fill, edge };
}

const MORPH_MS = 380;
const CROSS_MS = 520;

interface Geo {
  lines: { x: number; y: number }[][];
  /** The dot on each step or color, for the views that show them all at once. */
  dots: { x: number; y: number; hex: string }[];
}

const RESAMPLE = 40;

/** The line's height at `x`, bending the way the drawn curve does. */
function lineY(line: { x: number; y: number }[], x: number): number {
  if (line.length === 0) return 0;
  if (line.length === 1 || x <= line[0].x) return line[0].y;
  let k = 0;
  while (k < line.length - 2 && x > line[k + 1].x) k++;
  const a = line[k];
  const b = line[k + 1];
  const f = b.x === a.x ? 0 : Math.min(1, Math.max(0, (x - a.x) / (b.x - a.x)));
  return spline((line[k - 1] ?? a).y, a.y, b.y, (line[k + 2] ?? b).y, f);
}

/** The same curve as a fixed number of points, so lines with different numbers of stops can be blended. */
function resample(line: { x: number; y: number }[]): { x: number; y: number }[] {
  const x0 = line[0]?.x ?? 0;
  const x1 = line[line.length - 1]?.x ?? 0;
  return Array.from({ length: RESAMPLE }, (_, i) => {
    const x = x0 + ((x1 - x0) * i) / (RESAMPLE - 1);
    return { x, y: lineY(line, x) };
  });
}

const sameShape = (a: Geo, b: Geo) => a.lines.length === b.lines.length && a.lines.every((l, i) => l.length === b.lines[i].length);

const lerpGeo = (a: Geo, b: Geo, k: number): Geo => ({
  lines: b.lines.map((l, i) => l.map((p, j) => ({ x: a.lines[i][j].x + (p.x - a.lines[i][j].x) * k, y: a.lines[i][j].y + (p.y - a.lines[i][j].y) * k }))),
  dots: b.dots,
});

/** Lines that differ in how many stops they have, blended through resampled copies. Line `i` of `b` starts from the nearest line of `a`. */
const lerpAcross = (a: Geo, b: Geo, k: number): Geo => ({
  lines: b.lines.map((l, i) => {
    const from = resample(a.lines[Math.min(i, a.lines.length - 1)] ?? l);
    const to = resample(l);
    return from.map((p, j) => ({ x: p.x + (to[j].x - p.x) * k, y: p.y + (to[j].y - p.y) * k }));
  }),
  dots: b.dots,
});

interface Shown {
  geo: Geo;
  /** While lines of a different shape are blending: how far along, and where they started (for the dots that are leaving). */
  across: { k: number; from: Geo } | null;
}

/** Glides the lines to their new positions when the view changes. Lines of a different shape (a color's steps vs. every color) blend through resampled copies. */
function useMorph(target: Geo | null, calm: boolean): Shown | null {
  const [shown, setShown] = React.useState<Shown | null>(target ? { geo: target, across: null } : null);
  const latest = React.useRef(target);
  React.useEffect(() => {
    const apply = (s: Shown | null, g: Geo | null = s?.geo ?? null) => {
      latest.current = g;
      setShown(s);
    };
    const from = latest.current;
    if (calm || !target || !from || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      apply(target ? { geo: target, across: null } : null);
      return;
    }
    const same = sameShape(from, target);
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / (same ? MORPH_MS : CROSS_MS));
      const k = 1 - Math.pow(1 - t, 3);
      if (t >= 1) apply({ geo: target, across: null });
      else if (same) apply({ geo: lerpGeo(from, target, k), across: null });
      else apply({ geo: lerpAcross(from, target, k), across: { k, from } });
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, calm]);
  return shown;
}

/**
 * Follows `value`, except while `hold` is set, when it stays as it was. Once the hold ends it moves to the latest value
 * and bumps `epoch`, so a crossfade keyed on it can fade between the two instead of tracking every frame in between.
 */
function useSettled<T>(value: T, hold: boolean): { value: T; epoch: number } {
  const [st, setSt] = React.useState({ value, epoch: 0, held: hold });
  if (hold && !st.held) setSt({ ...st, held: true });
  else if (!hold && (st.held || st.value !== value)) setSt({ value, epoch: st.held ? st.epoch + 1 : st.epoch, held: false });
  return { value: st.value, epoch: st.epoch };
}

/** Keeps the previous layer around for a moment so it can fade out while the new one fades in. */
function useCrossfade<T>(value: T, key: string): { current: T; previous: { key: string; value: T } | null } {
  const [state, setState] = React.useState<{ key: string; value: T; previous: { key: string; value: T } | null }>({ key, value, previous: null });
  if (state.key !== key) setState({ key, value, previous: { key: state.key, value: state.value } });
  React.useEffect(() => {
    if (!state.previous) return;
    const t = window.setTimeout(() => setState((s) => ({ ...s, previous: null })), MORPH_MS);
    return () => window.clearTimeout(t);
  }, [state.key, state.previous]);
  return { current: value, previous: state.previous };
}

/** The hatched areas and their outlines for one view. */
function hatchMarks(layer: { cells: { fill: string; edge: string } | null; limit: { line: string; area: string } | null }, patternId: string) {
  return (
    <>
      {layer.limit ? <path d={layer.limit.area} fill={`url(#${patternId}-hatch)`} /> : null}
      {layer.cells ? (
        <>
          <path d={layer.cells.fill} fill={`url(#${patternId}-hatch)`} />
          <path d={layer.cells.edge} fill="none" className="stroke-foreground/15" strokeWidth={1} strokeLinecap="round" />
        </>
      ) : null}
      {layer.limit ? <path d={layer.limit.line} fill="none" className="stroke-foreground/15" strokeWidth={1} /> : null}
    </>
  );
}

/** Short label for the value row. */
function short(metric: Metric, v: number): string {
  if (metric === "lightness") return (v * 100).toFixed(1);
  if (metric === "hue") return v.toFixed(0);
  return v.toFixed(3).replace(/^0/, "");
}

function format(metric: Metric, v: number): string {
  if (metric === "hue") return `${v.toFixed(0)}°`;
  return v.toFixed(metric === "chroma" ? 3 : 2);
}

/** A smooth path through the points (Catmull-Rom turned into Béziers), so a curve reads as a curve. */
/** One dot on the line, placed in chart coordinates. */
function Dot({ x, y, hex, big = false, opacity = 1 }: { x: number; y: number; hex: string; big?: boolean; opacity?: number }) {
  return (
    <span
      aria-hidden
      className={cn("pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-white shadow-(--shadow-border)", big ? "size-3.5" : "size-2.5")}
      style={{ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%`, backgroundColor: hex, opacity }}
    />
  );
}

function smooth(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M${pts[0].x} ${pts[0].y}`;
  let d = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${c1.x.toFixed(1)} ${c1.y.toFixed(1)} ${c2.x.toFixed(1)} ${c2.y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

/**
 * A small chart pinned to the top of the sidebar, like the histogram in a photo editor. With nothing open it
 * runs one line through every color at a single step; open a color and it runs through that color's steps.
 * Hatching marks chroma the screen can't show.
 */
export function PaletteChart({
  generated,
  focusId,
  focusGrade,
  space,
  gamut,
  calm = false,
}: {
  generated: GeneratedHue[];
  /** The data is already gliding on its own (switching palettes), so don't ease between its frames too. */
  focusId: string | null;
  focusGrade: number | null;
  space: SpaceId;
  gamut: Gamut;
  calm?: boolean;
}) {
  const [metric, setMetric] = React.useState<Metric>("chroma");
  const [grade, setGrade] = React.useState<number | "all">(500);
  const [hover, setHover] = React.useState<string | null>(null);
  const patternId = React.useId().replace(/:/g, "");
  const def = SPACES[space];

  const focused = generated.find((g) => g.hue.id === focusId) ?? null;
  const grades = React.useMemo(() => [...new Set(generated.flatMap((g) => g.shades.map((s) => s.grade)))].sort((a, b) => a - b), [generated]);
  const showAll = !focused && grade === "all";
  const target = grade === "all" ? 500 : grade;
  const level = grades.length ? grades.reduce((best, g) => (Math.abs(g - target) < Math.abs(best - target) ? g : best), grades[0]) : target;

  const { points, series } = React.useMemo((): { points: Point[]; series: Point[][] } => {
    const make = (s: Shade, key: string, label: string, t: number): Point => ({
      key,
      label,
      t,
      hex: s.hex,
      grade: s.grade,
      value: metric === "lightness" ? s.oklch.L : metric === "chroma" ? s.chroma : s.hue,
      limit: metric === "chroma" ? (s.limit ?? maxChromaAt(def, s.targetLuminance, s.hue, gamut)) : undefined,
      asked: metric === "chroma" ? s.requestedChroma : undefined,
      L: s.oklch.L,
      C: s.oklch.C,
      h: s.oklch.h,
    });
    const steps = (g: GeneratedHue) =>
      [...g.shades].sort((a, b) => a.grade - b.grade).map((s, i, all) => make(s, String(s.grade), String(s.grade), all.length > 1 ? i / (all.length - 1) : 0.5));
    if (focused) {
      const pts = steps(focused);
      return { points: pts, series: [pts] };
    }
    if (showAll) {
      const all = generated.map(steps);
      return { points: all[0] ?? [], series: all };
    }
    const pts = generated.flatMap((g, i) => {
      const s = g.shades.find((x) => x.grade === level);
      return s ? [make(s, g.hue.id, g.hue.name || "Unnamed", generated.length > 1 ? i / (generated.length - 1) : 0.5)] : [];
    });
    return { points: pts, series: [pts] };
  }, [focused, showAll, generated, level, metric, def, gamut]);

  const domain = React.useMemo(() => (points.length ? domainFor(metric, showAll ? series.flat() : points, !showAll) : ([0, 1] as [number, number])), [metric, points, series, showAll]);
  const hatchCells = React.useMemo(
    () => (points.length && metric !== "chroma" && !showAll ? unreachable(metric, points, domain, gamut) : null),
    [metric, points, domain, gamut, showAll],
  );

  // Steps and colors both spread evenly across the width, inside the padding.
  const scales = React.useMemo(() => {
    const ts = points.map((p) => p.t);
    const tLo = ts.length ? Math.min(...ts) : 0;
    const tHi = ts.length ? Math.max(...ts) : 1;
    const [yMin, yMax] = domain;
    return {
      tLo,
      tHi,
      xOf: (t: number) => xAt(t, tLo, tHi),
      yOf: (v: number) => H - PAD_Y - ((Math.min(Math.max(v, yMin), yMax) - yMin) / (yMax - yMin)) * (H - PAD_Y * 2),
    };
  }, [points, domain]);
  const { tLo, tHi, xOf, yOf } = scales;

  const geo = React.useMemo(
    (): Geo | null =>
      points.length
        ? {
            lines: (showAll ? series : [points]).map((ss) => ss.map((p) => ({ x: xOf(p.t), y: yOf(p.value) }))),
            dots: showAll ? [] : points.map((p) => ({ x: xOf(p.t), y: yOf(p.value), hex: p.hex })),
          }
        : null,
    [points, series, showAll, xOf, yOf],
  );
  const morphed = useMorph(geo, calm);

  const showLimit = metric === "chroma" && !showAll;
  const hatchLayer = React.useMemo(() => {
    let limit: { line: string; area: string } | null = null;
    if (showLimit && points.length) {
      const inner = points.map((p) => ({ x: xOf(p.t), y: yOf(p.limit ?? domain[1]) }));
      const line = smooth([{ x: 0, y: inner[0].y }, ...inner, { x: W, y: inner[inner.length - 1].y }]);
      limit = { line, area: `${line} L${W} 0 L0 0 Z` };
    }
    return { cells: hatchCells, limit };
  }, [showLimit, points, xOf, yOf, domain, hatchCells]);
  // The chroma limit glides with the lines. The hatched cells of the other views can't be blended, so they hold still
  // while the palette glides, then fade to the new ones.
  const settledCells = useSettled(hatchLayer.cells, calm);
  // Only the cells need a crossfade afterwards; the limit has already glided, and fading from its old self would bring the old edge back.
  const settled = { value: { ...hatchLayer, cells: settledCells.value }, epoch: hatchLayer.cells ? settledCells.epoch : 0 };
  const viewKey = `${metric}|${showAll}|${focused?.hue.id ?? ""}|${level}|${settled.epoch}`;
  const fade = useCrossfade(settled.value, viewKey);

  if (points.length === 0 || !geo) return null;
  // Until the glide effect has caught up with a new view, hold its first frame instead of jumping to the end.
  const lagging = !!morphed && !morphed.across && !sameShape(morphed.geo, geo) && morphed.geo !== geo;
  const across = lagging ? { k: 0, from: morphed.geo } : (morphed?.across ?? null);
  const drawn = lagging ? lerpAcross(morphed.geo, geo, 0) : morphed && (morphed.across || sameShape(morphed.geo, geo)) ? morphed.geo : geo;

  const paths = drawn.lines.map((l) => smooth(l));
  const tones = showAll ? series.map((ss) => (ss.find((p) => p.grade === level) ?? ss[Math.floor(ss.length / 2)]).hex) : [];
  const gradientId = `${patternId}-line`;

  const active = points.find((p) => p.key === hover) ?? (focused && focusGrade !== null ? points.find((p) => p.grade === focusGrade) : null) ?? null;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    setHover(points.reduce((best, p) => (Math.abs(xOf(p.t) - x) < Math.abs(xOf(best.t) - x) ? p : best), points[0]).key);
  };

  // Thin the value row so labels never touch: every nth value, and none next to the one you're on.
  const spacing = points.length > 1 ? (W - PAD_X * 2) / (points.length - 1) : W;
  const minGap = 36;
  const stride = Math.max(1, Math.ceil(minGap / spacing));
  const activeIndex = active ? points.findIndex((p) => p.key === active.key) : -1;
  const shown = points.map((_, i) => i === activeIndex || (i % stride === 0 && (activeIndex < 0 || Math.abs(i - activeIndex) * spacing >= minGap)));

  return (
    <div>
      <div className="px-5 pt-3 pb-2">
      <div className="flex items-center justify-between gap-2">
          <div role="group" aria-label="Chart metric" className="-ml-1.5 flex items-center gap-0.5">
            {METRICS.map((m) => (
              <button
                key={m.id}
                type="button"
                title={m.title}
                aria-pressed={metric === m.id}
                onClick={() => setMetric(m.id)}
                className={cn(
                  "rounded-md px-1.5 py-0.5 text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  metric === m.id ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
          {focused ? (
            <p className="min-w-0 truncate font-mono text-[11px] text-muted-foreground tabular-nums">
              {focused.hue.name || "Unnamed"}
              {active ? ` · ${active.label} · ${format(metric, active.value)}` : ""}
            </p>
          ) : (
            <Select
              items={[{ value: "all", label: "All steps" }, ...grades.map((g) => ({ value: String(g), label: `Step ${g}` }))]}
              value={showAll ? "all" : String(level)}
              onValueChange={(v) => v && setGrade(v === "all" ? "all" : Number(v))}
            >
              <SelectTrigger size="sm" aria-label="Step shown" className="h-6 w-auto gap-1 border-0 bg-transparent px-1.5 font-mono text-[11px] shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="all">All steps</SelectItem>
                {grades.map((g) => (
                  <SelectItem key={g} value={String(g)}>
                    Step {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>
      <div className="animate-in fade-in relative duration-300">
      <svg
        role="img"
        aria-label={`${METRICS.find((m) => m.id === metric)?.label} ${focused ? `of ${focused.hue.name || "this color"} from the lightest step to the darkest` : showAll ? "of every color at every step" : `of every color at step ${level}`}`}
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full touch-none"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <pattern id={`${patternId}-hatch`} width={4} height={4} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1={0} y1={0} x2={0} y2={4} className="stroke-foreground/15" strokeWidth={1} />
          </pattern>
          <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1={xOf(tLo)} x2={xOf(tHi)} y1={0} y2={0}>
            {points.map((p) => (
              <stop key={p.key} offset={tHi === tLo ? 0.5 : (p.t - tLo) / (tHi - tLo)} stopColor={p.hex} />
            ))}
          </linearGradient>
        </defs>
        <rect x={0} y={0} width={W} height={H} className="fill-muted/40" />
        {fade.previous ? (
          <g key={`prev-${fade.previous.key}`} className="animate-out fade-out-0 fill-mode-forwards duration-300">
            {hatchMarks(fade.previous.value, patternId)}
          </g>
        ) : null}
        <g key={viewKey} className="animate-in fade-in fill-mode-backwards duration-300">
          {hatchMarks(fade.current, patternId)}
        </g>
        {active ? <line x1={xOf(active.t)} x2={xOf(active.t)} y1={0} y2={H} className="stroke-foreground/25" strokeWidth={1} /> : null}
        {showAll ? (
          series.map((ss, n) => <path key={generated[n]?.hue.id ?? n} d={paths[n]} fill="none" stroke={tones[n]} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />)
        ) : (
          <path d={paths[0]} fill="none" stroke={`url(#${gradientId})`} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
      {across ? (
        <>
          {across.from.dots.map((d, n) => (
            <Dot key={`from-${n}`} x={d.x} y={lineY(drawn.lines[0], d.x)} hex={d.hex} opacity={1 - across.k} />
          ))}
          {geo.dots.map((d, n) => (
            <Dot key={`to-${n}`} x={d.x} y={lineY(drawn.lines[0], d.x)} hex={d.hex} opacity={across.k} />
          ))}
        </>
      ) : (
        (showAll ? (activeIndex >= 0 ? series.map((ss, n) => ({ p: ss[activeIndex], at: drawn.lines[n][activeIndex] })) : []) : points.map((p, i) => ({ p, at: drawn.lines[0][i] }))).map(({ p, at }, n) => (
          <Dot key={`${n}-${p.key}`} x={at.x} y={at.y} hex={p.hex} big={!showAll && active?.key === p.key} />
        ))
      )}
      {!focused && active ? (
        <p className="pointer-events-none absolute top-1.5 left-2 max-w-[60%] truncate rounded-md bg-white/80 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground tabular-nums dark:bg-black/60">
          {active.label}
        </p>
      ) : null}
      </div>
      <div
        aria-hidden
        className="h-0.5"
        style={{ background: `linear-gradient(to right, ${points.map((p) => `${p.hex} ${((xOf(p.t) / W) * 100).toFixed(1)}%`).join(", ")})` }}
      />
      <div className="relative h-7" aria-hidden>
        {points.map((p, i) => shown[i] && (
          <span
            key={p.key}
            className={cn(
              "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-[10px] tabular-nums transition-colors",
              active?.key === p.key ? "font-medium text-foreground" : "text-muted-foreground",
            )}
            style={{ left: `${(xOf(p.t) / W) * 100}%` }}
          >
            {showAll ? p.label : short(metric, p.value)}
          </span>
        ))}
      </div>
    </div>
  );
}
