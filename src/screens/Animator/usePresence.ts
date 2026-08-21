import { useCallback, useState } from 'react';
import { MIN_PRESENCE_SEC, PRESENCE_ENTITIES, SCENE_DURATION } from './data';
import type { PresenceEntity } from './data';

export type PresenceEdge = 'start' | 'end';

/**
 * Presence editing for the subject lens: each entity's on-screen runs.
 *
 * Trims clamp so a run keeps at least MIN_PRESENCE_SEC of life and never
 * crosses a neighbouring run — but the edges trim FREELY, no rolling: a gap
 * in a presence line is real absence, not a seam shared with a neighbour.
 */
export function usePresence(duration = SCENE_DURATION) {
  const [entities, setEntities] = useState<PresenceEntity[]>(PRESENCE_ENTITIES);

  const retimeRun = useCallback(
    (entityId: string, runId: string, edge: PresenceEdge, seconds: number) => {
      setEntities((list) =>
        list.map((en) => {
          if (en.id !== entityId) return en;
          const i = en.runs.findIndex((r) => r.id === runId);
          if (i < 0) return en;
          const runs = en.runs.map((r) => ({ ...r }));
          const run = runs[i];
          if (edge === 'start') {
            const min = i > 0 ? runs[i - 1].end + MIN_PRESENCE_SEC : 0;
            run.start = Math.min(Math.max(seconds, min), run.end - MIN_PRESENCE_SEC);
          } else {
            const max = i < runs.length - 1 ? runs[i + 1].start - MIN_PRESENCE_SEC : duration;
            run.end = Math.min(Math.max(seconds, run.start + MIN_PRESENCE_SEC), max);
          }
          return { ...en, runs };
        }),
      );
    },
    [duration],
  );

  const removeRun = useCallback((entityId: string, runId: string) => {
    setEntities((list) =>
      list.map((en) =>
        en.id === entityId ? { ...en, runs: en.runs.filter((r) => r.id !== runId) } : en,
      ),
    );
  }, []);

  return { entities, retimeRun, removeRun };
}

export type Presence = ReturnType<typeof usePresence>;
