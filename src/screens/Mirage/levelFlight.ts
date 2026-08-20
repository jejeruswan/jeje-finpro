/* ----------------------------------------------------------------------------
   The shared-element flight between Level 1 (corkboard) and Level 2 (frame
   canvas). Manual FLIP with fixed-position clones in a body-level overlay:

   IN  — the clicked card's thumbnail grows into the video preview frame while
         every other card's thumbnail shrinks and travels down into its slot in
         the embedded filmstrip; a duplicate of the selected thumbnail rises
         from beneath the preview's bottom edge to fill the vacant slot.
   OUT — the exact reverse: the filler slides down out of view, the strip
         thumbs fly back up into their grid cards, and the video shrinks back
         into the selected card.

   While the flight is up, the REAL shared elements are hidden via a
   `data-morph` attribute on the zoom stage (see mirage.css); the caller drops
   the attribute when the flight resolves and crossfades the overlay away.
   ---------------------------------------------------------------------------- */

export type RectMap = Map<string, DOMRect>;

export const MORPH_MS = 620;
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

function mkClone(overlay: HTMLElement, src: string, r: DOMRect, radius: string): HTMLElement {
  const d = document.createElement('div');
  d.className = 'mir-flight__clone';
  d.style.left = `${r.left}px`;
  d.style.top = `${r.top}px`;
  d.style.width = `${r.width}px`;
  d.style.height = `${r.height}px`;
  d.style.borderRadius = radius;
  const img = document.createElement('img');
  img.src = src;
  img.draggable = false;
  d.appendChild(img);
  overlay.appendChild(d);
  return d;
}

function fly(
  el: HTMLElement,
  from: DOMRect,
  to: DOMRect,
  opts: {
    radius?: [string, string];
    fade?: 'in' | 'out';
    delay?: number;
    duration?: number;
  } = {},
): Promise<unknown> {
  const frame = (r: DOMRect, radius: string, opacity: number) => ({
    left: `${r.left}px`,
    top: `${r.top}px`,
    width: `${r.width}px`,
    height: `${r.height}px`,
    borderRadius: radius,
    opacity,
  });
  const anim = el.animate(
    [
      frame(from, opts.radius?.[0] ?? el.style.borderRadius, opts.fade === 'in' ? 0 : 1),
      frame(to, opts.radius?.[1] ?? el.style.borderRadius, opts.fade === 'out' ? 0 : 1),
    ],
    { duration: opts.duration ?? MORPH_MS, delay: opts.delay ?? 0, easing: EASE, fill: 'both' },
  );
  return anim.finished.catch(() => undefined);
}

const below = (anchor: DOMRect, slot: DOMRect) =>
  new DOMRect(slot.left, anchor.bottom + 24, slot.width, slot.height);

export type FlightScene = { id: string; thumb: string };

/** L1 → L2. Resolves (with the overlay, for the caller to crossfade out) once
 *  every clone has landed. */
