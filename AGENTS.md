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
- **Icons: use `lucide-react`.** Import named icons, e.g.
  `import { Camera, X } from 'lucide-react'`. Do NOT hand-draw SVG icons.
  If a specific design-system icon is needed, ask for the Figma link / asset and
  export it, rather than approximating.
- **Images/assets:** put static files in `public/assets/` and reference them as
  `/assets/name.png`, or import from `src/assets/` for bundled assets.
- **One screen per component.** Give each screen its own component file plus its
  own CSS file (e.g. `Editor.tsx` + `editor.css`). Keep design tokens as CSS
  variables in `src/index.css`.
- **Design fidelity:** when implementing a Figma design, pull real values
  (colors, spacing, positions) rather than eyeballing; commit exported image
  assets rather than relying on temporary URLs.

## Building a new screen from Figma (quick recipe)

1. Get the Figma node's design context + a screenshot.
2. Pull exact tokens (colors, radii, spacing); map them to CSS variables.
3. Export any images/icons and commit them under `public/assets/`.
4. Build the component, then verify against the screenshot in the browser.
