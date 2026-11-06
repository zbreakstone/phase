"use client";

import type * as React from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Against, Metric, Overlay } from "@/lib/palette/overlay";
import { CollapsibleSection, SettingRow } from "./panel-section";

interface Props {
  overlay: Overlay;
  onOverlay: (o: Overlay) => void;
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

const AGAINST: { id: Against; label: string }[] = [
  { id: "white", label: "White" },
  { id: "black", label: "Black" },
  { id: "selected", label: "Open step" },
];

/** How the square is drawn, what's printed on it. Shown at every level of the sidebar. */
export function DisplaySettings({
  overlay,
  onOverlay,
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
            items={AGAINST.map((m) => ({ value: m.id, label: m.label }))}
            value={overlay.against}
            onValueChange={(v) =>
              v && onOverlay({ ...overlay, against: v as Against })
            }
          >
            <SelectTrigger id="display-against" size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AGAINST.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.label}
                </SelectItem>
              ))}
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
