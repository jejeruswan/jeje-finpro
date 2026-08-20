import { useEffect, useRef, useState } from 'react';

/**
 * The one playback clock for the whole prototype. It lives above the altitude
 * state machine so zooming between BOARD / PAGE / FRAME never interrupts the
 * performance — a key demo moment. Loops until Cut.
 */
export function usePlaybackClock(total: number) {
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const raf = useRef(0);
  const last = useRef(0);

  useEffect(() => {
    if (!playing) return;
    last.current = performance.now();
    const tick = (now: number) => {
      const dt = (now - last.current) / 1000;
      last.current = now;
      setTime((t) => (t + dt) % total);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, total]);

  const toggle = () =>
    setPlaying((p) => {
      if (p) setTime(0); // Cut rewinds — the page settles back to rest
      return !p;
    });

  return { playing, time, toggle, progress: total > 0 ? time / total : 0 };
}
