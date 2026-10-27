/* ----------------------------------------------------------------------------
   Fit-to-window scaling. The prototype was composed in a 16" MacBook Pro
   browser window (~1728×1000 CSS px) with fixed-pixel layouts throughout, so
   instead of reflowing it, the whole app is scaled uniformly — `zoom` on
   #root, driven by --ui-scale — until that design canvas fits the window.
   Every screen keeps its intended composition at any size; on a smaller
   window the layout box simply grows past 1728×1000 in the window's aspect.

   Inside the zoomed tree, layout values (offset*, scroll*, inline px styles)
   are in design px while pointer coordinates and getBoundingClientRect() are
   in screen px. Anywhere the two meet, convert with `toLocal` / `toScreen`.
   ---------------------------------------------------------------------------- */

export const DESIGN_WIDTH = 1728;
export const DESIGN_HEIGHT = 1000;

let scale = 1;

/** Current screen-px per design-px. */
export const uiScale = () => scale;

/** Screen px (clientX, rect deltas) → design px (styles, scrollLeft). */
export const toLocal = (px: number) => px / scale;

/** Design px → screen px, for every "Npx" in a CSS value (e.g. a computed
 *  border-radius applied to an element outside the zoomed tree). */
export const toScreen = (value: string) =>
  value.replace(/-?[\d.]+px/g, (m) => `${parseFloat(m) * scale}px`);

function apply() {
  scale = Math.min(window.innerWidth / DESIGN_WIDTH, window.innerHeight / DESIGN_HEIGHT);
  document.documentElement.style.setProperty('--ui-scale', String(scale));
}

/** Call once before the first render, so initial measurements see the scale. */
export function installUiScale() {
  apply();
  window.addEventListener('resize', apply);
}
