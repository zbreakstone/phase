import { apcaContrastLinear, contrastFromLuminance } from "@/lib/color/contrast";
import type { Overlay } from "@/lib/palette/overlay";
import { targetLuminance } from "@/lib/palette/scale";
import type { ScaleConfig } from "@/lib/palette/types";

/** What a step is measured against under the "Against" setting: its luminance and how to name it. */
export function referenceOf(overlay: Overlay, scale: ScaleConfig): { y: number; name: string; grade: number | null } {
  if (typeof overlay.against === "number") return { y: targetLuminance(scale, overlay.against), name: `step ${overlay.against}`, grade: overlay.against };
  return overlay.against === "black" ? { y: 0, name: "black", grade: null } : { y: 1, name: "white", grade: null };
}

type Reference = ReturnType<typeof referenceOf>;

/** The one number a step shows, following the "Show" setting: luminance, or contrast / APCA against the reference. */
export function stepMetric(overlay: Overlay, y: number, ref: Reference): { header: string; label: string; title?: string; value: string; number: number; decimals: number } {
  if (overlay.metric === "contrast") {
    const n = contrastFromLuminance(ref.y, y);
    return { header: `vs ${ref.name}`, label: `Contrast vs ${ref.name}`, title: `WCAG contrast ratio against ${ref.name}.`, value: n.toFixed(2), number: n, decimals: 2 };
  }
  if (overlay.metric === "apca") {
    // A gray with this luminance stands in for the step, which is all APCA needs from it.
    const n = Math.abs(Math.round(apcaContrastLinear([ref.y, ref.y, ref.y], [y, y, y])));
    return { header: `Lc vs ${ref.name}`, label: `APCA vs ${ref.name}`, title: `APCA lightness contrast with ${ref.name} text.`, value: String(n), number: n, decimals: 0 };
  }
  return { header: "Luminance", label: "Luminance", title: "Relative luminance (WCAG Y): 1 is white, 0 is black.", value: y.toFixed(3), number: y, decimals: 3 };
}

/**
 * The luminance whose shown number is `target`, for the step `grade`. Contrast only grows moving away from the
 * reference, so the search stays on this step's side of it (lighter for a lower grade) and bisects.
 */
export function luminanceFromMetric(overlay: Overlay, target: number, ref: Reference, grade: number): number {
  if (overlay.metric !== "contrast" && overlay.metric !== "apca") return Math.min(1, Math.max(0, target));
  const f = (y: number) => (overlay.metric === "apca" ? Math.abs(apcaContrastLinear([ref.y, ref.y, ref.y], [y, y, y])) : contrastFromLuminance(ref.y, y));
  const lighter = ref.grade === null ? ref.y === 0 : grade < ref.grade;
  let lo = lighter ? ref.y : 0;
  let hi = lighter ? 1 : ref.y;
  const rising = f(hi) > f(lo);
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) < target === rising) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
