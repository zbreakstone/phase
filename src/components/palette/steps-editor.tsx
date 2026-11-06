"use client";

import * as React from "react";
import { ChevronDown, Ellipsis, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Overlay } from "@/lib/palette/overlay";
import { targetLuminance } from "@/lib/palette/scale";
import type { ScaleConfig } from "@/lib/palette/types";
import { midpointGrade } from "@/lib/palette/steps";
import { CollapsibleSection } from "./panel-section";
import { referenceOf, stepMetric } from "./step-metric";
import { StepMenu, type StepHeaderActions } from "./step-header";
import { StepTarget, clearStepTarget, hasTargetOverrides, isStepOverridden, resetTargets, setStepTarget } from "./scale-settings";

/**
 * The scale's steps, one per row: name, luminance target and contrast against white. Click a row to adjust its
 * target; the "..." menu renames, adds after, or deletes it. White (0) and black (1000) always bookend the scale.
 */
export function StepsEditor({ actions, scale, onScale, overlay }: { actions: StepHeaderActions; scale: ScaleConfig; onScale: (scale: ScaleConfig) => void; overlay: Overlay }) {
  const { grades } = actions;
  const ref = referenceOf(overlay, scale);
  const [editing, setEditing] = React.useState<number | null>(null);

  // The header "+" drops a new step into the widest gap, so the scale stays evenly filled.
  const addInWidestGap = () => {
    const edges = [0, ...grades, 1000];
    let best: [number, number] | null = null;
    for (let i = 0; i < edges.length - 1; i++) {
      if (midpointGrade(edges[i], edges[i + 1]) !== null && (best === null || edges[i + 1] - edges[i] > best[1] - best[0])) best = [edges[i], edges[i + 1]];
    }
    if (best) actions.onAddStep(best[0], best[1]);
  };

  return (
    <CollapsibleSection
      id="steps"
      title="Steps"
      className="space-y-2"
    >
      <p className="text-[11px] text-muted-foreground">
        Shared by every color. Each step has a luminance target: how bright it is between white and black. Open one to adjust it within what your contrast rules allow.
      </p>
      <div className="grid grid-cols-[1fr_6rem_1.5rem] gap-2 px-0 text-[10px] text-muted-foreground">
        <span>Step</span>
        <span className="text-right" title={stepMetric(overlay, 0.5, ref).title}>{stepMetric(overlay, 0.5, ref).header}</span>
        <span />
      </div>
      <ul>
        {grades.map((grade, i) => {
          const next = grades[i + 1] ?? 1000;
          const y = targetLuminance(scale, grade);
          const open = editing === grade;
          return (
            <li key={grade} className="-mx-2 rounded-lg px-2 font-mono text-sm tabular-nums hover:bg-muted/60">
              <div className="grid grid-cols-[1fr_6rem_1.5rem] items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(open ? null : grade)}
                  aria-expanded={open}
                  aria-label={`Luminance target for step ${grade}`}
                  className="col-span-2 -mx-2 grid min-h-8 grid-cols-subgrid items-center rounded-lg px-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex items-center gap-1.5">
                    {grade}
                    {isStepOverridden(scale, grade) ? <span aria-hidden title="Adjusted" className="size-1.5 rounded-full bg-foreground/60" /> : null}
                    <ChevronDown aria-hidden className={`size-3 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
                  </span>
                  <span className="text-right text-xs text-muted-foreground">{grade === ref.grade ? "—" : stepMetric(overlay, y, ref).value}</span>
                </button>
                <StepMenu
                  grade={grade}
                  actions={actions}
                  addBefore={next}
                  trigger={
                    <button
                      type="button"
                      aria-label={`Step ${grade} options`}
                      className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      <Ellipsis className="size-4" />
                    </button>
                  }
                />
              </div>
              {open ? (
                <div className="space-y-2 pb-2">
                  <StepTarget overlay={overlay} scale={scale} grade={grade} onChange={(y) => onScale(setStepTarget(scale, grade, y))} />
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
      <Button variant="ghost" size="sm" className="-ml-2" disabled={actions.stepLimit === "max"} title={actions.stepLimit === "max" ? "A scale can have at most 16 steps." : undefined} onClick={addInWidestGap}>
        <Plus />
        Add step
      </Button>
      {hasTargetOverrides(scale) ? (
        <Button variant="ghost" size="sm" onClick={() => onScale(resetTargets(scale))}>
          <RotateCcw />
          Reset all targets
        </Button>
      ) : null}
    </CollapsibleSection>
  );
}
