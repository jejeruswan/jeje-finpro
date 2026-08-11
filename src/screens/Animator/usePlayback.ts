import { useCallback, useEffect, useRef, useState } from 'react';
import { RULER_PX_PER_SEC } from './data';

/** How fast the playhead sweeps, relative to real time (1 = ruler-accurate). */
const PLAYBACK_SPEED = 3;
/** Content-space x (rail excluded) where the sweep ends — just past the last
 *  script block. Reaching it stops playback and returns to the resting mark. */
const CONTENT_END = 1000;

/**
 * Simulated playback for the timeline. The playhead advances left→right in
 * content-space px so the tracks can highlight each word as it is passed.
 *
 * `restingX` is where the playhead sits when idle (matches the design's time
 * pill). Pressing play from rest rewinds to the start of the content; pressing
 * it after a pause resumes from where it stopped.
 */
export function usePlayback(restingX: number) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadX, setPlayheadX] = useState(restingX);
  // Mirrors `playheadX` for the rAF loop without re-subscribing every frame.
  const xRef = useRef(restingX);
  // Same trick for the resting mark: it is measured from the workspace width,
  // so it changes on every frame while the chat panel collapses. Reading it
  // through a ref keeps that out of the effect deps below, which would
  // otherwise tear down and restart the sweep dozens of times mid-transition.
  const restRef = useRef(restingX);

  // Carry an idle playhead along when the resting mark moves (the workspace got
  // wider or narrower). A playhead paused mid-sweep is left where it is, so
  // play/pause still resumes in place.
  useEffect(() => {
    const previous = restRef.current;
    restRef.current = restingX;
    if (isPlaying || xRef.current !== previous) return;
    xRef.current = restingX;
    setPlayheadX(restingX);
  }, [restingX, isPlaying]);

  useEffect(() => {
    if (!isPlaying) return;
    let raf = 0;
    let last = 0;
    let cancelled = false;

    const tick = (t: number) => {
      if (cancelled) return;
      if (!last) last = t;
      // Clamp the delta so a stalled/backgrounded frame can't teleport the
      // playhead to the end in one jump.
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;

      const next = xRef.current + dt * RULER_PX_PER_SEC * PLAYBACK_SPEED;
      if (next >= CONTENT_END) {
        xRef.current = restRef.current;
        setPlayheadX(restRef.current);
        setIsPlaying(false);
        return;
      }
      xRef.current = next;
      setPlayheadX(next);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [isPlaying]);

  const toggle = useCallback(() => {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    // Starting fresh (from the resting mark or the end) rewinds to the top.
    if (xRef.current === restRef.current || xRef.current >= CONTENT_END) {
      xRef.current = 0;
      setPlayheadX(0);
    }
    setIsPlaying(true);
  }, [isPlaying]);

  return { isPlaying, playheadX, toggle };
}
