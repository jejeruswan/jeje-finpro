import { useCallback, useState } from 'react';
import { MIN_SHOT_SEC, SCENES, presetLabel } from './data';
import type { Focus, Scene, ShotPreset } from './data';

/**
 * Owns the camera-shot list and every edit the Shot Style inspector can make.
 *
 * The shots live here rather than in the module-level `SCENES` const because
 * the inspector mutates them — renaming, retiming, reframing and adding focus
 * cuts all have to show up on the timeline rail immediately, which only works
 * if the rail renders from state.
 *
 * Timing rules are enforced here, at the single point every edit funnels
 * through, so the scrub handles and the typed inputs cannot disagree about
 * what is legal: a shot never starts before 0 and never gets shorter than
 * MIN_SHOT_SEC.
 */
export function useShotEditing(initial: Scene[] = SCENES) {
  const [scenes, setScenes] = useState<Scene[]>(initial);

  const patch = useCallback(
    (id: string, next: (s: Scene) => Partial<Scene>) =>
      setScenes((cur) => cur.map((s) => (s.id === id ? { ...s, ...next(s) } : s))),
    [],
  );

  /** Free-text rename from the inline title editor. Empty names are ignored so
   *  a clip can never end up with an unclickable blank tag. */
  const rename = useCallback(
    (id: string, label: string) => {
      const trimmed = label.trim();
      if (trimmed) patch(id, () => ({ label: trimmed }));
    },
    [patch],
  );

  /**
   * Move one boundary, clamped against the other. Returns nothing — the caller
   * re-reads the scene to see where it actually landed, so a scrub that pushes
   * past a limit simply parks on it instead of drifting out of sync.
   */
  const retime = useCallback(
    (id: string, edge: 'start' | 'end', seconds: number) =>
      patch(id, (s) =>
        edge === 'start'
          ? { start: Math.min(Math.max(0, seconds), s.end - MIN_SHOT_SEC) }
          : { end: Math.max(seconds, s.start + MIN_SHOT_SEC) },
      ),
    [patch],
  );

  /** Reframing also re-tags the clip, which is what surfaces the change on the
   *  rail. A manual rename sticks until the next preset or speaker change. */
  const setPreset = useCallback(
    (id: string, preset: ShotPreset) =>
      patch(id, (s) => ({ preset, label: presetLabel(preset, s.speaker) })),
    [patch],
  );

  const setSpeaker = useCallback(
    (id: string, speaker: string) =>
      patch(id, (s) => ({ speaker, label: presetLabel(s.preset, speaker) })),
    [patch],
  );

  /** A new cut lands at the shot's midpoint — inside the clip by construction,
   *  so its keyframe marker is always visible — and holds for a second. */
  const addFocus = useCallback(
    (id: string) =>
      patch(id, (s) => {
        const focus: Focus = {
          id: `${s.id}-f${Date.now().toString(36)}`,
          target: 'camera',
          time: Math.round(((s.start + s.end) / 2) * 100) / 100,
          duration: Math.min(1, s.end - s.start),
        };
        return { focuses: [...s.focuses, focus] };
      }),
    [patch],
  );

  const removeFocus = useCallback(
    (id: string, focusId: string) =>
      patch(id, (s) => ({ focuses: s.focuses.filter((f) => f.id !== focusId) })),
    [patch],
  );

  const updateFocus = useCallback(
    (id: string, focusId: string, next: Partial<Focus>) =>
      patch(id, (s) => ({
        focuses: s.focuses.map((f) => (f.id === focusId ? { ...f, ...next } : f)),
      })),
    [patch],
  );

  return { scenes, rename, retime, setPreset, setSpeaker, addFocus, removeFocus, updateFocus };
}

export type ShotEditing = ReturnType<typeof useShotEditing>;
