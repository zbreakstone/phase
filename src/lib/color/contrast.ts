import { hexToLinear, luminanceOfLinear } from "./convert";

export function relativeLuminance(hex: string): number {
  return luminanceOfLinear(hexToLinear(hex));
}

/** WCAG 2 contrast ratio between two relative luminances. */
export function contrastFromLuminance(y1: number, y2: number): number {
  const hi = Math.max(y1, y2);
  const lo = Math.min(y1, y2);
  return (hi + 0.05) / (lo + 0.05);
}

export function wcagContrast(hexA: string, hexB: string): number {
  return contrastFromLuminance(relativeLuminance(hexA), relativeLuminance(hexB));
}

/** Luminance a colour must have to hit `ratio` against `y` (lighter side). */
export function luminanceForRatio(y: number, ratio: number, lighter: boolean) {
  return lighter ? ratio * (y + 0.05) - 0.05 : (y + 0.05) / ratio - 0.05;
}

/* APCA (SAPC 0.0.98G-4g constants). Output is Lc, signed by polarity. */
const APCA = {
  normBG: 0.56,
  normTXT: 0.57,
  revTXT: 0.62,
  revBG: 0.65,
  blkThrs: 0.022,
  blkClmp: 1.414,
  scale: 1.14,
  loOffset: 0.027,
  loClip: 0.1,
  deltaYmin: 0.0005,
};

function apcaY(hex: string): number {
  const [r, g, b] = hexToLinearGamma(hex);
  return 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
}

function hexToLinearGamma(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) =>
    Math.pow(v / 255, 2.4),
  ) as [number, number, number];
}

export function apcaContrast(textHex: string, bgHex: string): number {
  let txt = apcaY(textHex);
  let bg = apcaY(bgHex);
  if (txt <= APCA.blkThrs) txt += Math.pow(APCA.blkThrs - txt, APCA.blkClmp);
  if (bg <= APCA.blkThrs) bg += Math.pow(APCA.blkThrs - bg, APCA.blkClmp);
  if (Math.abs(bg - txt) < APCA.deltaYmin) return 0;
  if (bg > txt) {
    const s =
      (Math.pow(bg, APCA.normBG) - Math.pow(txt, APCA.normTXT)) * APCA.scale;
    return s < APCA.loClip ? 0 : (s - APCA.loOffset) * 100;
  }
  const s = (Math.pow(bg, APCA.revBG) - Math.pow(txt, APCA.revTXT)) * APCA.scale;
  return s > -APCA.loClip ? 0 : (s + APCA.loOffset) * 100;
}

export function wcagLevel(ratio: number): "AAA" | "AA" | "AA Large" | "Fail" {
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  if (ratio >= 3) return "AA Large";
  return "Fail";
}

/** Black or white, whichever reads better on the given background. */
export function readableOn(hex: string): "#000000" | "#ffffff" {
  return wcagContrast(hex, "#000000") >= wcagContrast(hex, "#ffffff")
    ? "#000000"
    : "#ffffff";
}
