"use client";

import * as React from "react";
import { Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { wcagLevel } from "@/lib/color/contrast";
import type { ContrastRule, GeneratedHue } from "@/lib/palette/types";
import { buildMatrix, type MatrixCell } from "@/lib/palette/validate";
import { cn } from "@/lib/utils";

interface Props {
  generated: GeneratedHue[];
  rules: ContrastRule[];
  selectedHueId: string | null;
}

type Metric = "wcag" | "apca";

function apcaTier(lc: number): string {
  const a = Math.abs(lc);
  if (a >= 90) return "bg-emerald-100 text-emerald-950";
  if (a >= 75) return "bg-emerald-50 text-emerald-900";
  if (a >= 60) return "bg-amber-50 text-amber-900";
  if (a >= 45) return "bg-orange-50 text-orange-900";
  return "bg-muted/60 text-muted-foreground";
}

export function ContrastMatrix({ generated, rules, selectedHueId }: Props) {
  const [fgId, setFgId] = React.useState<string | null>(null);
  const [bgId, setBgId] = React.useState<string | null>(null);
  const [metric, setMetric] = React.useState<Metric>("wcag");

  const fallback = selectedHueId ?? generated[0]?.hue.id ?? null;
  const fg = generated.find((g) => g.hue.id === fgId) ?? generated.find((g) => g.hue.id === fallback) ?? generated[0];
  const bg = generated.find((g) => g.hue.id === bgId) ?? fg;

  const matrix = React.useMemo(() => (fg && bg ? buildMatrix(fg.shades, bg.shades, rules) : []), [fg, bg, rules]);
  const counts = React.useMemo(() => {
    const flat = matrix.flat();
    return {
      pass: flat.filter((c) => c.status === "pass").length,
      fail: flat.filter((c) => c.status === "fail").length,
      none: flat.filter((c) => c.status === "none").length,
    };
  }, [matrix]);

  if (!fg || !bg) return null;
  const items = generated.map((g) => ({ value: g.hue.id, label: g.hue.name }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="fg-hue" className="text-sm">
            Text colour (rows)
          </Label>
          <Select items={items} value={fg.hue.id} onValueChange={(v) => setFgId(v as string)}>
            <SelectTrigger id="fg-hue" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {items.map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bg-hue" className="text-sm">
            Background (columns)
          </Label>
          <Select items={items} value={bg.hue.id} onValueChange={(v) => setBgId(v as string)}>
            <SelectTrigger id="bg-hue" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {items.map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Metric</Label>
          <ToggleGroup
            value={[metric]}
            onValueChange={(v) => v[0] && setMetric(v[0] as Metric)}
            variant="outline"
            spacing={0}
            aria-label="Contrast metric"
          >
            <ToggleGroupItem value="wcag">WCAG 2 ratio</ToggleGroupItem>
            <ToggleGroupItem value="apca">APCA Lc</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {metric === "wcag" ? (
          <>
            <Legend tone="pass" label={`Pass: meets its rule (${counts.pass})`} />
            <Legend tone="fail" label={`Fail: breaks its rule (${counts.fail})`} />
            <Legend tone="none" label={`No rule at this gap (${counts.none})`} />
          </>
        ) : (
          <p className="text-muted-foreground">
            APCA is informational. It depends on which colour is text, so the magic-number guarantee is only defined for WCAG 2. Lc 75+ suits body text, 60+ large text, 45+ headlines.
          </p>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[720px] border-collapse text-center">
          <caption className="sr-only">
            Contrast of {fg.hue.name} text on {bg.hue.name} backgrounds
          </caption>
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-background p-1.5 text-left text-[11px] font-normal text-muted-foreground">text ↓ / bg →</th>
              {bg.shades.map((s) => (
                <th key={s.grade} scope="col" className="p-1.5">
                  <div className="mx-auto flex flex-col items-center gap-1">
                    <span className="size-4 rounded ring-1 ring-black/15" style={{ backgroundColor: s.hex }} />
                    <span className="font-mono text-xs font-medium tabular-nums">{s.grade}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, i) => (
              <tr key={fg.shades[i].grade}>
                <th scope="row" className="sticky left-0 z-10 bg-background p-1.5 text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="size-4 rounded ring-1 ring-black/15" style={{ backgroundColor: fg.shades[i].hex }} />
                    <span className="font-mono text-xs font-medium tabular-nums">{fg.shades[i].grade}</span>
                  </div>
                </th>
                {row.map((cell) => (
                  <Cell key={cell.bg.grade} cell={cell} metric={metric} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Legend({ tone, label }: { tone: "pass" | "fail" | "none"; label: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1",
        tone === "pass" && "border-emerald-600/40 bg-emerald-50 text-emerald-900",
        tone === "fail" && "border-red-600/40 bg-red-50 text-red-900",
      )}
    >
      {tone === "pass" ? <Check /> : tone === "fail" ? <X /> : null}
      {label}
    </Badge>
  );
}

function Cell({ cell, metric }: { cell: MatrixCell; metric: Metric }) {
  const text = metric === "wcag" ? cell.ratio.toFixed(cell.ratio >= 10 ? 1 : 2) : Math.abs(cell.apca).toFixed(0);
  const tone =
    metric === "wcag"
      ? cell.status === "pass"
        ? "bg-emerald-50 text-emerald-900"
        : cell.status === "fail"
          ? "bg-red-100 text-red-900 outline-2 -outline-offset-2 outline-red-600"
          : "bg-muted/50 text-muted-foreground"
      : apcaTier(cell.apca);

  return (
    <td className="p-0.5">
      <Tooltip>
        <TooltipTrigger
          render={
            <div
              tabIndex={0}
              className={cn("flex h-11 flex-col items-center justify-center rounded-md px-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none", tone)}
              data-status={cell.status}
            />
          }
        >
          <span className="flex items-center gap-0.5 font-mono text-xs font-medium tabular-nums">
            {metric === "wcag" && cell.status === "pass" ? <Check className="size-3" aria-label="Pass" /> : null}
            {metric === "wcag" && cell.status === "fail" ? <X className="size-3" aria-label="Fail" /> : null}
            {text}
          </span>
          <span className="rounded-sm px-1 text-[10px] leading-4 font-semibold" style={{ backgroundColor: cell.bg.hex, color: cell.fg.hex }}>
            Aa
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-0.5 text-xs">
            <p className="font-semibold">
              {cell.fg.grade} on {cell.bg.grade} <span className="font-normal">(gap {cell.diff})</span>
            </p>
            <p>
              WCAG 2: {cell.ratio.toFixed(2)}:1 · {wcagLevel(cell.ratio)}
            </p>
            <p>APCA: Lc {cell.apca.toFixed(1)}</p>
            <p>
              {cell.required === null
                ? "No magic-number rule covers this gap."
                : cell.status === "pass"
                  ? `Meets the rule: ${cell.diff}+ apart needs ${cell.required}:1.`
                  : `Breaks the rule: needs ${cell.required}:1.`}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </td>
  );
}
