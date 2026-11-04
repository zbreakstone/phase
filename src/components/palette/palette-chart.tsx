"use client";

import * as React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Gamut } from "@/lib/color/gamut";
import { inGamut, maxChromaAt } from "@/lib/color/solve";
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
const H = 108;
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

const NX = 120;
const NY = 72;
const OKLCH = SPACES.oklch;

const xAt = (t: number, lo: number, hi: number) => PAD_X + (hi === lo ? 0.5 : (t - lo) / (hi - lo)) * (W - PAD_X * 2);

/** What the y axis covers for a metric. Hue zooms in on where the colors are so the line has some shape. */
function domainFor(metric: Metric, points: Point[]): [number, number] {
  if (metric === "lightness") return [0, 1];
  if (metric === "chroma") return [0, Math.max(0.1, ...points.flatMap((p) => [p.value, p.limit ?? 0]))];
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

/** Where the screen can't show the color: lightness or hue values that clip, given the other two. `fill` is the hatched area, `edge` its outline. */
function unreachable(metric: "lightness" | "hue", points: Point[], domain: [number, number], gamut: Gamut): { fill: string; edge: string } {
  const [yMin, yMax] = domain;
  const ts = points.map((p) => p.t);
  const lo = Math.min(...ts);
  const hi = Math.max(...ts);
  const xs = points.map((p) => xAt(p.t, lo, hi));
  const cw = W / NX;
  const vOfY = (y: number) => Math.min(yMax, Math.max(yMin, yMin + ((H - PAD_Y - y) / (H - PAD_Y * 2)) * (yMax - yMin)));
  const f1 = (n: number) => n.toFixed(1);
  let fill = "";
  let edge = "";
  let prev: number[] = [];
  for (let i = 0; i < NX; i++) {
    const x = (i + 0.5) * cw;
    let k = 0;
    while (k < xs.length - 2 && x > xs[k + 1]) k++;
    const a = points[k];
    const b = points[Math.min(k + 1, points.length - 1)];
    const f = xs[k + 1] === undefined || xs[k + 1] === xs[k] ? 0 : Math.min(1, Math.max(0, (x - xs[k]) / (xs[k + 1] - xs[k])));
    const before = points[Math.max(0, k - 1)];
    const after = points[Math.min(points.length - 1, k + 2)];
    const L = spline(before.L, a.L, b.L, after.L, f);
    const C = Math.max(0, spline(before.C, a.C, b.C, after.C, f));
    const h = spline(before.h, a.h, b.h, after.h, f);
    const out = (y: number) => {
      const v = vOfY(y);
      const rgb = metric === "lightness" ? OKLCH.toLinear(v, C, h) : OKLCH.toLinear(L, C, ((v % 360) + 360) % 360);
      return !inGamut(rgb, gamut);
    };
    // Sample down the column, then pin each in/out change to a fraction of a pixel.
    const ys: number[] = [];
    let runStart: number | null = null;
    let last = out(0);
    if (last) runStart = 0;
    for (let j = 1; j <= NY; j++) {
      const y = (j / NY) * H;
      const now = out(y);
      if (now !== last) {
        let ya = ((j - 1) / NY) * H;
        let yb = y;
        for (let n = 0; n < 6; n++) {
          const mid = (ya + yb) / 2;
          if (out(mid) === last) ya = mid;
          else yb = mid;
        }
        const edgeY = (ya + yb) / 2;
        ys.push(edgeY);
        if (now) runStart = edgeY;
        else if (runStart !== null) {
          fill += `M${f1(i * cw)} ${f1(runStart)}h${f1(cw + 0.3)}v${f1(edgeY - runStart)}h${f1(-cw - 0.3)}z`;
          runStart = null;
        }
        last = now;
      }
    }
    if (runStart !== null) fill += `M${f1(i * cw)} ${f1(runStart)}h${f1(cw + 0.3)}v${f1(H - runStart)}h${f1(-cw - 0.3)}z`;
    // Join each change to the nearest one in the previous column, so the outline reads as a line.
    if (i > 0) {
      for (const y of ys) {
        let best: number | null = null;
        for (const p of prev) if (best === null || Math.abs(p - y) < Math.abs(best - y)) best = p;
        if (best !== null && Math.abs(best - y) < 14) edge += `M${f1(x - cw)} ${f1(best)}L${f1(x)} ${f1(y)}`;
      }
    }
    prev = ys;
  }
  return { fill, edge };
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
}: {
  generated: GeneratedHue[];
  focusId: string | null;
  focusGrade: number | null;
  space: SpaceId;
  gamut: Gamut;
}) {
  const [metric, setMetric] = React.useState<Metric>("chroma");
  const [grade, setGrade] = React.useState(500);
  const [hover, setHover] = React.useState<string | null>(null);
  const patternId = React.useId().replace(/:/g, "");
  const def = SPACES[space];

  const focused = generated.find((g) => g.hue.id === focusId) ?? null;
  const grades = React.useMemo(() => [...new Set(generated.flatMap((g) => g.shades.map((s) => s.grade)))].sort((a, b) => a - b), [generated]);
  const level = grades.length ? grades.reduce((best, g) => (Math.abs(g - grade) < Math.abs(best - grade) ? g : best), grades[0]) : grade;

  const points: Point[] = React.useMemo(() => {
    const make = (s: Shade, key: string, label: string, t: number): Point => ({
      key,
      label,
      t,
      hex: s.hex,
      grade: s.grade,
      value: metric === "lightness" ? s.oklch.L : metric === "chroma" ? s.chroma : s.hue,
      limit: metric === "chroma" ? maxChromaAt(def, s.targetLuminance, s.hue, gamut) : undefined,
      asked: metric === "chroma" ? s.requestedChroma : undefined,
      L: s.oklch.L,
      C: s.oklch.C,
      h: s.oklch.h,
    });
    if (focused) {
      return [...focused.shades].sort((a, b) => a.grade - b.grade).map((s, i, all) => make(s, String(s.grade), String(s.grade), all.length > 1 ? i / (all.length - 1) : 0.5));
    }
    return generated.flatMap((g, i) => {
      const s = g.shades.find((x) => x.grade === level);
      return s ? [make(s, g.hue.id, g.hue.name || "Unnamed", generated.length > 1 ? i / (generated.length - 1) : 0.5)] : [];
    });
  }, [focused, generated, level, metric, def, gamut]);

  const domain = React.useMemo(() => (points.length ? domainFor(metric, points) : ([0, 1] as [number, number])), [metric, points]);
  const hatchCells = React.useMemo(
    () => (points.length && metric !== "chroma" ? unreachable(metric, points, domain, gamut) : null),
    [metric, points, domain, gamut],
  );

  if (points.length === 0) return null;

  // Steps spread by where they sit between white and black; colors spread evenly. Both stay inside the padding.
  const ts = points.map((p) => p.t);
  const tLo = Math.min(...ts);
  const tHi = Math.max(...ts);
  const xOf = (t: number) => xAt(t, tLo, tHi);

  const [yMin, yMax] = domain;
  const top = yMax;
  const yOf = (v: number) => H - PAD_Y - ((Math.min(Math.max(v, yMin), yMax) - yMin) / (yMax - yMin)) * (H - PAD_Y * 2);
  const xy = points.map((p) => ({ x: xOf(p.t), y: yOf(p.value) }));
  const line = smooth(xy);
  const showLimit = metric === "chroma";
  const limitInner = showLimit ? points.map((p) => ({ x: xOf(p.t), y: yOf(p.limit ?? top) })) : [];
  const limitPts = limitInner.length ? [{ x: 0, y: limitInner[0].y }, ...limitInner, { x: W, y: limitInner[limitInner.length - 1].y }] : [];
  const limitLine = smooth(limitPts);
  const hatch = showLimit ? `${limitLine} L${W} 0 L0 0 Z` : "";
  const gradientId = `${patternId}-line`;

  const active = points.find((p) => p.key === hover) ?? (focused && focusGrade !== null ? points.find((p) => p.grade === focusGrade) : null) ?? null;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    setHover(points.reduce((best, p) => (Math.abs(xOf(p.t) - x) < Math.abs(xOf(best.t) - x) ? p : best), points[0]).key);
  };

  return (
    <div>
      <svg
        role="img"
        aria-label={`${METRICS.find((m) => m.id === metric)?.label} ${focused ? `of ${focused.hue.name || "this color"} from the lightest step to the darkest` : `of every color at step ${level}`}`}
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full touch-none"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <pattern id={`${patternId}-hatch`} width={4} height={4} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1={0} y1={0} x2={0} y2={4} className="stroke-foreground/30" strokeWidth={1} />
          </pattern>
          <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1={xOf(tLo)} x2={xOf(tHi)} y1={0} y2={0}>
            {points.map((p) => (
              <stop key={p.key} offset={tHi === tLo ? 0.5 : (p.t - tLo) / (tHi - tLo)} stopColor={p.hex} />
            ))}
          </linearGradient>
        </defs>
        <rect x={0} y={0} width={W} height={H} className="fill-muted/40" />
        {showLimit ? <path d={hatch} fill={`url(#${patternId}-hatch)`} /> : null}
        {hatchCells ? (
          <>
            <path d={hatchCells.fill} fill={`url(#${patternId}-hatch)`} />
            <path d={hatchCells.edge} fill="none" className="stroke-foreground/35" strokeWidth={1} strokeLinecap="round" />
          </>
        ) : null}
        {showLimit ? <path d={limitLine} fill="none" className="stroke-foreground/40" strokeWidth={1} /> : null}
        {active ? <line x1={xOf(active.t)} x2={xOf(active.t)} y1={0} y2={H - PAD_Y} className="stroke-foreground/25" strokeWidth={1} /> : null}
        <path d={line} fill="none" stroke={`url(#${gradientId})`} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => {
          const on = active?.key === p.key;
          return <circle key={p.key} cx={xy[i].x} cy={xy[i].y} r={on ? 4.5 : 3} fill={p.hex} stroke="white" strokeWidth={on ? 2 : 1.5} />;
        })}
      </svg>
      <div
        aria-hidden
        className="h-0.5"
        style={{ background: `linear-gradient(to right, ${points.map((p) => `${p.hex} ${((xOf(p.t) / W) * 100).toFixed(1)}%`).join(", ")})` }}
      />
      <div className="relative h-7 bg-muted/30" aria-hidden>
        {points.map((p) => (
          <span
            key={p.key}
            className={cn(
              "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-[10px] tabular-nums transition-colors",
              active?.key === p.key ? "font-medium text-foreground" : "text-muted-foreground",
            )}
            style={{ left: `${(xOf(p.t) / W) * 100}%` }}
          >
            {short(metric, p.value)}
          </span>
        ))}
      </div>
      <div className="px-5 pt-2 pb-3">
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
            <Select items={grades.map((g) => ({ value: String(g), label: `Step ${g}` }))} value={String(level)} onValueChange={(v) => v && setGrade(Number(v))}>
              <SelectTrigger size="sm" aria-label="Step shown" className="h-6 w-auto gap-1 border-0 bg-transparent px-1.5 font-mono text-[11px] shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {grades.map((g) => (
                  <SelectItem key={g} value={String(g)}>
                    Step {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        {!focused ? (
          <p className="mt-1 h-4 truncate font-mono text-[11px] text-muted-foreground tabular-nums">{active ? `${active.label} · ${format(metric, active.value)}` : ""}</p>
        ) : null}
      </div>
    </div>
  );
}
