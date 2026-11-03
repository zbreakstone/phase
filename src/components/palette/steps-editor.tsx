"use client";

import { Plus, Trash2 } from "lucide-react";
import { midpointGrade } from "@/lib/palette/steps";
import { CollapsibleSection } from "./panel-section";
import { StepMenu, type StepHeaderActions } from "./step-header";

/**
 * The scale's step names, one per row. Click a name to rename it; the trash on a row deletes the
 * step, and the "+" adds a step halfway to the next one. White (0) and black (1000) always bookend the scale.
 */
export function StepsEditor({ actions }: { actions: StepHeaderActions }) {
  const { grades } = actions;
  return (
    <CollapsibleSection id="steps" title="Steps" className="space-y-2 pt-2">
      <p className="text-[11px] text-muted-foreground">
        Shared by every color. The number is where a step sits between white and
        black.
      </p>
      <ul>
        {grades.map((grade, i) => {
          const next = grades[i + 1] ?? 1000;
          const mid = midpointGrade(grade, next);
          return (
            <li
              key={grade}
              className="group/step -mx-2 flex items-center justify-between rounded-lg px-2 py-0.5 font-mono text-sm tabular-nums hover:bg-muted"
            >
              <StepMenu grade={grade} actions={actions} />
              <div className="flex items-center">
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
            </li>
          );
        })}
      </ul>
    </CollapsibleSection>
  );
}
