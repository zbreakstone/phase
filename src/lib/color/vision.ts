import { hexToLinear, linearToHex, luminanceOfLinear, type RGB } from "./convert";

export type VisionId =
  | "normal"
  | "protanopia"
  | "deuteranopia"
  | "tritanopia"
  | "protanomaly"
  | "deuteranomaly"
  | "tritanomaly"
  | "achromatopsia"
  | "achromatomaly";

type Matrix = [RGB, RGB, RGB];

/** Machado, Oliveira & Fernandes (2009), applied to linear sRGB. Anomalies use severity 0.6. */
const MATRICES: Partial<Record<VisionId, Matrix>> = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
  protanomaly: [
    [0.38545, 0.769005, -0.154455],
    [0.100526, 0.829802, 0.069673],
    [-0.007442, -0.02219, 1.029632],
  ],
  deuteranomaly: [
    [0.547494, 0.607765, -0.155259],
    [0.181692, 0.781742, 0.036566],
    [-0.01041, 0.027275, 0.983136],
  ],
  tritanomaly: [
    [1.104996, -0.046633, -0.058363],
    [-0.032137, 0.971635, 0.060503],
    [0.001336, 0.317922, 0.680742],
  ],
};

export const VISIONS: { id: VisionId; label: string; note: string }[] = [
  { id: "normal", label: "Typical vision", note: "" },
  { id: "deuteranomaly", label: "Deuteranomaly", note: "Weak green, the most common" },
  { id: "protanomaly", label: "Protanomaly", note: "Weak red" },
  { id: "tritanomaly", label: "Tritanomaly", note: "Weak blue" },
  { id: "deuteranopia", label: "Deuteranopia", note: "No green" },
  { id: "protanopia", label: "Protanopia", note: "No red" },
  { id: "tritanopia", label: "Tritanopia", note: "No blue" },
  { id: "achromatomaly", label: "Achromatomaly", note: "Weak colour" },
  { id: "achromatopsia", label: "Achromatopsia", note: "No colour" },
];

const gray = (y: number): RGB => [y, y, y];

/** How a colour appears under the given colour vision. */
export function simulateVision(hex: string, vision: VisionId): string {
  if (vision === "normal") return hex;
  const rgb = hexToLinear(hex);
  if (vision === "achromatopsia") return linearToHex(gray(luminanceOfLinear(rgb)));
  if (vision === "achromatomaly") {
    const y = luminanceOfLinear(rgb);
    return linearToHex(rgb.map((c) => 0.4 * c + 0.6 * y) as RGB);
  }
  const m = MATRICES[vision]!;
  return linearToHex(m.map((row) => row[0] * rgb[0] + row[1] * rgb[1] + row[2] * rgb[2]) as RGB);
}

/** The neutral grey with the same relative luminance, for checking that steps line up across hues. */
export function luminanceGray(hex: string): string {
  return linearToHex(gray(luminanceOfLinear(hexToLinear(hex))));
}
