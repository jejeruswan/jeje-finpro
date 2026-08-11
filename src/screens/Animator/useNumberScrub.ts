import { useCallback, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

/** Horizontal travel, in px, that advances the value by one step. */
const PX_PER_STEP = 6;

export type ScrubSteps = {
  /** Default increment. */
  step: number;
  /** Shift — coarse. */
  coarse: number;
  /** Alt / Option — fine. */
  fine: number;
};

export const TIME_STEPS: ScrubSteps = { step: 0.1, coarse: 1, fine: 0.01 };

function stepFor(e: { shiftKey: boolean; altKey: boolean }, steps: ScrubSteps): number {
  // Alt wins when both are held: the fine-tune intent is the more specific one.
  if (e.altKey) return steps.fine;
  if (e.shiftKey) return steps.coarse;
  return steps.step;
}

/**
 * Figma-style numeric scrubbing: press anywhere on a scrub zone and drag
 * sideways to change the value. Right increases, left decreases.
 *
 * Returns props to spread onto the zone. Pointer capture means the drag keeps
 * tracking once the cursor leaves the small hit area, which it immediately
 * does — without it a scrub would die a few pixels in.
 *
 * `getValue` is read at pointer-down rather than closed over, so the hook never
 * scrubs from a stale baseline after the parent clamps a value.
 *
 * Changing modifier mid-drag re-baselines against the current pointer position
 * instead of rescaling the whole gesture — otherwise tapping Shift halfway
 * would teleport the value by the accumulated delta times the new step.
 */
export function useNumberScrub({
  getValue,
  onChange,
  steps = TIME_STEPS,
  min = -Infinity,
  max = Infinity,
}: {
  getValue: () => number;
  onChange: (next: number) => void;
  steps?: ScrubSteps;
  min?: number;
  max?: number;
}) {
  const drag = useRef<{ x: number; value: number; step: number } | null>(null);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      // Stops a <label> from focusing its input, and kills the text selection
      // that would otherwise smear across the panel during the drag.
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { x: e.clientX, value: getValue(), step: stepFor(e, steps) };
    },
    [getValue, steps],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const d = drag.current;
      if (!d) return;

      const step = stepFor(e, steps);
      if (step !== d.step) {
        // Re-anchor: everything up to this point is already banked in `value`.
        d.x = e.clientX;
        d.value = getValue();
        d.step = step;
      }

      const ticks = Math.round((e.clientX - d.x) / PX_PER_STEP);
      if (!ticks) return;

      // Round to the step so a 0.01 drag can't leave float dust on the value.
      const raw = d.value + ticks * step;
      const snapped = Math.round(raw / step) * step;
      onChange(Math.min(max, Math.max(min, Math.round(snapped * 1000) / 1000)));
    },
    [getValue, onChange, steps, min, max],
  );

  const end = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  return { onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end };
}
