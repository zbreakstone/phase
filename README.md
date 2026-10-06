# Phase

Phase generates perceptually uniform colour scales where **the shade numbers guarantee contrast**. Pick a colour space, set luminance targets and "magic number" rules, shape each hue between its lightest and darkest end, then export CSS variables, JSON design tokens or a Tailwind theme.

## What it does

- **Colour spaces:** OKLCH (default), OKLab, CIE LCH, CIELAB and HSLuv. Switching space keeps each hue's endpoint colours and regenerates how the scale travels between them.
- **Magic numbers:** every shade has a grade (0 = white, 100 = black). Rules such as `40+ apart = 3:1`, `50+ apart = 4.5:1`, `70+ apart = 7:1` are guaranteed for any two shades of any hue. This follows the [USWDS magic number](https://designsystem.digital.gov/design-tokens/color/overview/), [Stripe's accessible colour systems](https://stripe.com/blog/accessible-color-systems) and [Envoy's write-up](https://medium.com/@katierileyco/designing-an-accessible-color-scheme-again-fd35cfa9d796).
- **Luminance targets:** by default grades are spaced evenly in contrast between white and black (grades `N` apart always give `21^(N/100)`:1). Switch to custom targets to move individual grades; each grade shows the luminance window it may occupy without breaking a rule.
- **Hue shaping:** each hue has a lightest-end and a darkest-end hue and chroma, a mid-scale chroma peak, a "when the shift happens" bias and a direction around the wheel. A hue-curve chart, a chroma/gamut chart and a "no hue shift" comparison strip make the effect visible.
- **Gamut clipping:** shades are solved to their luminance first and chroma is reduced if the colour does not fit sRGB. Clipped shades are marked with a scissors icon and ringed in the chroma chart.
- **Contrast matrix:** pass/fail grid for any pair of hues against your rules, with an optional APCA Lc view. A banner reports the result across every hue combination.
- **Export:** CSS variables, W3C-style JSON tokens, Tailwind v4 `@theme` or v3 config, in hex, RGB, HSL or OKLCH.
- **Saving and sharing:** the working palette autosaves in the browser, named palettes can be saved and reopened, and "Share link" encodes the palette in the URL hash.

## Run locally

Requires Node 20.9 or newer.

```bash
npm install
npm run dev -- -p 41873      # http://localhost:41873
```

Other scripts:

```bash
npm test            # unit tests (vitest): colour math, solver and the contrast guarantee
npm run typecheck   # tsc --noEmit
npm run lint
npm run build && npm start
```

## Deploying to Vercel

Phase is a standard Next.js App Router app with no custom server. Import the repository in Vercel and deploy with the default settings. All configuration is through environment variables and every one is optional; see [`.env.example`](./.env.example).

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_STORAGE_DRIVER` | Which palette storage driver to use. Only `local` (browser localStorage) exists today. |
| `NEXT_PUBLIC_SITE_URL` | Public URL used for absolute metadata links. Falls back to Vercel's production URL. |

## Persistence and a future Supabase swap

Nothing is stored on a server today. Palette persistence sits behind a small interface in [`src/lib/storage`](./src/lib/storage):

```ts
interface PaletteStorage {
  readonly driver: string;
  list(): Promise<SavedPalette[]>;
  get(id: string): Promise<SavedPalette | null>;
  save(palette: SavedPalette): Promise<void>;
  remove(id: string): Promise<void>;
}
```

`getStorage()` picks the implementation from `NEXT_PUBLIC_STORAGE_DRIVER`. The default `LocalPaletteStorage` uses `localStorage`. To move to Supabase later, add a `SupabasePaletteStorage` that implements `PaletteStorage`, return it from the matching case in `getStorage()` and set the driver and the Supabase variables in Vercel. No UI code needs to change. Supabase is intentionally not a dependency yet.

## How the colour maths works

1. **Targets.** Each grade gets a relative-luminance target `Y`. With the default scale, `Y + 0.05` falls geometrically from white (1.05) to black (0.05), so any two grades `d` apart have the same contrast ratio, `21^(d/100)`.
2. **Hue curve.** For a grade's position `t` along the scale, hue and chroma come from the hue's endpoints, bias and chroma peak. Polar spaces blend the hue angle; rectangular spaces (OKLab, CIELAB) blend on the a/b plane.
3. **Solve.** The lightness coordinate in the chosen space is bisected until the resulting sRGB colour hits the luminance target. If the requested chroma is outside sRGB it is reduced, never lightness or hue, so the target is always honoured.
4. **Verify.** Contrast is recomputed from the final 8-bit hex values for every shade pair, so rounding is part of the check.

Source layout:

```
src/lib/color/     conversions, WCAG and APCA contrast, luminance solver
src/lib/palette/   scale and rules, hue generation, validation, URL state
src/lib/export/    CSS, JSON token and Tailwind generators
src/lib/storage/   PaletteStorage interface and localStorage driver
src/components/    UI built on shadcn/ui, icons from lucide-react
tests/             vitest suites
```

## Stack

Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui and lucide-react. Colour conversions are implemented in-house with no colour library.
