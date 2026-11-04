"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Against, Metric, Overlay } from "@/lib/palette/overlay";
import { CollapsibleSection, SettingRow } from "./panel-section";

export type Panel = "report";

interface Props {
  overlay: Overlay;
  onOverlay: (o: Overlay) => void;
  /** The one panel open under the square, if any. */
  panel: Panel | null;
  onPanel: (p: Panel | null) => void;
  /** Render just the rows, to sit inside another section. */
  bare?: boolean;
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

const PANELS: { id: Panel | "none"; label: string }[] = [
  { id: "none", label: "None" },
  { id: "report", label: "Contrast report" },
];

/** How the square is drawn, what's printed on it, and which secondary panel sits under it. Shown at every level of the sidebar. */
export function DisplaySettings({
  overlay,
  onOverlay,
  panel,
  onPanel,
  bare,
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
      <SettingRow id="display-panel" label="Below">
        <Select
          items={PANELS.map((m) => ({ value: m.id, label: m.label }))}
          value={panel ?? "none"}
          onValueChange={(v) =>
            onPanel(!v || v === "none" ? null : (v as Panel))
          }
        >
          <SelectTrigger id="display-panel" size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PANELS.map((m) => (
              <SelectItem
                key={m.id}
                value={m.id}
              >
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>
    </>
  );
  if (bare) return rows;
  return (
    <CollapsibleSection id="display" title="Display" className="space-y-3">
      {rows}
    </CollapsibleSection>
  );
}
