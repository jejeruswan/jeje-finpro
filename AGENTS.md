# jeje-finpro — project notes for AI agents

A **frontend-only prototype** built with React + Vite + TypeScript. Optimized for
building UI mockups fast (often from Figma). No backend, no database, no API calls.

## How to run

```bash
npm install      # first time
npm run dev      # start the dev server (http://localhost:5173)
npm run build    # type-check + production build
npm run lint     # oxlint
```

## Conventions

- **Frontend-only.** Handle all interactivity with client-side React state
  (`useState`, `useContext`). Never add a backend, database, or network calls
  unless explicitly asked.
- **Icons: the custom icon library is the standard.** Always use the project's
  own icon set (exported from Figma into `src/assets/icons/`) when the design's
  icon exists there — see "Custom icon set" below. Fall back to
  `@phosphor-icons/react` ONLY for generic glyphs the custom set doesn't have:
  `import { Camera } from '@phosphor-icons/react'`, using the `weight` prop
  (`thin | light | regular | bold | fill | duotone`). Do NOT hand-draw SVG icons.
- **Images/assets:** put static files in `public/assets/` and reference them as
  `/assets/name.png`, or import from `src/assets/` for bundled assets.
- **One screen per component.** Give each screen its own component file plus its
  own CSS file (e.g. `Editor.tsx` + `editor.css`). Keep design tokens as CSS
  variables in `src/index.css`.
- **Design fidelity:** when implementing a Figma design, pull real values
  (colors, spacing, positions) rather than eyeballing; commit exported image
  assets rather than relying on temporary URLs.

## Custom icon set (from Figma)

Alongside Phosphor, this project has a bespoke icon library that lives in Figma.
To use those icons in code:

1. Export each icon as **SVG** from Figma and commit under `src/assets/icons/`.
2. Prefer inline React SVG components (so `color`/`size` can be controlled via
   props and `currentColor`) over `<img>` tags.
3. Keep names matching the Figma component names so design ↔ code stays traceable.

Rule of thumb: reach for the **custom icon** when the design uses it; fall back to
**Phosphor** for generic UI glyphs not covered by the custom set.

## Building a new screen from Figma (quick recipe)

1. Get the Figma node's design context + a screenshot.
2. Pull exact tokens (colors, radii, spacing); map them to CSS variables.
3. Export any images/icons and commit them under `public/assets/`.
4. Build the component, then verify against the screenshot in the browser.
