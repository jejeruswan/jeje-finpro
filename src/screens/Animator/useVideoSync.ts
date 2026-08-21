import { useEffect, useRef } from 'react';
import { SOURCE_IN } from './data';

/**
 * Binds the <video> element to the timeline, with the VIDEO as the clock.
 *
 * During playback the playhead is read from `video.currentTime` rather than from
 * a wall clock or a frame counter. That is the only arrangement where the
 * picture and the playhead cannot drift apart: whatever the browser does to the
 * frame rate — throttling a background tab, dropping frames while decoding, or
 * stalling on a buffer — the playhead reports where the video actually is.
 *
 * The scene is a WINDOW into the source footage: `SOURCE_IN` is where the take
 * starts in the file, so timeline time `t` is source time `SOURCE_IN + t`. That
 * keeps the ruler honest about the scene's own length while letting one long
 * placeholder stand in for the raw take.
 */
export function useVideoSync(
  video: React.RefObject<HTMLVideoElement | null>,
  {
    time,
    isPlaying,
    duration,
    onTime,
    onEnded,
  }: {
    time: number;
    isPlaying: boolean;
    duration: number;
    onTime: (seconds: number) => void;
    onEnded: () => void;
  },
) {
  // Latest callbacks and time without re-binding the loop every render.
  const latest = useRef({ onTime, onEnded, duration, time });
  latest.current = { onTime, onEnded, duration, time };
  /** True while the video is the one moving the playhead, so the sync effect
   *  below doesn't fight it by writing currentTime back on every frame. */
  const driving = useRef(false);

  /* --- Prime the first frame ----------------------------------------------
     `preload="metadata"` fetches the header but decodes nothing, so the element
     paints black until something makes it seek. At t=0 the sync effect below has
     nothing to correct — video and timeline already agree — so it never asks for
     a frame. Seeking a frame past the in-point on `loadedmetadata` forces the
     decode, and costs one small range request instead of the whole file. */

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const prime = () => {
      v.currentTime = SOURCE_IN + latest.current.time + 1 / 60;
    };
    if (v.readyState >= 1) prime();
    else v.addEventListener('loadedmetadata', prime, { once: true });
    return () => v.removeEventListener('loadedmetadata', prime);
  }, [video]);

  /* --- Transport ----------------------------------------------------------- */

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (isPlaying) {
      // The element's position can end up outside the scene's window — a stale
      // seek, a hot reload mid-load. Snap it back in before playing, or the
      // driving loop reads a time past the end and stops the take instantly.
      const t = v.currentTime - SOURCE_IN;
      if (t < 0 || t >= latest.current.duration) {
        v.currentTime = SOURCE_IN + Math.min(Math.max(latest.current.time, 0), latest.current.duration - 0.1);
      }
      // Muted, so this needs no user-gesture unlock beyond the click that got
      // here. A rejected play (missing file, codec) leaves the playhead parked
      // rather than throwing.
      void v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [isPlaying, video]);

  /* --- Scrubbing: the timeline leads, the video follows -------------------- */

  useEffect(() => {
    const v = video.current;
    if (!v || driving.current) return;
    const want = SOURCE_IN + time;
    // A seek is expensive, so only correct real divergence — a frame's worth.
    if (Math.abs(v.currentTime - want) > 0.04) v.currentTime = want;
  }, [time, video]);

  /* --- Playing: the video leads, the timeline follows --------------------- */

  useEffect(() => {
    if (!isPlaying) {
      driving.current = false;
      return;
    }
    const v = video.current;
    if (!v) return;

    let raf = 0;
    let cancelled = false;
    driving.current = true;

    const tick = () => {
      if (cancelled) return;
      const t = v.currentTime - SOURCE_IN;
      if (t >= latest.current.duration) {
        // The scene's window ended, even though the file has more to give.
        driving.current = false;
        latest.current.onEnded();
        return;
      }
      latest.current.onTime(Math.max(0, t));
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      driving.current = false;
      cancelAnimationFrame(raf);
    };
  }, [isPlaying, video]);

  /* --- The file running out is also an end ------------------------------- */

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const onEnd = () => latest.current.onEnded();
    v.addEventListener('ended', onEnd);
    return () => v.removeEventListener('ended', onEnd);
  }, [video]);
}
