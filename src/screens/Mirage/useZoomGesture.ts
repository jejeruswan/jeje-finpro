import { useEffect, useRef } from 'react';

/**
 * Spatial-zoom gesture engine. Navigation between levels IS the zoom:
 *  - trackpad pinch arrives as a wheel event with `ctrlKey: true`
 *  - two-finger touch pinch is tracked from raw touch events
 *
 * Deltas accumulate until a threshold trips, then the matching callback fires
 * with the gesture's focus point (cursor position / pinch midpoint) so the
 * caller can anchor the scale transition's transform-origin to it. A plain
 * (non-pinch) wheel is left alone — levels keep their native scrolling.
 */

export type ZoomFocus = { x: number; y: number };

const PINCH_THRESHOLD = 120; // accumulated wheel delta before a level change
const TOUCH_RATIO_IN = 1.22; // finger-spread ratio that reads as "pinch in"
const TOUCH_RATIO_OUT = 0.82;

export function useZoomGesture(
  ref: React.RefObject<HTMLElement | null>,
  handlers: {
    onZoomIn: (focus: ZoomFocus) => void;
    onZoomOut: (focus: ZoomFocus) => void;
    /** Live gesture feedback in [-1, 1]; called with 0 when the gesture ends. */
    onHint?: (progress: number, focus?: ZoomFocus) => void;
  },
) {
  // Keep the latest handlers without re-binding listeners every render.
  const latest = useRef(handlers);
  latest.current = handlers;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let acc = 0;
    let settleTimer = 0;

    const settle = () => {
      acc = 0;
      latest.current.onHint?.(0);
    };

    const bump = (delta: number, focus: ZoomFocus) => {
      acc += delta;
      latest.current.onHint?.(Math.max(-1, Math.min(1, acc / PINCH_THRESHOLD)), focus);
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(settle, 180);
      if (acc > PINCH_THRESHOLD) {
        settle();
        latest.current.onZoomIn(focus);
      } else if (acc < -PINCH_THRESHOLD) {
        settle();
        latest.current.onZoomOut(focus);
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return; // plain wheel = native scroll
      e.preventDefault(); // stop the browser's own page zoom
      bump(-e.deltaY * 1.6, { x: e.clientX, y: e.clientY });
    };

    // --- Two-finger touch pinch ---------------------------------------------
    let touchStartDist = 0;
    let lastRatio = 1;

    const dist = (e: TouchEvent) => {
      const [a, b] = [e.touches[0], e.touches[1]];
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    };
    const midpoint = (e: TouchEvent): ZoomFocus => ({
      x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
      y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
    });

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      touchStartDist = dist(e);
      lastRatio = 1;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || touchStartDist === 0) return;
      e.preventDefault();
      const ratio = dist(e) / touchStartDist;
      lastRatio = ratio;
      latest.current.onHint?.(Math.max(-1, Math.min(1, (ratio - 1) * 2.5)), midpoint(e));
      if (ratio > TOUCH_RATIO_IN) {
        touchStartDist = 0;
        latest.current.onHint?.(0);
        latest.current.onZoomIn(midpoint(e));
      } else if (ratio < TOUCH_RATIO_OUT) {
        touchStartDist = 0;
        latest.current.onHint?.(0);
        latest.current.onZoomOut(midpoint(e));
      }
    };
    const onTouchEnd = () => {
      touchStartDist = 0;
      lastRatio = 1;
      latest.current.onHint?.(0);
      void lastRatio;
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', onTouchEnd);
    return () => {
      window.clearTimeout(settleTimer);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [ref]);
}
