import { useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

export type DragKind = 'move' | 'start' | 'end';

/**
 * Drag-to-retime for timeline clips.
 *
 * Returns a `dragProps(kind, baseSeconds)` spreader. Whichever element it is
 * spread onto captures the pointer, so a 16px trim handle keeps tracking once
 * the cursor leaves it — which it does almost immediately.
 *
 * The gesture is measured in SECONDS, converted from pixel travel through the
 * live `pxPerSec`, so a drag means the same thing at every zoom level: 40px of
 * travel is a bigger edit when zoomed out, which is what you want.
 *
 * `baseSeconds` is captured at pointer-down and every frame is computed from it
 * rather than accumulated, so a drag that hits a clamp parks on the limit and
 * picks straight back up when you drag away — no drift.
 */
export function useClipDrag(
  pxPerSec: number,
  commit: (kind: DragKind, seconds: number) => void,
  onDone?: () => void,
) {
  const drag = useRef<{ kind: DragKind; x0: number; base: number } | null>(null);
  /** True once the pointer has actually travelled — releasing a drag fires a
   *  click on the same element, which would toggle the selection under the
   *  user's hands (and close an open inspector mid-edit). A real drag swallows
   *  that click; a stationary press still selects normally. */
  const moved = useRef(false);
  const pxRef = useRef(pxPerSec);
  pxRef.current = pxPerSec;

  const dragProps = (kind: DragKind, baseSeconds: number) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      // Keep the click from also selecting/deselecting, and kill the text
      // selection that would otherwise smear across the timeline.
      e.stopPropagation();
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { kind, x0: e.clientX, base: baseSeconds };
      moved.current = false;
    },
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
      const d = drag.current;
      if (!d) return;
      e.stopPropagation();
      if (Math.abs(e.clientX - d.x0) > 3) moved.current = true;
      commit(d.kind, d.base + (e.clientX - d.x0) / pxRef.current);
    },
    onPointerUp: (e: ReactPointerEvent<HTMLElement>) => {
      if (!drag.current) return;
      drag.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      onDone?.();
    },
    onPointerCancel: () => {
      drag.current = null;
      onDone?.();
    },
    onClickCapture: (e: React.MouseEvent<HTMLElement>) => {
      if (moved.current) {
        e.preventDefault();
        e.stopPropagation();
        moved.current = false;
      }
    },
  });

  return { dragProps, isDragging: () => drag.current !== null };
}
