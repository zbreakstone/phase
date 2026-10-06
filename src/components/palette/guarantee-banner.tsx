"use client";

import { ShieldAlert, ShieldCheck } from "lucide-react";
import type { ContrastRule } from "@/lib/palette/types";
import type { PaletteReport } from "@/lib/palette/validate";
import { cn } from "@/lib/utils";

interface Props {
  report: PaletteReport;
  rules: ContrastRule[];
  hueCount: number;
}

export function GuaranteeBanner({ report, rules, hueCount }: Props) {
  const sorted = [...rules].sort((a, b) => a.minDiff - b.minDiff);
  const ok = report.failures.length === 0;
  const first = report.failures[0];
  return (
    <div
      role="status"
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-1.5 border px-3 py-2 text-sm",
        ok ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100" : "border-red-500/50 bg-red-500/10 text-red-100",
      )}
    >
      {ok ? <ShieldCheck className="size-4 shrink-0 text-emerald-400" /> : <ShieldAlert className="size-4 shrink-0 text-red-400" />}
      <p className="font-medium">
        {ok
          ? "Magic-number guarantee holds"
          : `${report.failures.length} pair${report.failures.length === 1 ? "" : "s"} break the rule`}
      </p>
      <p className="text-xs opacity-80">
        {ok
          ? `${report.pairsChecked.toLocaleString()} pairs checked across ${hueCount} hue${hueCount === 1 ? "" : "s"}, including every cross-hue combination${report.tightestMargin !== null ? `. Tightest clears its target by ${((report.tightestMargin - 1) * 100).toFixed(1)}%.` : "."}`
          : `${first.fgHue} ${first.fgGrade} on ${first.bgHue} ${first.bgGrade} is ${first.ratio.toFixed(2)}:1 but needs ${first.required}:1. Out of ${report.pairsChecked.toLocaleString()} checked.`}
      </p>
      <div className="ml-auto flex flex-wrap gap-1">
        {sorted.length === 0 ? (
          <span className="text-xs opacity-80">No rules set</span>
        ) : (
          sorted.map((r) => (
            <span key={r.id} className="border border-current/30 px-1.5 py-0.5 font-mono text-[11px]">
              {r.minDiff}+ → {r.ratio}:1
            </span>
          ))
        )}
      </div>
    </div>
  );
}
