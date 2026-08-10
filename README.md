# jeje-finpro

A frontend-only prototype built with **React + Vite + TypeScript**, with
[`lucide-react`](https://lucide.dev/) for icons.

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
```

## Scripts

| Command          | What it does                     |
| ---------------- | -------------------------------- |
| `npm run dev`    | Start the dev server             |
| `npm run build`  | Type-check + production build    |
| `npm run preview`| Preview the production build     |
| `npm run lint`   | Lint with oxlint                 |

## Structure

- `src/App.tsx` — starter screen
- `src/index.css` — global styles + design tokens (CSS variables)
- `public/assets/` — images and static files (referenced as `/assets/...`)

See `AGENTS.md` for conventions used when building screens with AI assistance.
