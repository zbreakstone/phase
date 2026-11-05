<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Shadows

Use the shadow tokens from `src/app/globals.css`, never stock Tailwind shadows (`shadow-sm`, `shadow-md`, ...) or a `ring-1` outline standing in for a border:

- `shadow-(--shadow-border)`: things that only need a border (thumbnails, swatches, kbd chips).
- `shadow-(--shadow-default)`: layout surfaces and controls (canvas, sidebar, buttons, inputs, thumbs, dots). Interactive ones step up to `--shadow-large` on hover.
- `shadow-(--shadow-large)`: floating surfaces (popovers, dropdown, select and context menus, color pickers).
- `shadow-(--shadow-extra-large)`: modals (dialogs).

Set these in the shared primitives in `src/components/ui/`, not at call sites. Full detail, with the rules for each tier, is in `src/components/ui/AGENTS.md`.
