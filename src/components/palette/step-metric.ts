import { apcaContrastLinear, contrastFromLuminance } from "@/lib/color/contrast";
import type { Overlay } from "@/lib/palette/overlay";

/** The one number a step shows, following the "Show" setting: luminance, or contrast / APCA against white or black. */
export function stepMetric(overlay: Overlay, y: number): { header: string; label: string; title?: string; value: string; number: number; decimals: number } {
  const edge = overlay.against === "black" ? 0 : 1;
  const edgeName = edge === 0 ? "black" : "white";
  if (overlay.metric === "contrast") {
    const n = contrastFromLuminance(edge, y);
    return { header: `vs ${edgeName}`, label: `Contrast vs ${edgeName}`, title: `WCAG contrast ratio against ${edgeName}.`, value: n.toFixed(2), number: n, decimals: 2 };
  }
  if (overlay.metric === "apca") {
    // A gray with this luminance stands in for the step, which is all APCA needs from it.
    const gray: [number, number, number] = [y, y, y];
    const n = Math.abs(Math.round(apcaContrastLinear([edge, edge, edge], gray)));
    return { header: `Lc vs ${edgeName}`, label: `APCA vs ${edgeName}`, title: `APCA lightness contrast with ${edgeName} text.`, value: String(n), number: n, decimals: 0 };
  }
  return { header: "Luminance", label: "Luminance", title: "Relative luminance (WCAG Y): 1 is white, 0 is black.", value: y.toFixed(3), number: y, decimals: 3 };
}

/** The luminance whose shown number is `target`: the metrics all move one way along luminance, so bisect. */
export function luminanceFromMetric(overlay: Overlay, target: number): number {
  if (overlay.metric !== "contrast" && overlay.metric !== "apca") return Math.min(1, Math.max(0, target));
  const f = (y: number) => (overlay.metric === "apca" ? Math.abs(apcaContrastLinear([overlay.against === "black" ? 0 : 1, overlay.against === "black" ? 0 : 1, overlay.against === "black" ? 0 : 1], [y, y, y])) : stepMetric(overlay, y).number);
  const rising = f(1) > f(0);
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) < target === rising) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
