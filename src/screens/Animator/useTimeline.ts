import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  DEFAULT_PX_PER_SEC,
  MAX_PX_PER_SEC,
  MIN_PX_PER_SEC,
  RAIL,
  SCENE_DURATION,
} from './data';

/**
 * The timeline's single source of truth: where we are in the take, how many
 * pixels a second is worth, and how far the tracks are scrolled.
 *
 * PLAYHEAD-CENTRED: the playhead line and its time pill sit at the middle of
 * the strip and the content moves under them. Half a viewport of lead-in is
 * what lets t = 0 sit at the centre when the take starts — the blank left half
 * is deliberate. Scroll and time are two views of ONE number:
 *
 *     scrollLeft === time × pxPerSec
 *
 * so scrolling scrubs, a programmatic seek scrolls, and the two can never
 * disagree. Scrolling is clamped to [0, duration] by construction — you cannot
 * pan past either end.
 *
 * Playback itself is NOT driven here — the <video> element is the clock (see
 * useVideoSync). This hook only holds the state the video and the UI share.
 */
export function useTimeline(duration = SCENE_DURATION) {
  const [pxPerSec, setPxPerSec] = useState(DEFAULT_PX_PER_SEC);
  const [time, setTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [scrollLeft, setScrollLeft] = useState(0);
  /** Width of the scrolling viewport (rail excluded), measured. */
  const [viewport, setViewport] = useState(0);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const timeRef = useRef(time);
  timeRef.current = time;
  const pxRef = useRef(pxPerSec);
  pxRef.current = pxPerSec;

  /** Lead-in padding: half a viewport, so time 0 can sit under the centre. */
  const lead = viewport / 2;

  const seek = useCallback(
    (seconds: number) => {
      const next = Math.min(Math.max(0, seconds), duration);
      timeRef.current = next;
      setTime(next);
    },
    [duration],
  );

  /* --- Scroll ⇄ time ---------------------------------------------------------- */

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      setScrollLeft(el.scrollLeft);
      // Scrolling IS scrubbing. When the scroll came from us this resolves to
      // the time it was derived from, so there is nothing to guard against.
      const t = el.scrollLeft / pxRef.current;
      if (Math.abs(t - timeRef.current) > 0.0005) {
        timeRef.current = t;
        setTime(t);
      }
    };
    const measure = () => setViewport(el.clientWidth - RAIL);
    // A vertical wheel/trackpad gesture scrubs too: the tracks have no vertical
    // scroll of their own (the timeline hugs its content), so deltaY would
    // otherwise do nothing. Both axes drive the one scroll = the one time.
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    measure();
    el.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('wheel', onWheel, { passive: false });
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('wheel', onWheel);
      observer.disconnect();
    };
  }, []);

  /** Put the scroll where the time says it should be, after every commit — and
   *  commit the same number to state IN THE SAME pass. Waiting for the async
   *  scroll event leaves one painted frame where `time` is new but
   *  `scrollLeft` is stale, which threw the playhead off-centre for a flash on
   *  every wave-scrub step — reading as a glitching "clone" of the line. */
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const want = time * pxPerSec;
    if (Math.abs(el.scrollLeft - want) > 0.5) {
      el.scrollLeft = want;
      setScrollLeft(el.scrollLeft);
    }
  }, [time, pxPerSec, viewport]);

  /* --- Transport ----------------------------------------------------------------- */

  const toggle = useCallback(() => {
    setIsPlaying((playing) => {
      if (playing) return false;
      // Pressing play at the very end rewinds to the top.
      if (timeRef.current >= duration - 0.02) {
        timeRef.current = 0;
        setTime(0);
      }
      return true;
    });
  }, [duration]);

  const pause = useCallback(() => setIsPlaying(false), []);
  const stop = useCallback(() => {
    setIsPlaying(false);
    timeRef.current = duration;
    setTime(duration);
  }, [duration]);

  /* --- Zoom: the playhead is centred, so zoom re-derives around it for free --- */

  const zoomBy = useCallback((factor: number) => {
    setPxPerSec((cur) => {
      const next = Math.min(MAX_PX_PER_SEC, Math.max(MIN_PX_PER_SEC, cur * factor));
      pxRef.current = next;
      return next;
    });
  }, []);

  const zoomToFit = useCallback(() => {
    if (!viewport) return;
    const next = Math.min(MAX_PX_PER_SEC, Math.max(MIN_PX_PER_SEC, (viewport - 24) / duration));
    pxRef.current = next;
    setPxPerSec(next);
  }, [viewport, duration]);

  /** Total scrollable content: lead-in + the take + lead-out. */
  const contentWidth = lead * 2 + duration * pxPerSec;
  /** Playhead's x inside the viewport (rail excluded) — effectively the centre. */
  const playheadOffset = lead + time * pxPerSec - scrollLeft;

  return {
    time,
    isPlaying,
    pxPerSec,
    scrollLeft,
    viewport,
    lead,
    duration,
    contentWidth,
    playheadOffset,
    scrollerRef,
    seek,
    toggle,
    pause,
    stop,
    zoomBy,
    zoomToFit,
  };
}

export type Timeline = ReturnType<typeof useTimeline>;
