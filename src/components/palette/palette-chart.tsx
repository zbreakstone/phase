"use client";

import * as React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Gamut } from "@/lib/color/gamut";
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
const H = 108;
const PAD_X = 10;
const PAD_Y = 12;
const SCALE_MAX = 1000;

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
    });
    if (focused) {
      return [...focused.shades].sort((a, b) => a.grade - b.grade).map((s) => make(s, String(s.grade), String(s.grade), s.grade / SCALE_MAX));
    }
    return generated.flatMap((g, i) => {
      const s = g.shades.find((x) => x.grade === level);
      return s ? [make(s, g.hue.id, g.hue.name || "Unnamed", generated.length > 1 ? i / (generated.length - 1) : 0.5)] : [];
    });
  }, [focused, generated, level, metric, def, gamut]);

  if (points.length === 0) return null;

  // Steps spread by where they sit between white and black; colors spread evenly. Both stay inside the padding.
  const ts = points.map((p) => p.t);
  const tLo = focused ? 0 : Math.min(...ts);
  const tHi = focused ? 1 : Math.max(...ts);
  const xOf = (t: number) => PAD_X + (tHi === tLo ? 0.5 : (t - tLo) / (tHi - tLo)) * (W - PAD_X * 2);

  const top = metric === "lightness" ? 1 : metric === "hue" ? 360 : Math.max(0.1, ...points.flatMap((p) => [p.value, p.limit ?? 0]));
  const yOf = (v: number) => H - PAD_Y - (Math.min(v, top) / top) * (H - PAD_Y * 2);
  const xy = points.map((p) => ({ x: xOf(p.t), y: yOf(p.value) }));
  const line = smooth(xy);
  const showLimit = metric === "chroma";
  const limitPts = showLimit ? points.map((p) => ({ x: xOf(p.t), y: yOf(p.limit ?? top) })) : [];
  const limitLine = smooth(limitPts);
  const hatch = showLimit ? `${limitLine} L${xOf(tHi).toFixed(1)} ${PAD_Y - 4} L${xOf(tLo).toFixed(1)} ${PAD_Y - 4} Z` : "";
  const gradientId = `${patternId}-line`;

  const active = points.find((p) => p.key === hover) ?? (focused && focusGrade !== null ? points.find((p) => p.grade === focusGrade) : null) ?? null;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    setHover(points.reduce((best, p) => (Math.abs(xOf(p.t) - x) < Math.abs(xOf(best.t) - x) ? p : best), points[0]).key);
  };

  return (
    <div className="px-5 pt-4 pb-3">
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
      <svg
        role="img"
        aria-label={`${METRICS.find((m) => m.id === metric)?.label} ${focused ? `of ${focused.hue.name || "this color"} from the lightest step to the darkest` : `of every color at step ${level}`}`}
        viewBox={`0 0 ${W} ${H}`}
        className="mt-1 block h-auto w-full touch-none overflow-visible"
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
        <rect x={PAD_X} y={PAD_Y - 4} width={W - PAD_X * 2} height={H - PAD_Y * 2 + 4} rx={4} className="fill-muted/40" />
        {showLimit ? <path d={hatch} fill={`url(#${patternId}-hatch)`} /> : null}
        {showLimit ? <path d={limitLine} fill="none" className="stroke-foreground/20" strokeWidth={1} /> : null}
        {active ? <line x1={xOf(active.t)} x2={xOf(active.t)} y1={PAD_Y - 4} y2={H - PAD_Y} className="stroke-foreground/25" strokeWidth={1} /> : null}
        <path d={line} fill="none" stroke={`url(#${gradientId})`} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => {
          const on = active?.key === p.key;
          return <circle key={p.key} cx={xy[i].x} cy={xy[i].y} r={on ? 4.5 : 3} fill={p.hex} stroke="white" strokeWidth={on ? 2 : 1.5} />;
        })}
      </svg>
      {!focused ? (
        <p className="mt-1 h-4 truncate font-mono text-[11px] text-muted-foreground tabular-nums">{active ? `${active.label} · ${format(metric, active.value)}` : ""}</p>
      ) : null}
    </div>
  );
}
