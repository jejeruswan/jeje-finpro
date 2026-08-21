import { useCallback, useEffect, useRef, useState } from 'react';

/** How long a rerender takes in this world. */
export const RENDER_SEC = 1;
/** The soft-in beat: the frame EASES soft rather than snapping, then spends
 *  the rest of the second resolving. Mirrored by the CSS transitions. */
const BLUR_IN_MS = 150;

export type RenderPhase = 'clean' | 'dirty' | 'resolving';

/**
 * The one-second rerender world: every watched edit re-renders the video, and
 * the stage shows it as a DIFFUSION RESOLVE — the frame eases soft the moment
 * the edit lands (`dirty`), then sharpens back across the rest of the render
 * second (`resolving`).
 *
 * DRAGS RENDER ON RELEASE: a drag commits an edit on every pointer move, and
 * rendering through that reads as a blur/sharpen flicker. So a kick that
 * arrives while a pointer button is down only marks the render PENDING, and
 * the one real cycle fires on pointer-up — the stage stays crisp while the
 * hand is still working. Keyboard and click-completed edits (whose handlers
 * run after pointer-up) render immediately.
 *
 * `kick()` is the only input; wrap it around whichever edits should re-render.
 */
export function useRenderStatus() {
  const [phase, setPhase] = useState<RenderPhase>('clean');
  const resolveT = useRef<number | null>(null);
  const settleT = useRef<number | null>(null);
  const pointerDown = useRef(false);
  const pending = useRef(false);

  const begin = useCallback(() => {
    setPhase('dirty');
    if (resolveT.current) window.clearTimeout(resolveT.current);
    if (settleT.current) window.clearTimeout(settleT.current);
    resolveT.current = window.setTimeout(() => setPhase('resolving'), BLUR_IN_MS);
    settleT.current = window.setTimeout(() => setPhase('clean'), RENDER_SEC * 1000);
  }, []);

  const kick = useCallback(() => {
    if (pointerDown.current) {
      pending.current = true;
      return;
    }
    begin();
  }, [begin]);

  /* Pointer state is watched at the window in the CAPTURE phase, so pointer
     capture on drag handles can't hide the release from us. */
  useEffect(() => {
    const onDown = () => {
      pointerDown.current = true;
    };
    const onUp = () => {
      pointerDown.current = false;
      if (pending.current) {
        pending.current = false;
        begin();
      }
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onUp, true);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onUp, true);
    };
  }, [begin]);

  useEffect(
    () => () => {
      if (resolveT.current) window.clearTimeout(resolveT.current);
      if (settleT.current) window.clearTimeout(settleT.current);
    },
    [],
  );

  return { phase, kick };
}

export type RenderStatus = ReturnType<typeof useRenderStatus>;