export async function flightIn(args: {
  order: FlightScene[];
  selectedId: string;
  /** Card-thumbnail rects captured from L1 (viewport-visible cards only). */
  sources: RectMap;
  /** The video preview frame and the strip slots, measured on the mounted L2. */
  preview: DOMRect;
  slots: RectMap;
  radii: { card: string; preview: string; slot: string };
}): Promise<HTMLElement> {
  const overlay = document.createElement('div');
  overlay.className = 'mir-flight';
  document.body.appendChild(overlay);

  const flights: Promise<unknown>[] = [];
  for (const { id, thumb } of args.order) {
    const slot = args.slots.get(id);
    if (!slot) continue;
    const src = args.sources.get(id);

    if (id === args.selectedId) {
      // The hero: the clicked thumbnail becomes the player frame. It flies
      // UNDER the chorus — the strip overlays the video in the final layout,
      // and the growing frame must never swallow the shrinking thumbs.
      if (src) {
        const hero = mkClone(overlay, thumb, src, args.radii.card);
        hero.style.zIndex = '1';
        flights.push(fly(hero, src, args.preview, { radius: [args.radii.card, args.radii.preview] }));
      }
      // Its strip slot is vacant — a duplicate rises from beneath the
      // preview's bottom edge to complete the sequence.
      const start = below(args.preview, slot);
      const filler = mkClone(overlay, thumb, start, args.radii.slot);
      filler.style.zIndex = '3';
      flights.push(
        fly(filler, start, slot, {
          fade: 'in',
          delay: MORPH_MS * 0.35,
          duration: MORPH_MS * 0.65,
        }),
      );
    } else if (src) {
      const c = mkClone(overlay, thumb, src, args.radii.card);
      c.style.zIndex = '2';
      flights.push(fly(c, src, slot, { radius: [args.radii.card, args.radii.slot] }));
    } else {
      // The card was scrolled out of the L1 viewport: settle into the slot
      // from just below it instead of flying across the screen.
      const start = new DOMRect(slot.left, slot.top + 16, slot.width, slot.height);
      const c = mkClone(overlay, thumb, start, args.radii.slot);
      c.style.zIndex = '2';
      flights.push(fly(c, start, slot, { fade: 'in', delay: MORPH_MS * 0.3, duration: MORPH_MS * 0.6 }));
    }
  }

  await Promise.all(flights);
  return overlay;
}

/** L2 → L1: the exact reverse. */
export async function flightOut(args: {
  order: FlightScene[];
  selectedId: string;
  /** Preview frame + strip slots captured from L2 before it unmounted. */
  preview: DOMRect;
  slots: RectMap;
  /** The current video frame as a data URL, when it could be captured. */
  videoFrame: string | null;
  /** Card-thumbnail rects measured on the mounted L1 (visible cards only). */
  targets: RectMap;
  radii: { card: string; preview: string; slot: string };
}): Promise<HTMLElement> {
  const overlay = document.createElement('div');
  overlay.className = 'mir-flight';
  document.body.appendChild(overlay);

  const flights: Promise<unknown>[] = [];
  for (const { id, thumb } of args.order) {
    const slot = args.slots.get(id);
    const target = args.targets.get(id);

    if (id === args.selectedId) {
      // The player frame shrinks back into its card — under the chorus, same
      // stacking as the way in.
      if (target) {
        const hero = mkClone(overlay, args.videoFrame ?? thumb, args.preview, args.radii.preview);
        hero.style.zIndex = '1';
        flights.push(fly(hero, args.preview, target, { radius: [args.radii.preview, args.radii.card] }));
      }
      // …while the duplicate that filled its slot slides down out of view.
      if (slot) {
        const filler = mkClone(overlay, thumb, slot, args.radii.slot);
        filler.style.zIndex = '3';
        flights.push(
          fly(filler, slot, below(args.preview, slot), { fade: 'out', duration: MORPH_MS * 0.55 }),
        );
      }
    } else if (slot && target) {
      const c = mkClone(overlay, thumb, slot, args.radii.slot);
      c.style.zIndex = '2';
      flights.push(fly(c, slot, target, { radius: [args.radii.slot, args.radii.card] }));
    } else if (slot) {
      // Its card ends up outside the L1 viewport: drift down and out.
      const end = new DOMRect(slot.left, slot.top + 16, slot.width, slot.height);
      const c = mkClone(overlay, thumb, slot, args.radii.slot);
      flights.push(fly(c, slot, end, { fade: 'out', duration: MORPH_MS * 0.55 }));
    }
  }

  await Promise.all(flights);
  return overlay;
}

/** Snapshot the stage's current video frame, for the OUT hero clone. */
export function grabVideoFrame(root: HTMLElement): string | null {
  const v = root.querySelector('video');
  if (!(v instanceof HTMLVideoElement) || v.readyState < 2 || !v.videoWidth) return null;
  try {
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d')?.drawImage(v, 0, 0);
    return c.toDataURL('image/jpeg', 0.7);
  } catch {
    return null;
  }
}
