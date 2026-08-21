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
/* One camera, one motion language: a gentle take-off into a long settle
   (Material's "emphasized" curve) — nothing starts at max velocity. */
export const EASE = 'cubic-bezier(0.2, 0, 0, 1)';
/* The vertical axis runs a slightly earlier curve than the horizontal one, so
   every clone traces a soft arc (lift-then-glide) instead of a straight line. */
const EASE_LEAD = 'cubic-bezier(0.1, 0.24, 0, 1)';
/* Chorus cascade: each step of distance from the hero waits this much. */
const STAGGER_MS = 24;
const STAGGER_MAX_STEPS = 4;

/* The hero lands on a spring: a damped oscillator sampled into a linear()
   easing — ~1.5% overshoot peaking around 60% in, fully settled by landing.
   ζ (damping) sets the overshoot, ω (rad/s) how quickly it settles. */
const SPRING = (() => {
  const ζ = 0.8;
  const ω = 13.5;
  const T = MORPH_MS / 1000;
  const ωd = ω * Math.sqrt(1 - ζ * ζ);
  const N = 24;
  const pts: string[] = [];
  for (let i = 0; i < N; i++) {
    const t = (i / N) * T;
    const x = 1 - Math.exp(-ζ * ω * t) * (Math.cos(ωd * t) + ((ζ * ω) / ωd) * Math.sin(ωd * t));
    pts.push(x.toFixed(4));
  }
  return `linear(${pts.join(', ')}, 1)`;
})();

export const staggerFor = (i: number, heroIdx: number) =>
  Math.min(Math.abs(i - heroIdx), STAGGER_MAX_STEPS) * STAGGER_MS;

/** The flight's viewport: body-level and fixed, but CLIPPED to the given rect
 *  (the zoom stage inside the editor window's rounded panel) — a clone that
 *  travels to a half-scrolled edge card is cut off by the panel exactly like
 *  the card it becomes, instead of spilling onto the window frame. Only the
 *  bottom corners round: the top edge sits mid-panel, under the fixed header,
 *  where the panel's sides run straight. */
export type FlightClip = { rect: DOMRect; radius: string };

function mkOverlay(clip?: FlightClip): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'mir-flight';
  if (clip) {
    const r = clip.rect;
    overlay.style.clipPath = `inset(${r.top}px ${window.innerWidth - r.right}px ${
      window.innerHeight - r.bottom
    }px ${r.left}px round 0 0 ${clip.radius} ${clip.radius})`;
  }
  document.body.appendChild(overlay);
  return overlay;
}

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
    /** Hero flights land on the spring (both axes — no arc, a straight
     *  confident dolly with a settle). */
    spring?: boolean;
  } = {},
): Promise<unknown> {
  const frame = (r: DOMRect, radius: string, opacity: number) => ({
    left: `${r.left}px`,
    width: `${r.width}px`,
    height: `${r.height}px`,
    borderRadius: radius,
    opacity,
  });
  const timing = { duration: opts.duration ?? MORPH_MS, delay: opts.delay ?? 0, fill: 'both' as const };
  const anim = el.animate(
    [
      frame(from, opts.radius?.[0] ?? el.style.borderRadius, opts.fade === 'in' ? 0 : 1),
      frame(to, opts.radius?.[1] ?? el.style.borderRadius, opts.fade === 'out' ? 0 : 1),
    ],
    { ...timing, easing: opts.spring ? SPRING : EASE },
  );
  // Vertical travel on its own (earlier) curve — the arc lives in the split.
  const rise = el.animate(
    [{ top: `${from.top}px` }, { top: `${to.top}px` }],
    { ...timing, easing: opts.spring ? SPRING : EASE_LEAD },
  );
  return Promise.all([anim.finished, rise.finished]).catch(() => undefined);
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
  clip?: FlightClip;
}): Promise<HTMLElement> {
  const overlay = mkOverlay(args.clip);

  const flights: Promise<unknown>[] = [];
  const heroIdx = args.order.findIndex((s) => s.id === args.selectedId);
  for (const [i, { id, thumb }] of args.order.entries()) {
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
        flights.push(
          fly(hero, src, args.preview, { radius: [args.radii.card, args.radii.preview], spring: true }),
        );
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
      // The chorus leaves in a cascade rippling outward from the hero — a
      // beat of intention instead of eight thumbs moving in lockstep.
      const c = mkClone(overlay, thumb, src, args.radii.card);
      c.style.zIndex = '2';
      flights.push(
        fly(c, src, slot, { radius: [args.radii.card, args.radii.slot], delay: staggerFor(i, heroIdx) }),
      );
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
  /** The board's edge fades at landing scale, mirrored INTO the overlay above
   *  every clone — an edge-bound thumb shrinks UNDER the fade exactly like the
   *  card it becomes, instead of riding over it and getting abruptly overlaid
   *  at landing. Only the sides that will actually be lit. */
  fades?: { side: 'left' | 'right'; rect: DOMRect }[];
  clip?: FlightClip;
}): Promise<HTMLElement> {
  const overlay = mkOverlay(args.clip);

  for (const f of args.fades ?? []) {
    const el = document.createElement('div');
    el.className = `mir-flight__fade mir-flight__fade--${f.side}`;
    el.style.left = `${f.rect.left}px`;
    el.style.top = `${f.rect.top}px`;
    el.style.width = `${f.rect.width}px`;
    el.style.height = `${f.rect.height}px`;
    overlay.appendChild(el);
  }

  const flights: Promise<unknown>[] = [];
  const heroIdx = args.order.findIndex((s) => s.id === args.selectedId);
  for (const [i, { id, thumb }] of args.order.entries()) {
    const slot = args.slots.get(id);
    const target = args.targets.get(id);

    if (id === args.selectedId) {
      // The player frame shrinks back into its card — under the chorus, same
      // stacking as the way in. The clone is the scene's own thumbnail with
      // the LIVE video frame stacked on top: it takes off showing exactly what
      // the player showed, then dissolves to the thumbnail mid-flight — so by
      // landing its pixels already match the card underneath, and the final
      // overlay fade swaps identical images (i.e. is invisible).
      if (target) {
        const hero = mkClone(overlay, thumb, args.preview, args.radii.preview);
        hero.style.zIndex = '1';
        if (args.videoFrame) {
          const live = document.createElement('img');
          live.src = args.videoFrame;
          live.draggable = false;
          live.className = 'mir-flight__live';
          hero.appendChild(live);
          live.animate(
            [{ opacity: 1 }, { opacity: 1, offset: 0.3 }, { opacity: 0 }],
            { duration: MORPH_MS, easing: 'ease-out', fill: 'forwards' },
          );
        }
        flights.push(
          fly(hero, args.preview, target, {
            radius: [args.radii.preview, args.radii.card],
            spring: true,
          }),
        );
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
      flights.push(
        fly(c, slot, target, { radius: [args.radii.slot, args.radii.card], delay: staggerFor(i, heroIdx) }),
      );
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
