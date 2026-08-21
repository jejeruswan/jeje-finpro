import { useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { SceneEditing } from '../useSceneEditing';

/**
 * The whole-take scrubber, drawn as an organic curve over the lower part of the
 * video — per the design, the wavy line lives ON the stage, not in the timeline.
 *
 * The wave is not decoration: its height at any point is how DIRECTED that
 * stretch of the take is — attention set, a line being spoken, a reaction
 * firing, a tight framing — smoothed so it reads as a landscape rather than a
 * bar chart. Flat means untouched; swells mean work. So the scrubber doubles as
 * the coverage overview that used to sit above the ruler.
 *
 * It is strictly READ-ONLY about content: clicking or dragging anywhere along
 * it only moves the playhead. Editing attention happens in the timeline; this
 * surface has one verb, which is what keeps the two from colliding.
 */

const W = 1000; // internal viewBox width; the SVG stretches to fit
const H = 48;
const BASE = H - 10; // flat baseline near the bottom
const AMP = 24; // max swell above the baseline — quiet, not a mountain range

/** How directed the take is at time t, in [0, 1]. */
function directedness(scene: SceneEditing, t: number): number {
  let v = 0;
  const mark = scene.markAtTime(t);
  if (mark.kind !== 'none') v += 0.45;
  const shot = scene.shotAt(t);
  if (shot && shot.preset !== 'wide') v += 0.2;
  if (scene.allScripts.some((c) => t >= c.start && t < c.end)) v += 0.25;
  if (scene.allInteractions.some((i) => t >= i.start && t < i.end)) v += 0.25;
  return Math.min(1, v);
}

export function CurvedScrubber({
  scene,
  duration,
  time,
  onSeek,
  onPause,
}: {
  scene: SceneEditing;
  duration: number;
  time: number;
  onSeek: (seconds: number) => void;
  onPause: () => void;
}) {
  const scrubbing = useRef(false);
  /** Mirrors `scrubbing` into the DOM so CSS can keep the wave visible while a
   *  drag is in flight even when the cursor leaves the stage. */
  const [held, setHeld] = useState(false);

  /** Sampled + smoothed curve points, recomputed when the scene changes. */
  const points = useMemo(() => {
    const step = 0.25;
    const raw: number[] = [];
    for (let t = 0; t <= duration; t += step) raw.push(directedness(scene, t));
    // Two passes of a small moving average turn the steps into a landscape.
    const smooth = (a: number[]) =>
      a.map((_, i) => {
        let sum = 0;
        let n = 0;
        for (let k = -3; k <= 3; k++) {
          const j = i + k;
          if (j >= 0 && j < a.length) {
            sum += a[j];
            n++;
          }
        }
        return sum / n;
      });
    const v = smooth(smooth(raw));
    return v.map((d, i) => ({
      x: (i / (v.length - 1)) * W,
      y: BASE - d * AMP,
    }));
    // scene identity changes on every edit, which is exactly when to resample
  }, [scene, duration]);

  /** Catmull-Rom → cubic bezier, for the organic look. */
  const path = useMemo(() => {
    if (points.length < 2) return '';
    let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  }, [points]);

  /** The marker's position: interpolate y along the sampled curve at `time`. */
  const marker = useMemo(() => {
    const f = duration > 0 ? Math.min(1, Math.max(0, time / duration)) : 0;
    const fx = f * (points.length - 1);
    const i = Math.min(points.length - 2, Math.floor(fx));
    const frac = fx - i;
    const y = points[i] ? points[i].y + (points[i + 1].y - points[i].y) * frac : BASE;
    return { x: f * W, y };
  }, [points, time, duration]);

  const seekAt = (e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    onSeek(f * duration);
  };

  return (
    <div
      className="anim-wave"
      data-scrubbing={held || undefined}
      role="slider"
      tabIndex={0}
      aria-label="Scrub the take"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(time * 100) / 100}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        scrubbing.current = true;
        setHeld(true);
        onPause();
        seekAt(e);
      }}
      onPointerMove={(e) => {
        if (scrubbing.current) seekAt(e);
      }}
      onPointerUp={(e) => {
        scrubbing.current = false;
        setHeld(false);
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      }}
      onPointerCancel={() => {
        scrubbing.current = false;
        setHeld(false);
      }}
    >
      {/* One uniform line, per the design; non-scaling-stroke keeps its weight
          when the box stretches. */}
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
        <path className="anim-wave__path" d={path} vectorEffect="non-scaling-stroke" />
      </svg>
      {/* The marker is DOM, not SVG: a circle inside that stretched viewBox
          would render as an ellipse. */}
      <span
        className="anim-wave__marker"
        style={{ left: `${(marker.x / W) * 100}%`, top: `${(marker.y / H) * 100}%` }}
      />
    </div>
  );
}
