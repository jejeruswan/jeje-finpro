import { useRef, useState } from 'react';
import type { CoverageStroke } from '../data';

export type LineRect = { top: number; bottom: number };

/** Small stable wobble so the strokes feel drawn, not plotted. */
const wob = (seed: number, y: number) =>
  Math.sin(y * 0.045 + seed * 7.3) * 1.5 + Math.sin(y * 0.012 + seed * 2.1) * 1.1;

/**
 * Path from y1 → y2 with hand wobble; inside `zig` it becomes a sawtooth
 * (the setup hears this stretch but doesn't see it).
 */
function strokePath(x: number, y1: number, y2: number, seed: number, zig?: { top: number; bottom: number }) {
  const pts: string[] = [`M ${(x + wob(seed, y1)).toFixed(1)} ${y1.toFixed(1)}`];
  for (let y = y1 + 7; y < y2; y += 7) {
    let dx = wob(seed, y);
    if (zig && y > zig.top + 4 && y < zig.bottom - 4) {
      dx += Math.floor((y - zig.top) / 6) % 2 ? 5 : -5;
    }
    pts.push(`L ${(x + dx).toFixed(1)} ${y.toFixed(1)}`);
  }
  pts.push(`L ${(x + wob(seed, y2)).toFixed(1)} ${y2.toFixed(1)}`);
  return pts.join(' ');
}

type Props = {
  strokes: CoverageStroke[];
  rects: LineRect[];
  height: number;
  /** Commit a dragged endpoint to its snapped line index. */
  onCommit: (strokeId: string, endLine: number) => void;
};

type DragState = { id: string; y: number };
type SettleState = { id: string; phase: 'working' | 'check' };

export function CoverageMargin({ strokes, rects, height, onCommit }: Props) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const [settle, setSettle] = useState<SettleState | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const timers = useRef<number[]>([]);

  if (rects.length === 0) return null;

  const yTop = (li: number) => (rects[li]?.top ?? 0) - 4;
  const yBottom = (li: number) => (rects[li]?.bottom ?? 0) - 2;

  /** Nearest line-bottom boundary to a raw y — where the endpoint snaps. */
  const snapLine = (y: number, minLine: number) => {
    let best = minLine;
    let bestD = Infinity;
    rects.forEach((_, li) => {
      if (li < minLine) return;
      const d = Math.abs(yBottom(li) - y);
      if (d < bestD) {
        bestD = d;
        best = li;
      }
    });
    return best;
  };

  const localY = (e: React.PointerEvent) => {
    const box = svgRef.current!.getBoundingClientRect();
    return e.clientY - box.top;
  };

  const startDrag = (id: string, e: React.PointerEvent<SVGRectElement>) => {
    (e.currentTarget as SVGRectElement).setPointerCapture(e.pointerId);
    setDrag({ id, y: localY(e) });
  };

  const moveDrag = (e: React.PointerEvent<SVGRectElement>) => {
    if (!drag) return;
    setDrag({ ...drag, y: Math.min(height - 4, Math.max(12, localY(e))) });
  };

  const endDrag = (stroke: CoverageStroke) => {
    if (!drag) return;
    const line = snapLine(drag.y, stroke.startLine);
    onCommit(stroke.id, line);
    setDrag(null);
    // Marks lifecycle: a human decided → brief working pulse → the ink dries.
    setSettle({ id: stroke.id, phase: 'working' });
    timers.current.forEach(clearTimeout);
    timers.current = [
      window.setTimeout(() => setSettle({ id: stroke.id, phase: 'check' }), 1500),
      window.setTimeout(() => setSettle(null), 2600),
    ];
  };

  return (
    <div className="cov" style={{ height }}>
      <svg ref={svgRef} className="cov-svg" width="118" height={height}>
        {strokes.map((s, i) => {
          const x = 24 + i * 34;
          const y1 = yTop(s.startLine);
          const dragging = drag?.id === s.id;
          const y2 = dragging ? drag.y : yBottom(s.endLine);
          const zig =
            s.zigzagLine != null
              ? { top: rects[s.zigzagLine].top, bottom: rects[s.zigzagLine].bottom }
              : undefined;
          const state = dragging ? 'drag' : settle?.id === s.id ? settle.phase : 'idle';
          const snapY = dragging ? yBottom(snapLine(drag.y, s.startLine)) : null;
          return (
            <g key={s.id} className={`cov-stroke is-${state}`}>
              <path d={strokePath(x, y1, y2, i + 1, zig)} className="cov-path" />
              {/* faint second pass = slight width variation, drawn feel */}
              <path d={strokePath(x + 0.7, y1 + 2, y2 - 2, i + 1.4, zig)} className="cov-path cov-path--echo" />

              {/* snap preview while a human is deciding */}
              {snapY != null && <line x1={x - 8} x2={x + 8} y1={snapY} y2={snapY} className="cov-snap" />}

              <circle cx={x + wob(i + 1, y2)} cy={y2} r={4.5} className="cov-end" />
              {/* generous hit area for the endpoint */}
              <rect
                x={x - 14}
                y={y2 - 12}
                width={28}
                height={24}
                className="cov-hit"
                onPointerDown={(e) => startDrag(s.id, e)}
                onPointerMove={moveDrag}
                onPointerUp={() => endDrag(s)}
              />
              {state === 'check' && (
                <text x={x + 10} y={y2 + 4} className="cov-check">
                  ✓
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {strokes.map((s, i) => (
        <span
          key={s.id}
          className="cov-label"
          style={{ left: 24 + i * 34 - 42, top: yTop(s.startLine) - 18 - (i % 2) * 13 }}
        >
          {s.label}
        </span>
      ))}
    </div>
  );
}
