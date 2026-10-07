"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { parseHex } from "@/lib/color/convert";
import { readableOn } from "@/lib/color/contrast";
import type { SourceAnalysis } from "@/lib/palette/source";
import type { SourceColor } from "@/lib/palette/types";

interface Props {
  source: SourceColor | null | undefined;
  analysis: SourceAnalysis | null;
  onChange: (source: SourceColor | null) => void;
}

export function SourceEditor({ source, analysis, onChange }: Props) {
  const [draft, setDraft] = React.useState<string | null>(null);
  const hex = source?.hex ?? "";
  const invalid = draft !== null && draft.trim() !== "" && !parseHex(draft);

  const apply = (text: string) => {
    const parsed = parseHex(text);
    if (parsed) {
      onChange({ grade: source?.grade ?? null, pinned: source?.pinned ?? false, hex: parsed });
      setDraft(null);
    } else if (!text.trim()) {
      setDraft(null);
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="base-colour" className="text-xs font-semibold tracking-wide uppercase">
        Base colour
      </Label>
      <div className="flex items-center gap-2">
        <Input
          type="color"
          aria-label="Pick a base colour"
          value={hex || "#3b82f6"}
          onChange={(e) => apply(e.target.value)}
          className="h-8 w-10 shrink-0 cursor-pointer rounded-none p-0.5"
        />
        <Input
          id="base-colour"
          placeholder="Optional, e.g. #3b82f6"
          value={draft ?? hex}
          aria-invalid={invalid ? true : undefined}
          onChange={(e) => {
            setDraft(e.target.value);
            const parsed = parseHex(e.target.value);
            if (parsed) apply(parsed);
          }}
          onBlur={(e) => apply(e.target.value)}
          className="h-8 font-mono text-xs"
        />
        {source ? (
          <Button variant="ghost" size="icon-sm" aria-label="Remove base colour" onClick={() => onChange(null)}>
            <X />
          </Button>
        ) : null}
      </div>
      {invalid ? <p className="text-[11px] text-destructive">Enter a hex colour such as #3b82f6.</p> : null}

      {source && analysis ? (
        <>
          <div className="flex h-12">
            <Block hex={analysis.original.hex} label="You entered" />
            <Block hex={analysis.pinned ? analysis.original.hex : analysis.adjusted.hex} label={analysis.pinned ? "Kept as is" : `Step ${analysis.grade}`} />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {analysis.pinned
              ? analysis.onStep
                ? `Sits on step ${analysis.grade} already.`
                : `Kept exactly on step ${analysis.grade}, ${analysis.shift.toFixed(2)}:1 off its luminance. Rule checks may fail.`
              : analysis.onStep
                ? `Already on step ${analysis.grade}.`
                : `Moved to step ${analysis.grade} by changing lightness only. Hue and chroma are kept.`}
          </p>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="pin" className="text-xs">
              Keep my exact colour
            </Label>
            <Switch id="pin" checked={source.pinned} onCheckedChange={(v) => onChange({ ...source, pinned: v })} />
          </div>
        </>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Enter a colour and the scale is built around it, snapped to the nearest step.
        </p>
      )}
    </div>
  );
}

function Block({ hex, label }: { hex: string; label: string }) {
  return (
    <div className="flex flex-1 flex-col justify-between p-1.5 font-mono text-[10px] leading-tight" style={{ backgroundColor: hex, color: readableOn(hex) }}>
      <span className="font-sans text-[10px] opacity-80">{label}</span>
      <span>{hex}</span>
    </div>
  );
}
