"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { midpointGrade, parseStepName, type StepBlock } from "@/lib/palette/steps";

export interface StepHeaderActions {
  /** Set when the scale is already at its largest (`max`) or smallest (`min`) size. */
  stepLimit: Extract<StepBlock, "max" | "min"> | null;
  /** Every step name in use, so a rename can't collide. */
  grades: number[];
  onAddStep: (lower: number, upper: number) => void;
  onRemoveStep: (grade: number) => void;
  onRenameStep: (from: number, to: number) => void;
}

/**
 * A column's step number, and everything you can do to that step. Hovering the gap on its left edge
 * offers a "+" that adds the step halfway to the previous column; clicking the number renames or
 * deletes it. White (0) and black (1000) always bookend the scale, so they get the "+" but nothing else.
 */
export function StepHeader({
  grade,
  previous,
  editable,
  actions,
}: {
  grade: number;
  previous: number | null;
  editable: boolean;
  actions: StepHeaderActions;
}) {
  const mid = previous === null ? null : midpointGrade(previous, grade);

  return (
    <div className="relative pb-1.5 text-center font-mono text-[11px] text-muted-foreground tabular-nums">
      {previous !== null && mid !== null ? (
        <div className="group/add absolute top-0 left-0 z-20 flex h-5 w-6 -translate-x-1/2 items-center justify-center">
          <button
            type="button"
            disabled={actions.stepLimit === "max"}
            onClick={() => actions.onAddStep(previous, grade)}
            aria-label={`Add step ${mid}, between ${previous} and ${grade}`}
            title={actions.stepLimit === "max" ? "A scale can have at most 16 steps." : `Add step ${mid}`}
            className="flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-sm transition-opacity group-hover/add:opacity-100 hover:scale-110 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:bg-muted disabled:text-muted-foreground disabled:hover:scale-100"
          >
            <Plus className="size-3" />
          </button>
        </div>
      ) : null}
      {editable ? <StepMenu grade={grade} actions={actions} /> : <span className="px-1">{grade}</span>}
    </div>
  );
}

export function StepMenu({ grade, actions }: { grade: number; actions: StepHeaderActions }) {
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState(String(grade));
  const result = parseStepName(text, actions.grades, grade);
  const changed = result.ok && result.grade !== grade;

  const apply = () => {
    if (result.ok && result.grade !== grade) {
      setOpen(false);
      actions.onRenameStep(grade, result.grade);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setText(String(grade));
      }}
    >
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={`Step ${grade} options`}
            className="-ml-1 rounded-sm px-1 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          />
        }
      >
        {grade}
      </PopoverTrigger>
      <PopoverContent align="center" className="w-60">
        <PopoverHeader>
          <PopoverTitle>Step {grade}</PopoverTitle>
          <PopoverDescription className="text-xs">The number is also where it sits between white and black.</PopoverDescription>
        </PopoverHeader>
        <form
          className="space-y-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            apply();
          }}
        >
          <label htmlFor={`step-name-${grade}`} className="text-xs font-medium">
            Step name
          </label>
          <div className="flex gap-2">
            <Input
              id={`step-name-${grade}`}
              value={text}
              inputMode="numeric"
              aria-invalid={result.ok ? undefined : true}
              onChange={(e) => setText(e.target.value)}
              onFocus={(e) => e.target.select()}
              className="h-8 font-mono text-xs md:text-xs"
            />
            <Button type="submit" size="sm" disabled={!changed}>
              Rename
            </Button>
          </div>
          {!result.ok ? <p className="text-[11px] text-destructive">{result.error}</p> : null}
        </form>
        <div className="space-y-1 border-t border-border pt-2.5">
          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            disabled={actions.stepLimit === "min"}
            onClick={() => {
              setOpen(false);
              actions.onRemoveStep(grade);
            }}
          >
            <Trash2 />
            Delete step
          </Button>
          {actions.stepLimit === "min" ? <p className="text-[11px] text-muted-foreground">A scale needs at least 3 steps.</p> : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
