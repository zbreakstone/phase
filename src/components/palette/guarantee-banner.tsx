"use client";

import { ShieldAlert, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { PaletteReport } from "@/lib/palette/validate";
import type { ContrastRule } from "@/lib/palette/types";

interface Props {
  report: PaletteReport;
  rules: ContrastRule[];
  hueCount: number;
}

export function GuaranteeBanner({ report, rules, hueCount }: Props) {
  const sorted = [...rules].sort((a, b) => a.minDiff - b.minDiff);
  const ok = report.failures.length === 0;
  return (
    <Alert
      variant={ok ? "default" : "destructive"}
      className={ok ? "border-emerald-600/30 bg-emerald-50 text-emerald-950" : undefined}
    >
      {ok ? <ShieldCheck className="text-emerald-700" /> : <ShieldAlert />}
      <AlertTitle className="text-sm">
        {ok
          ? "Magic-number guarantee holds across every hue"
          : `${report.failures.length} shade pair${report.failures.length === 1 ? "" : "s"} break the magic-number rule`}
      </AlertTitle>
      <AlertDescription className={ok ? "text-emerald-900/80" : undefined}>
        <p>
          {ok
            ? `Checked ${report.pairsChecked.toLocaleString()} shade pairs across ${hueCount} hue${hueCount === 1 ? "" : "s"}, including every cross-hue combination.`
            : `Out of ${report.pairsChecked.toLocaleString()} pairs checked. First failure: ${report.failures[0].fgHue} ${report.failures[0].fgGrade} on ${report.failures[0].bgHue} ${report.failures[0].bgGrade} is ${report.failures[0].ratio.toFixed(2)}:1 but needs ${report.failures[0].required}:1.`}
          {ok && report.tightestMargin !== null
            ? ` Tightest pair clears its target by ${((report.tightestMargin - 1) * 100).toFixed(1)}%.`
            : ""}
        </p>
        {sorted.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {sorted.map((r) => (
              <Badge key={r.id} variant="outline" className="bg-background/70 font-mono text-[11px]">
                {r.minDiff}+ apart = {r.ratio}:1
              </Badge>
            ))}
          </div>
        ) : (
          <p className="mt-1">No rules are defined, so nothing is being enforced. Add one under Scale and rules.</p>
        )}
      </AlertDescription>
    </Alert>
  );
}
