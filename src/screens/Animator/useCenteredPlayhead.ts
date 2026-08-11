import { useEffect, useState } from 'react';
import type { RefObject } from 'react';
import { RAIL } from './data';

/**
 * Content-space x (rail excluded) that puts the playhead in the horizontal
 * middle of the timeline strip.
 *
 * The workspace width is not fixed — collapsing the chat panel hands the editor
 * another 338px, and the window itself can be resized. Measuring instead of
 * hard-coding keeps the resting playhead centred through all of it. A
 * ResizeObserver also fires throughout the chat panel's 280ms collapse, so the
 * playhead glides to its new mark with the layout rather than jumping after it.
 */
export function useCenteredPlayhead(ref: RefObject<HTMLElement | null>, fallback: number) {
  const [restingX, setRestingX] = useState(fallback);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => setRestingX(Math.max(0, el.clientWidth / 2 - RAIL));

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return restingX;
}
