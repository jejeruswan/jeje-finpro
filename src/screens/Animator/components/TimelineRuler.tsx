import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { MagnifyingGlassMinus, MagnifyingGlassPlus, ArrowsOutLineHorizontal } from '@phosphor-icons/react';
import { IconButton } from '../../../ui/IconButton';
import { RAIL, formatTimecode, rulerStep } from '../data';

/**
 * The ruler, and the scrub surface.
 *
 * It does NOT own a scroller of its own: it translates its tick strip by the
 * tracks' `scrollLeft`, so ruler, playhead and content move as one unit — the
 * standard NLE behaviour, and the thing that keeps the time readout honest at
 * any scroll position.
 *
 * Clicking or dragging anywhere on the strip seeks, so the playhead is finally
 * reachable by hand instead of only by play/pause.
 */
export function TimelineRuler({
  time,
  duration,
  pxPerSec,
  scrollLeft,
  pad,
  playheadOffset,
  onSeek,
  onZoomBy,
  onZoomToFit,
}: {
  time: number;
  duration: number;
  pxPerSec: number;
  scrollLeft: number;
  /** Inset between the rail and t = 0 (TRACK_PAD). */
  pad: number;
  /** The playhead's x inside the viewport (rail excluded). */
  playheadOffset: number;
  onSeek: (seconds: number) => void;
  onZoomBy: (factor: number) => void;
  onZoomToFit: () => void;
}) {
  const stripRef = useRef<HTMLDivElement | null>(null);
  const scrubbing = useRef(false);
  /** Strip width, for clamping the time pill inside the visible ruler. */
  const [stripW, setStripW] = useState(0);

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const measure = () => setStripW(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const step = rulerStep(pxPerSec);
  /* The ruler runs an HOUR past the take, not just to its end — the take ends,
     the ruler doesn't. Ticks are windowed to the visible stretch so the extra
     hour costs nothing: only the segments actually on screen are rendered. */
  const MAX_TICK = duration + 3600;
  const firstVisible = Math.max(0, Math.floor(((scrollLeft - pad) / pxPerSec - step) / step) * step);
  const lastVisible = Math.min(MAX_TICK, (scrollLeft + stripW - pad) / pxPerSec + step);
  const majors: number[] = [];
  for (let s = firstVisible; s <= lastVisible; s += step) majors.push(s);

  /** Pointer x → time, accounting for the rail, the lead-in and the scroll. */
  const timeAt = (clientX: number) => {
    const el = stripRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return (clientX - rect.left - RAIL - pad + scrollLeft) / pxPerSec;
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    scrubbing.current = true;
    onSeek(timeAt(e.clientX));
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!scrubbing.current) return;
    onSeek(timeAt(e.clientX));
  };
  const endScrub = (e: ReactPointerEvent<HTMLDivElement>) => {
    scrubbing.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  // Screen x of the playhead inside the strip (rail included). The pill is
  // centred on it but clamped so it can never be cut off at either edge.
  const headX = RAIL + playheadOffset;
  const HALF_PILL = 58;
  const pillX = Math.max(HALF_PILL + 2, Math.min(headX, Math.max(HALF_PILL + 2, stripW - HALF_PILL - 2)));

  return (
    <div className="anim-ruler-row">
      {/* Timeline zoom floats ABOVE the tick strip, left-aligned to the same
          16px inset as the canvas's floating pills. */}
      <div className="anim-tlzoom surface">
        <IconButton size={24} variant="ghost" aria-label="Zoom out timeline" onClick={() => onZoomBy(1 / 1.4)}>
          <MagnifyingGlassMinus size={14} />
        </IconButton>
        <IconButton size={24} variant="ghost" aria-label="Fit timeline to width" onClick={onZoomToFit}>
          <ArrowsOutLineHorizontal size={14} />
        </IconButton>
        <IconButton size={24} variant="ghost" aria-label="Zoom in timeline" onClick={() => onZoomBy(1.4)}>
          <MagnifyingGlassPlus size={14} />
        </IconButton>
      </div>

      <div
        className="anim-ruler"
        ref={stripRef}
        role="slider"
        tabIndex={0}
        aria-label="Playhead"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(time * 100) / 100}
        aria-valuetext={formatTimecode(time)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endScrub}
        onPointerCancel={endScrub}
        onKeyDown={(e) => {
          const nudge = e.shiftKey ? 1 : 1 / 30; // a frame, or a second
          if (e.key === 'ArrowLeft') { e.preventDefault(); onSeek(time - nudge); }
          else if (e.key === 'ArrowRight') { e.preventDefault(); onSeek(time + nudge); }
          else if (e.key === 'Home') { e.preventDefault(); onSeek(0); }
          else if (e.key === 'End') { e.preventDefault(); onSeek(duration); }
        }}
      >
        {/* The tick strip is translated rather than scrolled, so it can never
            drift out of step with the tracks below. Segments are positioned
            absolutely at their own time, which is what lets the windowing
            above skip everything off screen. */}
        <div className="anim-ruler__ticks" style={{ transform: `translateX(${-scrollLeft}px)` }}>
          {majors.map((s) => (
            <div
              className="anim-ruler__seg"
              key={s}
              style={{ left: RAIL + pad + s * pxPerSec, width: step * pxPerSec }}
            >
              <span className="anim-ruler__label">{s}</span>
              <span className="anim-ruler__dots">
                {[0, 1, 2, 3].map((d) => (
                  <span className="anim-ruler__dot" key={d} />
                ))}
              </span>
            </div>
          ))}
        </div>

      </div>

      {/* Current-time pill: centred on the playhead line, clamped so its digits
          can never be cut off at either edge — and rendered OUTSIDE the strip,
          which clips its ticks with overflow:hidden and was shaving the pill. */}
      <div className="anim-ruler__time" style={{ left: pillX }}>
        {formatTimecode(time)}
        <span className="anim-ruler__total"> / {formatTimecode(duration)}</span>
      </div>

    </div>
  );
}
