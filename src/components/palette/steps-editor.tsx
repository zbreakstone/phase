"use client";

import * as React from "react";
import { ChevronDown, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { contrastFromLuminance } from "@/lib/color/contrast";
import { targetLuminance } from "@/lib/palette/scale";
import type { ScaleConfig } from "@/lib/palette/types";
import { midpointGrade } from "@/lib/palette/steps";
import { CollapsibleSection } from "./panel-section";
import { StepMenu, type StepHeaderActions } from "./step-header";
import { StepTarget, clearStepTarget, hasTargetOverrides, isStepOverridden, resetTargets, setStepTarget } from "./scale-settings";

/**
 * The scale's step names, one per row. Click a name to rename it; the trash on a row deletes the
 * step, and the "+" adds a step halfway to the next one. White (0) and black (1000) always bookend the scale.
 */
export function StepsEditor({ actions, scale, onScale }: { actions: StepHeaderActions; scale: ScaleConfig; onScale: (scale: ScaleConfig) => void }) {
  const { grades } = actions;
  const [editing, setEditing] = React.useState<number | null>(null);
  return (
    <CollapsibleSection id="steps" title="Steps" count={grades.length} className="space-y-2 pt-2">
      <p className="text-[11px] text-muted-foreground">
        Shared by every color. Each step has a luminance target: how bright it is between white and black. Open one to adjust it within what your contrast rules allow.
      </p>
      <ul>
        {grades.map((grade, i) => {
          const next = grades[i + 1] ?? 1000;
          const mid = midpointGrade(grade, next);
          return (
            <li key={grade} className="-mx-2 rounded-lg px-2 font-mono text-sm tabular-nums hover:bg-muted/60">
              <div className="group/step flex items-center justify-between py-0.5">
              <StepMenu grade={grade} actions={actions} />
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => setEditing(editing === grade ? null : grade)}
                  aria-expanded={editing === grade}
                  aria-label={`Luminance target for step ${grade}`}
                  className="mr-1 flex h-6 items-center gap-1 rounded-md px-1.5 text-xs text-muted-foreground hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {isStepOverridden(scale, grade) ? <span aria-hidden className="size-1.5 rounded-full bg-foreground/60" /> : null}
                  {contrastFromLuminance(1, targetLuminance(scale, grade)).toFixed(2)}
                  <ChevronDown aria-hidden className={`size-3 transition-transform ${editing === grade ? "rotate-180" : ""}`} />
                </button>
                <button
                  type="button"
                  disabled={actions.stepLimit === "min"}
                  onClick={() => actions.onRemoveStep(grade)}
                  aria-label={`Delete step ${grade}`}
                  title={
                    actions.stepLimit === "min"
                      ? "A scale needs at least 3 steps."
                      : `Delete step ${grade}`
                  }
                  className="flex size-6 items-center justify-center rounded-md text-muted-foreground/0 group-hover/step:text-muted-foreground hover:bg-background hover:text-destructive focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-0"
                >
                  <Trash2 className="size-3.5" />
                </button>
                <button
                  type="button"
                  disabled={actions.stepLimit === "max" || mid === null}
                  onClick={() => actions.onAddStep(grade, next)}
                  aria-label={
                    mid === null
                      ? `No room after ${grade}`
                      : `Add step ${mid}, between ${grade} and ${next}`
                  }
                  title={
                    actions.stepLimit === "max"
                      ? "A scale can have at most 16 steps."
                      : mid === null
                        ? undefined
                        : `Add step ${mid}`
                  }
                  className="flex size-6 items-center justify-center rounded-md text-muted-foreground/0 group-hover/step:text-muted-foreground hover:bg-background hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-0"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
              </div>
              {editing === grade ? (
                <div className="space-y-2 pb-2">
                  <StepTarget scale={scale} grade={grade} onChange={(y) => onScale(setStepTarget(scale, grade, y))} />
                  {isStepOverridden(scale, grade) ? (
                    <Button variant="ghost" size="xs" onClick={() => onScale(clearStepTarget(scale, grade))}>
                      <RotateCcw />
                      Reset step {grade}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {hasTargetOverrides(scale) ? (
        <Button variant="ghost" size="sm" onClick={() => onScale(resetTargets(scale))}>
          <RotateCcw />
          Reset all targets
        </Button>
      ) : null}
    </CollapsibleSection>
  );
}
