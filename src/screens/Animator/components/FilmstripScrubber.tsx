import { useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

export type StripScene = { id: string; thumb: string };

/**
 * The embedded filmstrip scrubber (Figma 673-130315): the take's time player,
 * drawn INSIDE the video frame's bottom band. One thumb per scene, in order —
 * the strip IS the take, so position along it is position in time:
 *
 *  - the cyan pin is the playhead, gliding across the thumbs during playback
 *  - the thumb whose segment holds the playhead wears the cyan stroke, and the
 *    "N — total" index at the frame's right edge names that segment
 *  - click a thumb to jump to that scene's start; drag anywhere to scrub
 *  - double-click a thumb to leave the canvas and fall back to the corkboard
 */
export function FilmstripScrubber({
  scenes,
  duration,
  time,
  onSeek,
  onPause,
  onExit,
}: {
  scenes: StripScene[];
  duration: number;
  time: number;
  onSeek: (seconds: number) => void;
  onPause: () => void;
  /** Double-clicking a thumb zooms back out to the corkboard. */
  onExit?: () => void;
}) {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const scrubbing = useRef(false);

  const frac = duration > 0 ? Math.min(1, Math.max(0, time / duration)) : 0;
  const segment = Math.min(scenes.length - 1, Math.floor(frac * scenes.length));

  /** Continuous scrub: pointer x across the strip is a fraction of the take. */
  const seekAt = (clientX: number) => {
    const row = rowRef.current;
    if (!row || duration <= 0) return;
    const r = row.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    onSeek(f * duration);
  };

  return (
    <>
      {/* Bottom shade so the strip reads over any picture. */}
      <div className="anim-strip-shade" aria-hidden />

      <div
        className="anim-strip"
        ref={rowRef}
        role="slider"
        tabIndex={0}
        aria-label="Scrub the take"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(time * 100) / 100}
        /* On the row, not the thumbs: pointer capture (below) retargets click
           events to the row, so a thumb-level dblclick handler never fires. */
        onDoubleClick={onExit}
        onPointerDown={(e: ReactPointerEvent<HTMLDivElement>) => {
          if (e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          scrubbing.current = true;
          onPause();
          // Grabbing the pin starts a drag from wherever the playhead already
          // is — no jump. Pressing a thumb jumps to that SCENE's start;
          // presses in the gaps scrub to the exact fraction under the pointer.
          const target = e.target as HTMLElement;
          if (!target.closest('.anim-strip__pin')) {
            const hit = target.closest('[data-strip-idx]');
            if (hit instanceof HTMLElement && duration > 0) {
              const i = Number(hit.dataset.stripIdx);
              onSeek((i / scenes.length) * duration);
            } else {
              seekAt(e.clientX);
            }
          }
        }}
        onPointerMove={(e) => {
          if (scrubbing.current) seekAt(e.clientX);
        }}
        onPointerUp={(e) => {
          scrubbing.current = false;
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
          }
        }}
        onPointerCancel={() => {
          scrubbing.current = false;
        }}
      >
        {scenes.map((s, i) => (
          <button
            type="button"
            key={s.id}
            data-scene={s.id}
            data-strip-idx={i}
            className={`anim-strip__thumb ${i === segment ? 'anim-strip__thumb--active' : ''}`}
            aria-label={`Scene ${i + 1}`}
          >
            <img src={s.thumb} alt="" draggable={false} />
          </button>
        ))}
        {/* The playhead pin: a dot-topped hairline riding the strip. */}
        <span className="anim-strip__pin" style={{ left: `${frac * 100}%` }} aria-hidden />
      </div>

      <span className="anim-strip__index" aria-hidden>
        {segment + 1} — {scenes.length}
      </span>
    </>
  );
}
