"use client";

import * as React from "react";
import { CircleHelp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function HelpTip({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label="More information"
            className="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          />
        }
      >
        <CircleHelp className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent className="max-w-64 text-balance">{children}</TooltipContent>
    </Tooltip>
  );
}

interface SliderFieldProps {
  id: string;
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  decimals?: number;
  unit?: string;
  onChange: (value: number) => void;
  trackStyle?: React.CSSProperties;
  className?: string;
  startLabel?: string;
  endLabel?: string;
}

/** A labelled slider paired with a number input, with an optional gradient guide above the track. */
export function SliderField({
  id,
  label,
  hint,
  value,
  min,
  max,
  step,
  decimals = 0,
  unit,
  onChange,
  trackStyle,
  className,
  startLabel,
  endLabel,
}: SliderFieldProps) {
  const [draft, setDraft] = React.useState<string | null>(null);
  const shown = draft ?? value.toFixed(decimals);

  const commit = (raw: string) => {
    const n = Number(raw);
    if (raw.trim() !== "" && Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
    setDraft(null);
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="flex items-center gap-1.5 text-sm">
          {label}
          {hint ? <HelpTip>{hint}</HelpTip> : null}
        </Label>
        <div className="flex items-center gap-1">
          <Input
            id={id}
            type="number"
            inputMode="decimal"
            min={min}
            max={max}
            step={step}
            value={shown}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit((e.target as HTMLInputElement).value);
            }}
            className="h-7 w-20 px-2 text-right font-mono text-xs tabular-nums"
          />
          {unit ? <span className="w-3 text-xs text-muted-foreground">{unit}</span> : null}
        </div>
      </div>
      {trackStyle ? (
        <div
          aria-hidden
          className="h-2.5 w-full rounded-full ring-1 ring-black/10"
          style={trackStyle}
        />
      ) : null}
      <Slider
        aria-label={label}
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : v)}
      />
      {startLabel || endLabel ? (
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>{startLabel}</span>
          <span>{endLabel}</span>
        </div>
      ) : null}
    </div>
  );
}

export function SectionHeading({
  id,
  eyebrow,
  title,
  children,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div id={id} className="scroll-mt-20 space-y-1">
      {eyebrow ? (
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{eyebrow}</p>
      ) : null}
      <h2 className="text-xl font-semibold tracking-tight text-balance">{title}</h2>
      {children ? <p className="max-w-3xl text-sm text-muted-foreground text-pretty">{children}</p> : null}
    </div>
  );
}
