"use client";

import { Check, ChevronDown, TriangleAlert } from "lucide-react";
import { cssColor, GAMUTS, type Gamut } from "@/lib/color/gamut";
import type { ContrastRule } from "@/lib/palette/types";
import type { Failure, PaletteReport } from "@/lib/palette/validate";

interface Props {
  report: PaletteReport;
  rules: ContrastRule[];
  gamut: Gamut;
  /** The swatches show APCA Lc, so say the rules above are still WCAG 2 ratios. */
  showApcaNote?: boolean;
  onSelect: (hueId: string, grade: number) => void;
}

function Chip({ shade, gamut }: { shade: Failure["fg"]; gamut: Gamut }) {
  return <span className="inline-block size-4 shrink-0 border border-white/20" style={{ background: cssColor(shade.hex, shade.linear, gamut) }} />;
}

/** Plain-language contrast check, with every failing pair listed and clickable. */
export function ContrastReport({ report, rules, gamut, showApcaNote, onSelect }: Props) {
  const { failures } = report;
  if (rules.length === 0) {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Check className="size-3.5 text-emerald-400" /> No contrast rules are set.
      </p>
    );
  }
  const ruleText = rules.map((r) => `${r.minDiff}+ apart reach ${r.ratio}:1`).join(", ");
  const apcaNote = showApcaNote ? (
    <span className="basis-full pl-5.5">Swatches show APCA Lc (informational); the rules above are WCAG 2 ratios.</span>
  ) : null;
  if (failures.length === 0) {
    return (
      <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
        <Check className="size-3.5 text-emerald-400" /> WCAG 2: any two steps {ruleText}, for every hue.
        {apcaNote}
      </p>
    );
  }
  const sorted = [...failures].sort((a, b) => a.ratio / a.required - b.ratio / b.required);
  return (
    <details className="group text-xs" open>
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-2 gap-y-1 text-red-300">
        <TriangleAlert className="size-3.5" />
        <span>
          {failures.length} pair{failures.length === 1 ? "" : "s"} miss the WCAG 2 contrast rules ({ruleText}).
        </span>
        <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
      </summary>
      <p className="mt-1 text-muted-foreground">
        {showApcaNote ? "Swatches show APCA Lc (informational); this list uses WCAG 2 ratios. " : null}Measured on the colours as shown in {GAMUTS[gamut].label}, so switching gamut can change this list. Click a row to select the lighter swatch.
      </p>
      <ul className="mt-2 max-h-56 divide-y divide-border overflow-y-auto border border-border">
        {sorted.map((f, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => onSelect(f.fgHueId, f.fg.grade)}
              className="flex w-full flex-wrap items-center gap-x-2 gap-y-1 px-2 py-1.5 text-left hover:bg-muted/50"
            >
              <Chip shade={f.fg} gamut={gamut} />
              <span>
                {f.fgHue} {f.fg.grade}
              </span>
              <span className="text-muted-foreground">on</span>
              <Chip shade={f.bg} gamut={gamut} />
              <span>
                {f.bgHue} {f.bg.grade}
              </span>
              <span className="ml-auto tabular-nums text-red-300">
                {f.ratio.toFixed(2)}:1 <span className="text-muted-foreground">needs {f.required}:1</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
