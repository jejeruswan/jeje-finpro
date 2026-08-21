import { useCallback, useEffect, useRef, useState } from 'react';
import { renderDurationMs, SCENES, SPAWN_INTERVAL_MS } from './data';

/**
 * "The entry point is the wait": there is no loading screen. Scene cards
 * materialize onto the corkboard one by one, each with its thumbnail in a
 * heavy blur that sharpens when its simulated background render finishes.
 * Everything is interactive from the moment a card lands — diving into a
 * cooking card never pauses the other renders, because the timers here keep
 * running no matter which level is on screen.
 */
export function useMaterialization() {
  const [spawned, setSpawned] = useState<string[]>([]);
  const [ready, setReady] = useState<Record<string, boolean>>({});
  const [started, setStarted] = useState(false);
  const timers = useRef<number[]>([]);

  const begin = useCallback(() => {
    setStarted((already) => {
      if (already) return already;
      SCENES.forEach((s, i) => {
        timers.current.push(
          window.setTimeout(() => {
            setSpawned((list) => (list.includes(s.id) ? list : [...list, s.id]));
            timers.current.push(
              window.setTimeout(() => setReady((m) => ({ ...m, [s.id]: true })), renderDurationMs(i)),
            );
          }, 350 + i * SPAWN_INTERVAL_MS),
        );
      });
      return true;
    });
  }, []);

  /** A blank inserted card spawns visible and READY — it must not cook while
   *  its edit form is open; the ✓ commit recooks it into its first render. */
  const spawnReady = useCallback((id: string) => {
    setSpawned((list) => (list.includes(id) ? list : [...list, id]));
    setReady((m) => ({ ...m, [id]: true }));
  }, []);

  /** A generative edit (summary, duration, cast) marks the scene stale: its
   *  thumbnail drops back into the blur and sharpens again when the simulated
   *  re-render lands — the same materialization physics as first generation. */
  const recook = useCallback((id: string, ms = 3200) => {
    setReady((m) => ({ ...m, [id]: false }));
    timers.current.push(window.setTimeout(() => setReady((m) => ({ ...m, [id]: true })), ms));
  }, []);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  return { started, begin, spawnReady, recook, spawnedIds: spawned, readyMap: ready };
}
