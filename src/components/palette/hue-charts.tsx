"use client";

import * as React from "react";
import { GAMUTS, type Gamut, cssColor } from "@/lib/color/gamut";
import { maxChromaAt } from "@/lib/color/solve";
import { SPACES, type SpaceId } from "@/lib/color/spaces";
import { curveAt, positionFor } from "@/lib/palette/curve";
import { targetLuminance } from "@/lib/palette/scale";
import type { GeneratedHue, ScaleConfig } from "@/lib/palette/types";

const W = 360;
const H = 200;
const PAD = { l: 34, r: 12, t: 22, b: 38 };
const PLOT_W = W - PAD.l - PAD.r;
const PLOT_H = H - PAD.t - PAD.b;
const DENSE = 48;

interface ChartProps {
  generated: GeneratedHue;
  scale: ScaleConfig;
  space: SpaceId;
  gamut: Gamut;
}

function xFor(t: number) {
  return PAD.l + t * PLOT_W;
}

function gradeAxis(grades: number[], sorted: number[]) {
  return grades.map((g) => ({ g, x: xFor(positionFor(g, sorted)) }));
}

export function HueCurveChart({ generated, scale, space, gamut }: ChartProps) {
  const hue = generated.hue;
  const def = SPACES[space];
  const sorted = [...scale.grades].sort((a, b) => a - b);

  const samples = React.useMemo(() => {
    const out: { t: number; h: number }[] = [];
    let prev = curveAt(def, hue, 0, generated.anchor).hue;
    for (let i = 0; i <= DENSE; i++) {
      const t = i / DENSE;
      const raw = curveAt(def, hue, t, generated.anchor).hue;
      let d = normalize(raw) - normalize(prev);
      while (d > 180) d -= 360;
      while (d < -180) d += 360;
      prev = prev + d;
      out.push({ t, h: prev });
    }
    return out;
  }, [def, hue, generated.anchor]);

  const unwrappedAt = (t: number) => {
    const i = Math.min(DENSE, Math.max(0, Math.round(t * DENSE)));
    return samples[i].h;
  };
  const values = samples.map((s) => s.h);
  const lo = Math.min(...values, hue.hueLight);
  const hi = Math.max(...values, hue.hueLight);
  const span = Math.max(hi - lo, 30);
  const mid = (hi + lo) / 2;
  const yMin = mid - span * 0.75;
  const yMax = mid + span * 0.75;
  const yFor = (h: number) => PAD.t + (1 - (h - yMin) / (yMax - yMin)) * PLOT_H;

  const ticks = niceTicks(yMin, yMax, 5);
  const path = samples.map((s, i) => `${i === 0 ? "M" : "L"}${xFor(s.t).toFixed(1)},${yFor(s.h).toFixed(1)}`).join(" ");
  const start = samples[0].h;
  const end = samples[samples.length - 1].h;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Hue curve for ${hue.name}: ${Math.round(normalize(start))} degrees at the lightest shade to ${Math.round(normalize(end))} degrees at the darkest`}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.l} x2={W - PAD.r} y1={yFor(t)} y2={yFor(t)} className="stroke-border" strokeWidth={1} />
          <text x={PAD.l - 6} y={yFor(t) + 3} textAnchor="end" className="fill-muted-foreground text-[10px]">
            {Math.round(normalize(t))}°
          </text>
        </g>
      ))}
      <line x1={PAD.l} x2={W - PAD.r} y1={yFor(hue.hueLight)} y2={yFor(hue.hueLight)} className="stroke-muted-foreground/60" strokeDasharray="4 4" />
      <text x={W - PAD.r} y={yFor(hue.hueLight) - 4} textAnchor="end" className="fill-muted-foreground text-[10px]">
        no shift: stays {Math.round(hue.hueLight)}°
      </text>
      <path d={path} fill="none" className="stroke-foreground" strokeWidth={2.5} strokeLinecap="round" />
      {generated.shades
        .filter((s) => !s.anchor)
        .map((s) => {
          const t = positionFor(s.grade, sorted);
          const h = unwrappedAt(t);
          return s.isSource ? (
            <g key={s.grade}>
              <rect x={xFor(t) - 8} y={yFor(h) - 8} width={16} height={16} transform={`rotate(45 ${xFor(t)} ${yFor(h)})`} fill={cssColor(s.hex, s.linear, gamut)} className="stroke-foreground" strokeWidth={2.5} />
              <text x={xFor(t)} y={yFor(h) + 24} textAnchor="middle" className="fill-foreground stroke-background text-[10px] font-semibold" strokeWidth={4} paintOrder="stroke">
                Source · {s.grade}
              </text>
            </g>
          ) : (
            <circle key={s.grade} cx={xFor(t)} cy={yFor(h)} r={5} fill={cssColor(s.hex, s.linear, gamut)} className="stroke-foreground" strokeWidth={1.25} />
          );
        })}
      <EndpointMarker x={xFor(0)} y={yFor(start)} above={yFor(samples[4].h) >= yFor(start)} label={`Lightest end: ${Math.round(normalize(start))}°`} anchor="start" color={endpointColor(generated.shades.find((s) => !s.anchor), gamut)} />
      <EndpointMarker x={xFor(1)} y={yFor(end)} above={yFor(samples[DENSE - 4].h) >= yFor(end)} label={`Darkest end: ${Math.round(normalize(end))}°`} anchor="end" color={endpointColor([...generated.shades].reverse().find((s) => !s.anchor), gamut)} />
      {gradeAxis(sorted, sorted).map(({ g, x }) => (
        <text key={g} x={x} y={H - 20} textAnchor="middle" className="fill-muted-foreground font-mono text-[10px]">
          {g}
        </text>
      ))}
      <text x={PAD.l + PLOT_W / 2} y={H - 4} textAnchor="middle" className="fill-muted-foreground text-[10px]">
        Grade, lightest to darkest
      </text>
    </svg>
  );
}

function endpointColor(shade: GeneratedHue["shades"][number] | undefined, gamut: Gamut) {
  return shade ? cssColor(shade.hex, shade.linear, gamut) : undefined;
}

function EndpointMarker({ x, y, label, anchor, color, above }: { x: number; y: number; label: string; anchor: "start" | "end"; color?: string; above: boolean }) {
  const lx = anchor === "start" ? x - 6 : x + 6;
  const ly = above ? y - 16 : y + 24;
  return (
    <g>
      <circle cx={x} cy={y} r={9} fill={color ?? "currentColor"} className="stroke-foreground" strokeWidth={3} />
      <text x={lx} y={ly} textAnchor={anchor} className="fill-foreground stroke-background text-[11px] font-semibold" strokeWidth={4} paintOrder="stroke">
        {label}
      </text>
    </g>
  );
}

function normalize(h: number) {
  return ((h % 360) + 360) % 360;
}

function niceTicks(min: number, max: number, count: number): number[] {
  const raw = (max - min) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) out.push(v);
  return out;
}

export function ChromaChart({ generated, scale, space, gamut }: ChartProps) {
  const def = SPACES[space];
  const hue = generated.hue;
  const sorted = [...scale.grades].sort((a, b) => a - b);

  const model = React.useMemo(() => {
    const dense = Array.from({ length: DENSE + 1 }, (_, i) => {
      const t = i / DENSE;
      const grade = sorted[0] + (sorted[sorted.length - 1] - sorted[0]) * t;
      const want = curveAt(def, hue, t, generated.anchor);
      const y = targetLuminance(scale, grade);
      return { t, requested: want.chroma, available: maxChromaAt(def, y, want.hue, gamut) };
    });
    return dense;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def, gamut, hue, generated.anchor, scale.grades, scale.luminanceMode, scale.customLuminance]);

  const peak = Math.max(...model.map((m) => Math.max(m.requested, m.available)), def.chroma.max * 0.25);
  const yMax = niceCeil(Math.min(peak * 1.1, def.chroma.max * 1.5));
  const yFor = (c: number) => PAD.t + (1 - Math.min(c, yMax) / yMax) * PLOT_H;
  const line = (key: "requested" | "available") =>
    model.map((m, i) => `${i === 0 ? "M" : "L"}${xFor(m.t).toFixed(1)},${yFor(m[key]).toFixed(1)}`).join(" ");
  const area =
    model.map((m, i) => `${i === 0 ? "M" : "L"}${xFor(m.t).toFixed(1)},${yFor(m.available).toFixed(1)}`).join(" ") +
    ` L${xFor(1)},${PAD.t} L${xFor(0)},${PAD.t} Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * yMax);
  const patternId = React.useId().replace(/:/g, "");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Chroma against grade for ${hue.name}, with the area outside the ${GAMUTS[gamut].label} gamut shaded`}>
      <defs>
        <pattern id={patternId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" className="fill-muted" />
          <line x1="0" y1="0" x2="0" y2="6" className="stroke-muted-foreground/40" strokeWidth={2} />
        </pattern>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.l} x2={W - PAD.r} y1={yFor(t)} y2={yFor(t)} className="stroke-border" />
          <text x={PAD.l - 6} y={yFor(t) + 3} textAnchor="end" className="fill-muted-foreground text-[10px]">
            {t.toFixed(def.chroma.decimals > 1 ? 2 : 0)}
          </text>
        </g>
      ))}
      <path d={area} fill={`url(#${patternId})`} />
      <path d={line("available")} fill="none" className="stroke-muted-foreground" strokeWidth={1.5} />
      <text x={W - PAD.r - 4} y={PAD.t + 12} textAnchor="end" className="fill-muted-foreground text-[10px]">
        outside {GAMUTS[gamut].label}: not displayable
      </text>
      <path d={line("requested")} fill="none" className="stroke-foreground" strokeWidth={2.5} strokeLinecap="round" />
      {generated.shades
        .filter((s) => !s.anchor)
        .map((s) => {
          const t = positionFor(s.grade, sorted);
          return (
            <g key={s.grade}>
              {s.isSource ? (
                <rect x={xFor(t) - 8} y={yFor(s.requestedChroma) - 8} width={16} height={16} transform={`rotate(45 ${xFor(t)} ${yFor(s.requestedChroma)})`} fill={cssColor(s.hex, s.linear, gamut)} className="stroke-foreground" strokeWidth={2.5} />
              ) : (
                <circle cx={xFor(t)} cy={yFor(s.requestedChroma)} r={5} fill={cssColor(s.hex, s.linear, gamut)} className={s.clipped ? "stroke-red-500" : "stroke-foreground"} strokeWidth={s.clipped ? 2.25 : 1.25} />
              )}
              {s.clipped ? <line x1={xFor(t)} x2={xFor(t)} y1={yFor(s.requestedChroma)} y2={yFor(s.chroma)} className="stroke-red-500" strokeWidth={1.5} strokeDasharray="2 2" /> : null}
            </g>
          );
        })}
      {gradeAxis(sorted, sorted).map(({ g, x }) => (
        <text key={g} x={x} y={H - 20} textAnchor="middle" className="fill-muted-foreground font-mono text-[10px]">
          {g}
        </text>
      ))}
      <text x={PAD.l + PLOT_W / 2} y={H - 4} textAnchor="middle" className="fill-muted-foreground text-[10px]">
        Grade, lightest to darkest
      </text>
    </svg>
  );
}

function niceCeil(v: number): number {
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / mag;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * mag;
}
