import { apcaContrast, contrastFromLuminance } from "../color/contrast";
import { requiredRatio } from "./scale";
import type { ContrastRule, GeneratedHue, Shade } from "./types";

export type CellStatus = "pass" | "fail" | "none";

export interface MatrixCell {
  fg: Shade;
  bg: Shade;
  diff: number;
  ratio: number;
  apca: number;
  required: number | null;
  status: CellStatus;
}

/** Contrast of every shade in `fgShades` (rows) on every shade in `bgShades` (columns). */
export function buildMatrix(
  fgShades: Shade[],
  bgShades: Shade[],
  rules: ContrastRule[],
): MatrixCell[][] {
  return fgShades.map((fg) =>
    bgShades.map((bg) => {
      const diff = Math.abs(fg.grade - bg.grade);
      const ratio = contrastFromLuminance(fg.luminance, bg.luminance);
      const required = requiredRatio(diff, rules);
      const status: CellStatus =
        required === null ? "none" : ratio + 1e-9 >= required ? "pass" : "fail";
      return { fg, bg, diff, ratio, apca: apcaContrast(fg.hex, bg.hex), required, status };
    }),
  );
}

export interface Failure {
  fgHueId: string;
  bgHueId: string;
  fg: Shade;
  bg: Shade;
  fgHue: string;
  bgHue: string;
  fgGrade: number;
  bgGrade: number;
  ratio: number;
  required: number;
}

export interface PaletteReport {
  pairsChecked: number;
  failures: Failure[];
  /** Lowest ratio seen relative to its requirement (1 = exactly on the line). */
  tightestMargin: number | null;
}

/** Checks every shade of every hue against every shade of every hue (including itself). */
export function validatePalette(generated: GeneratedHue[], rules: ContrastRule[]): PaletteReport {
  let pairsChecked = 0;
  let tightest: number | null = null;
  const failures: Failure[] = [];
  for (const a of generated) {
    for (const b of generated) {
      for (const fg of a.shades) {
        for (const bg of b.shades) {
          if (fg.grade >= bg.grade) continue;
          const required = requiredRatio(bg.grade - fg.grade, rules);
          if (required === null) continue;
          pairsChecked++;
          const ratio = contrastFromLuminance(fg.luminance, bg.luminance);
          const margin = ratio / required;
          if (tightest === null || margin < tightest) tightest = margin;
          if (ratio + 1e-9 < required) {
            failures.push({
              fgHueId: a.hue.id,
              bgHueId: b.hue.id,
              fg,
              bg,
              fgHue: a.hue.name,
              bgHue: b.hue.name,
              fgGrade: fg.grade,
              bgGrade: bg.grade,
              ratio,
              required,
            });
          }
        }
      }
    }
  }
  return { pairsChecked, failures, tightestMargin: tightest };
}
