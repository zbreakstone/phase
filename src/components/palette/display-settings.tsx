"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Against, Metric, Overlay } from "@/lib/palette/overlay";
import { PanelSection, SettingRow } from "./panel-section";
import type { SquareMode } from "./palette-square";

export type Panel = "curves" | "report" | "targets";

interface Props {
  overlay: Overlay;
  onOverlay: (o: Overlay) => void;
  mode: SquareMode;
  onMode: (m: SquareMode) => void;
  grain: boolean;
  onGrain: (on: boolean) => void;
  /** The one panel open under the square, if any. */
  panel: Panel | null;
  onPanel: (p: Panel | null) => void;
  curvesDisabled: boolean;
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
  { id: "curves", label: "Curves" },
  { id: "report", label: "Contrast report" },
  { id: "targets", label: "Luminance targets" },
];

/** How the square is drawn, what's printed on it, and which secondary panel sits under it. Shown at every level of the sidebar. */
export function DisplaySettings({ overlay, onOverlay, mode, onMode, grain, onGrain, panel, onPanel, curvesDisabled }: Props) {
  const printsContrast = overlay.metric === "contrast" || overlay.metric === "apca";
  return (
    <PanelSection className="space-y-3">
      <h2 className="text-sm font-semibold">Display</h2>
      <SettingRow label="Square">
        <ToggleGroup value={[mode]} onValueChange={(v) => v[0] && onMode(v[0] as SquareMode)} variant="outline" size="sm" spacing={0} aria-label="How the square is drawn">
          <ToggleGroupItem value="smooth">Smooth</ToggleGroupItem>
          <ToggleGroupItem value="cells">Cells</ToggleGroupItem>
        </ToggleGroup>
      </SettingRow>
      {mode === "smooth" ? (
        <SettingRow id="display-grain" label="Grain">
          <Switch id="display-grain" checked={grain} onCheckedChange={onGrain} />
        </SettingRow>
      ) : null}
      <SettingRow id="display-metric" label="Show">
        <Select items={METRICS.map((m) => ({ value: m.id, label: m.label }))} value={overlay.metric} onValueChange={(v) => v && onOverlay({ ...overlay, metric: v as Metric })}>
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
        <SettingRow id="display-against" label={overlay.metric === "apca" ? "Text color" : "Against"}>
          <Select items={AGAINST.map((m) => ({ value: m.id, label: m.label }))} value={overlay.against} onValueChange={(v) => v && onOverlay({ ...overlay, against: v as Against })}>
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
        <Select items={PANELS.map((m) => ({ value: m.id, label: m.label }))} value={panel ?? "none"} onValueChange={(v) => onPanel(!v || v === "none" ? null : (v as Panel))}>
          <SelectTrigger id="display-panel" size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PANELS.map((m) => (
              <SelectItem key={m.id} value={m.id} disabled={m.id === "curves" && curvesDisabled}>
                {m.label}
                {m.id === "curves" && curvesDisabled ? <span className="ml-1 text-[11px] text-muted-foreground">open a color first</span> : null}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>
    </PanelSection>
  );
}
