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
