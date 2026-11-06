"use client";

import type * as React from "react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Against, Metric, Overlay } from "@/lib/palette/overlay";
import { CollapsibleSection, SettingRow } from "./panel-section";

interface Props {
  overlay: Overlay;
  onOverlay: (o: Overlay) => void;
  /** The palette's steps, any of which contrast can be measured against. */
  grades: number[];
  /** Render just the rows, to sit inside another section. */
  bare?: boolean;
  /** Extra content at the end of the section, such as a delete button. */
  extra?: React.ReactNode;
}

const METRICS: { id: Metric; label: string }[] = [
  { id: "contrast", label: "Contrast" },
  { id: "apca", label: "APCA" },
  { id: "luminance", label: "Luminance" },
  { id: "off", label: "Nothing" },
];

const EDGES: { id: string; label: string }[] = [
  { id: "white", label: "White" },
  { id: "black", label: "Black" },
];
// Select values are strings, so a step travels as "step-500".
const toValue = (a: Against) => (typeof a === "number" ? `step-${a}` : a);
const fromValue = (v: string): Against => (v.startsWith("step-") ? Number(v.slice(5)) : (v as Against));

/** How the square is drawn, what's printed on it. Shown at every level of the sidebar. */
export function DisplaySettings({
  overlay,
  onOverlay,
  grades,
  bare,
  extra,
}: Props) {
  const printsContrast =
    overlay.metric === "contrast" || overlay.metric === "apca";
  const rows = (
    <>
      <SettingRow id="display-metric" label="Show">
        <Select
          items={METRICS.map((m) => ({ value: m.id, label: m.label }))}
          value={overlay.metric}
          onValueChange={(v) =>
            v && onOverlay({ ...overlay, metric: v as Metric })
          }
        >
          <SelectTrigger id="display-metric" size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {METRICS.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>
      {printsContrast ? (
        <SettingRow
          id="display-against"
          label={overlay.metric === "apca" ? "Text color" : "Against"}
        >
          <Select
            items={[...EDGES.map((m) => ({ value: m.id, label: m.label })), ...grades.map((g) => ({ value: `step-${g}`, label: `Step ${g}` }))]}
            value={toValue(overlay.against)}
            onValueChange={(v) =>
              v && onOverlay({ ...overlay, against: fromValue(v as string) })
            }
          >
            <SelectTrigger id="display-against" size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EDGES.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.label}
                </SelectItem>
              ))}
              <SelectSeparator />
              {/* Each color is measured against its own copy of the step. */}
              <SelectGroup className="p-0">
                <SelectLabel>Color step</SelectLabel>
                {grades.map((g) => (
                  <SelectItem key={g} value={`step-${g}`}>
                    {g}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </SettingRow>
      ) : null}
    </>
  );
  if (bare) return rows;
  return (
    <CollapsibleSection id="display" title="Settings" className="space-y-3">
      {rows}
      {extra}
    </CollapsibleSection>
  );
}
