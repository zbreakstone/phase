# Shared UI components

## Shadows

Shadows are tokens defined in `src/app/globals.css` (separate light and dark values). Use the token, never a stock Tailwind shadow (`shadow-sm`, `shadow-md`, `shadow-lg`, ...) and never a `ring-1 ring-foreground/10` outline standing in for a border or shadow on a surface. Write them as `shadow-(--shadow-border)`, `shadow-(--shadow-default)`, `shadow-(--shadow-large)`, `shadow-(--shadow-extra-large)`.

| Token | Use it for |
| --- | --- |
| `--shadow-border` | Things that only need a border: thumbnails, swatches, kbd chips. A hairline, no elevation. |
| `--shadow-default` | Layout surfaces that sit on the page: the canvas, the sidebar, buttons, inputs, selects, toggles, and small raised controls like slider and picker thumbs, chart dots and add buttons. Interactive ones step up to `--shadow-large` on hover. |
| `--shadow-large` | Floating surfaces that open over the page: popovers, dropdown menus and submenus, select menus, context menus, color pickers. |
| `--shadow-extra-large` | Modals: dialogs and anything else that blocks the page behind it. |

Rules:

- Floating surfaces get their shadow from the primitives in this folder (`popover`, `select`, `dropdown-menu`, `context-menu`, `color-picker`, `dialog`). Don't override it at a call site; fix the primitive.
- Pick the tier by what the surface does (border, layout, floating, modal), not by how strong it should look. If none fit, add a token to `globals.css` for both light and dark and document it here.
- Thumbs and dots pair a white `border-2 border-white` (the outline) with `--shadow-default` (the lift). Don't use `ring-*` or a stock shadow for either part.
- Tooltips carry no shadow token; they are small, solid chips.
- The hover step from `--shadow-default` to `--shadow-large` is for interactive layout elements only. Don't use it to make a static surface feel raised.

## Corner radii

Nested rounded surfaces must share a center for their arcs, so the radii are tied to the padding between them:

- `inner radius + padding = outer radius`, or equivalently `outer radius - padding = inner radius`.
- The padding is the space between the two edges (the container's padding, or the inset of the inner element), not the inner element's own padding.

The scale comes from `--radius` (0.625rem = 10px) in `globals.css`: `rounded-sm` 6px, `rounded-md` 8px, `rounded-lg` 10px, `rounded-xl` 14px, `rounded-2xl` 18px, `rounded-3xl` 22px. Pick the container's radius first, then derive the inner one.

| Outer | Padding | Inner |
| --- | --- | --- |
| `rounded-xl` (14px) | `p-1` (4px) | `rounded-lg` (10px) |
| `rounded-xl` (14px) | `p-1.5` (6px) | `rounded-md` (8px) |
| `rounded-lg` (10px) | `p-1.5` (6px) | `rounded` (4px) |
| `rounded-3xl` (22px) | `p-2` (8px) | `rounded-2xl` (18px) |

Rules:

- Floating surfaces (popovers, menus, select menus, context menus, color pickers) are `rounded-xl`. Their list items are `rounded-lg` inside `p-1`. Keep that padding on every menu so the items never touch the edge.
- A surface wrapping another one (a preview card around a swatch square, a tile inside a menu row) follows the same sum, so check it whenever you add padding or change a radius.
- Fully round elements (`rounded-full`) are exempt.

## Spacing grid

Spacing, sizes and radii sit on a 4px baseline grid: one Tailwind spacing token (`1`) is 4px, so `p-1` is 4px, `p-2` is 8px, `p-3` is 12px, and so on. Half tokens (`0.5` = 2px, `1.5` = 6px, `2.5` = 10px) and quarter tokens (1px steps, for hairlines and optical nudges) are fine. Avoid arbitrary values that aren't whole pixels, and prefer a token over `[...px]`. The radius scale (6, 8, 10, 14, 18, 22px) stays on whole 2px steps for the same reason.
