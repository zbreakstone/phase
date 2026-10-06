export type RGB = [number, number, number];

export function srgbToLinear(c: number): number {
  const a = Math.abs(c);
  const v = a <= 0.04045 ? a / 12.92 : Math.pow((a + 0.055) / 1.055, 2.4);
  return c < 0 ? -v : v;
}

export function linearToSrgb(c: number): number {
  const a = Math.abs(c);
  const v = a <= 0.0031308 ? a * 12.92 : 1.055 * Math.pow(a, 1 / 2.4) - 0.055;
  return c < 0 ? -v : v;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function linearToHex(rgb: RGB): string {
  return (
    "#" +
    rgb
      .map((c) => {
        const v = Math.round(clamp01(linearToSrgb(clamp01(c))) * 255);
        return v.toString(16).padStart(2, "0");
      })
      .join("")
  );
}

export function hexToLinear(hex: string): RGB {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Invalid hex colour: ${hex}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) =>
    srgbToLinear(v / 255),
  ) as RGB;
}

export function hexToBytes(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const Y_COEFFS = [0.2126, 0.7152, 0.0722] as const;

/** Relative luminance (WCAG 2) of a linear-light sRGB triple. */
export function luminanceOfLinear(rgb: RGB): number {
  return Y_COEFFS[0] * rgb[0] + Y_COEFFS[1] * rgb[1] + Y_COEFFS[2] * rgb[2];
}

/* ---------------------------------- OKLab --------------------------------- */

export function linearToOklab([r, g, b]: RGB): [number, number, number] {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function oklabToLinear(L: number, a: number, b: number): RGB {
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/* ------------------------------ CIELAB (D65) ------------------------------ */

const XYZ_FROM_LINEAR = [
  [0.4123907993, 0.3575843394, 0.1804807884],
  [0.2126390059, 0.7151686788, 0.0721923154],
  [0.0193308187, 0.1191947798, 0.9505321522],
];
const LINEAR_FROM_XYZ = [
  [3.2409699419, -1.5373831776, -0.4986107603],
  [-0.9692436363, 1.8759675015, 0.0415550574],
  [0.0556300797, -0.2039769589, 1.0569715142],
];
const WHITE = XYZ_FROM_LINEAR.map((row) => row[0] + row[1] + row[2]);
const EPS = 216 / 24389;
const KAPPA = 24389 / 27;

function mul(m: number[][], v: number[]): RGB {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}

export function linearToLab(rgb: RGB): [number, number, number] {
  const xyz = mul(XYZ_FROM_LINEAR, rgb);
  const f = xyz.map((v, i) => {
    const t = v / WHITE[i];
    return t > EPS ? Math.cbrt(t) : (KAPPA * t + 16) / 116;
  });
  return [116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])];
}

export function labToLinear(L: number, a: number, b: number): RGB {
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const inv = (f: number) => {
    const f3 = f * f * f;
    return f3 > EPS ? f3 : (116 * f - 16) / KAPPA;
  };
  const xyz = [inv(fx) * WHITE[0], (L > 8 ? fy * fy * fy : L / KAPPA) * WHITE[1], inv(fz) * WHITE[2]];
  return mul(LINEAR_FROM_XYZ, xyz);
}

/* --------------------------------- HSLuv ---------------------------------- */

const REF_U = 0.19783000664283;
const REF_V = 0.46831999493879;

function maxChromaForLH(L: number, hDeg: number): number {
  const sub1 = Math.pow(L + 16, 3) / 1560896;
  const sub2 = sub1 > EPS ? sub1 : L / KAPPA;
  const h = (hDeg / 360) * 2 * Math.PI;
  let min = Infinity;
  for (let c = 0; c < 3; c++) {
    const [m1, m2, m3] = LINEAR_FROM_XYZ[c];
    for (let t = 0; t < 2; t++) {
      const top1 = (284517 * m1 - 94839 * m3) * sub2;
      const top2 =
        (838422 * m3 + 769860 * m2 + 731718 * m1) * L * sub2 - 769860 * t * L;
      const bottom = (632260 * m3 - 126452 * m2) * sub2 + 126452 * t;
      const slope = top1 / bottom;
      const intercept = top2 / bottom;
      const len = intercept / (Math.sin(h) - slope * Math.cos(h));
      if (len >= 0 && len < min) min = len;
    }
  }
  return min;
}

export function hsluvToLinear(L: number, S: number, H: number): RGB {
  if (L > 99.9999999) return [1, 1, 1];
  if (L < 1e-8) return [0, 0, 0];
  const C = (maxChromaForLH(L, H) / 100) * S;
  const h = (H / 180) * Math.PI;
  const U = Math.cos(h) * C;
  const V = Math.sin(h) * C;
  const varU = U / (13 * L) + REF_U;
  const varV = V / (13 * L) + REF_V;
  const Y = L <= 8 ? L / KAPPA : Math.pow((L + 16) / 116, 3);
  const X = (9 * Y * varU) / (4 * varV);
  const Z = (Y * (12 - 3 * varU - 20 * varV)) / (4 * varV);
  return mul(LINEAR_FROM_XYZ, [X, Y, Z]);
}

export function linearToHsluv(rgb: RGB): [number, number, number] {
  const [X, Y, Z] = mul(XYZ_FROM_LINEAR, rgb);
  const L = Y > EPS ? 116 * Math.cbrt(Y) - 16 : Y * KAPPA;
  if (L < 1e-8) return [0, 0, 0];
  if (L > 99.9999999) return [100, 0, 0];
  const d = X + 15 * Y + 3 * Z;
  const varU = d === 0 ? 0 : (4 * X) / d;
  const varV = d === 0 ? 0 : (9 * Y) / d;
  const U = 13 * L * (varU - REF_U);
  const V = 13 * L * (varV - REF_V);
  const C = Math.hypot(U, V);
  let H = (Math.atan2(V, U) * 180) / Math.PI;
  if (H < 0) H += 360;
  if (C < 1e-8) return [L, 0, H];
  const max = maxChromaForLH(L, H);
  return [L, Math.min(100, (C / max) * 100), H];
}

export function polarToRect(c: number, hDeg: number): [number, number] {
  const h = (hDeg * Math.PI) / 180;
  return [c * Math.cos(h), c * Math.sin(h)];
}

export function rectToPolar(a: number, b: number): [number, number] {
  const c = Math.hypot(a, b);
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return [c, h];
}

export const normHue = (h: number) => ((h % 360) + 360) % 360;
