import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ComponentPropsWithoutRef, KeyboardEvent, PointerEvent } from 'react';

/** Natural height of the timeline: 8+8 padding + 20 ruler + 52 scene bar +
 *  3 × 104 avatar rows. Also the height a double-click on the handle restores. */
export const TIMELINE_DEFAULT_HEIGHT = 400;
/** Enough to keep the ruler and the scene bar visible. */
export const TIMELINE_MIN_HEIGHT = 120;
/** The canvas never gets squeezed below this, which caps how far the timeline
 *  can grow. Sized so the left tool pillar always fits: 16+16 canvas padding +
 *  6 × 32 tool buttons + 5 × 12 gaps + 12 gap + 40 play button. */
const CANVAS_MIN_HEIGHT = 336;
/** Keep in sync with `.anim-resizer` in animator.css. */
const RESIZER_HEIGHT = 10;
const KEY_STEP = 24;
const KEY_STEP_LARGE = 96;

export type TimelineResizerProps = ComponentPropsWithoutRef<'div'> & { isResizing: boolean };

/**
 * Drives the draggable splitter between the video preview and the timeline.
 *
 * `containerRef` goes on the flex column that holds both (`.anim-main`) — it is
 * measured to work out how tall the timeline is allowed to get. Spread
 * `resizerProps` onto <TimelineResizer /> and apply `timelineHeight` to the
 * timeline container.
 */
export function useResizableTimeline(natural = TIMELINE_DEFAULT_HEIGHT) {
  const containerRef = useRef<HTMLElement | null>(null);
  const [height, setHeight] = useState(natural);
  const [maxHeight, setMaxHeight] = useState(natural);
  const [isResizing, setIsResizing] = useState(false);
  // The drag lives in a ref, not in `isResizing`: a fast drag can fire
  // pointermove in the same tick as pointerdown, before React has committed the
  // state update, and those moves would be dropped. `isResizing` is for styling.
  const dragRef = useRef({ active: false, startY: 0, startHeight: 0 });

  // Re-measure the ceiling whenever the available space changes, and pull the
  // timeline back down if the window shrank underneath it.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      // The ceiling is the CONTENT height (the timeline hugs its tracks —
      // growing past them would only add dead space), and the canvas floor.
      const max = Math.max(
        TIMELINE_MIN_HEIGHT,
        Math.min(natural, el.clientHeight - CANVAS_MIN_HEIGHT - RESIZER_HEIGHT),
      );
      setMaxHeight(max);
      setHeight((h) => Math.min(h, max));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [natural]);

  // Keep the row-resize cursor while dragging even when the pointer strays off
  // the handle (pointer capture keeps the events coming, not the cursor).
  useEffect(() => {
    if (!isResizing) return;
    document.body.classList.add('is-row-resizing');
    return () => document.body.classList.remove('is-row-resizing');
  }, [isResizing]);

  const clamp = useCallback(
    (next: number) => Math.min(Math.max(next, TIMELINE_MIN_HEIGHT), maxHeight),
    [maxHeight],
  );

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault(); // don't start a text selection
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { active: true, startY: e.clientY, startHeight: height };
    setIsResizing(true);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    // Dragging up (negative delta) grows the timeline.
    const { startY, startHeight } = dragRef.current;
    setHeight(clamp(startHeight - (e.clientY - startY)));
  };

  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setIsResizing(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const step = e.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
    // Functional update so held-down key repeats each move off the latest
    // height rather than the one captured when this handler was created.
    setHeight((h) =>
      clamp(
        {
          ArrowUp: h + step,
          ArrowDown: h - step,
          Home: TIMELINE_MIN_HEIGHT,
          End: maxHeight,
        }[e.key] as number,
      ),
    );
  };

  const resizerProps: TimelineResizerProps = {
    role: 'separator',
    'aria-orientation': 'horizontal',
    'aria-label': 'Resize timeline',
    'aria-valuenow': Math.round(height),
    'aria-valuemin': TIMELINE_MIN_HEIGHT,
    'aria-valuemax': Math.round(maxHeight),
    tabIndex: 0,
    isResizing,
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    onKeyDown,
    onDoubleClick: () => setHeight(clamp(natural)),
  };

  return { containerRef, timelineHeight: height, isResizing, resizerProps };
}
