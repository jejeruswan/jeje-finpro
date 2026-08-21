import { useCallback, useState } from 'react';
import {
  ATTENTION_MARKS,
  AVATAR_ROWS,
  MIN_CLIP_SEC,
  MIN_MARK_GAP,
  MIN_SHOT_SEC,
  SCENE_DURATION,
  SHOTS,
  attentionAt,
  autoAreaName,
  clipText,
  marksToRuns,
  scriptWindow,
  speak,
  subjectsAt,
} from './data';
import type {
  AreaRegion,
  AttentionKind,
  AttentionMark,
  AvatarRow,
  Interaction,
  ScriptClip,
  Shot,
} from './data';

/**
 * Every edit the Frame Canvas can make, funnelled through one place so the
 * timing rules cannot be contradicted by two different controls.
 *
 * ATTENTION is marks, not blocks: a mark starts a state that holds until the
 * next mark, so a gap is not expressible and there is no roll/seal machinery to
 * keep the strip whole. The mark at t = 0 always exists — every instant of the
 * take has a state in force — so it can be retargeted but never moved or
 * deleted.
 *
 * The SHOT rail is still contiguous blocks: every frame keeps exactly one shot
 * style, so a boundary between neighbours is one shared edge and moving it is a
 * ROLL — one clip grows by exactly what the other gives up.
 *
 * Script and interaction clips are events inside the take; they move and resize
 * freely within [0, duration].
 */

/** Roll the shared edge between `list[i]` and `list[i + 1]` to `seconds`. */
function rollAt<T extends { start: number; end: number }>(
  list: T[],
  index: number,
  seconds: number,
  min: number,
): T[] {
  const left = list[index];
  const right = list[index + 1];
  if (!left || !right) return list;
  const at = Math.min(Math.max(seconds, left.start + min), right.end - min);
  return list.map((item, i) => {
    if (i === index) return { ...item, end: at };
    if (i === index + 1) return { ...item, start: at };
    return item;
  });
}

/** The free window around clip `id` on its own lane: from the previous
 *  neighbour's end to the next neighbour's start. Same-lane clips can never
 *  overlap — a move or trim parks against the neighbour, and making room means
 *  shortening the neighbour first. */
function freeWindow(
  list: { id: string; start: number; end: number }[],
  id: string,
  duration: number,
): { lo: number; hi: number } {
  const others = list.filter((c) => c.id !== id).sort((a, b) => a.start - b.start);
  const self = list.find((c) => c.id === id);
  if (!self) return { lo: 0, hi: duration };
  let lo = 0;
  let hi = duration;
  for (const o of others) {
    if (o.end <= self.start + 0.0001) lo = Math.max(lo, o.end);
    if (o.start >= self.end - 0.0001) hi = Math.min(hi, o.start);
  }
  return { lo, hi };
}

/** Re-close a contiguous strip over [0, duration] after a deletion. */
function seal<T extends { start: number; end: number }>(list: T[], duration: number): T[] {
  if (!list.length) return list;
  return list.map((item, i) => ({
    ...item,
    start: i === 0 ? 0 : list[i - 1].end,
    end: i === list.length - 1 ? duration : item.end,
  }));
}

export function useSceneEditing(duration = SCENE_DURATION) {
  const [marks, setMarks] = useState<AttentionMark[]>(ATTENTION_MARKS);
  const [shots, setShots] = useState<Shot[]>(SHOTS);
  const [rows, setRows] = useState<AvatarRow[]>(AVATAR_ROWS);

  /* --- Attention marks ------------------------------------------------------ */

  const sortedMarks = [...marks].sort((a, b) => a.t - b.t);
  const runs = marksToRuns(marks, duration);

  /** Drop a new mark at `t`, inheriting the state currently in force there —
   *  placing a mark never changes what the viewer sees until you retarget it. */
  const addMark = useCallback(
    (t: number): string | null => {
      const at = Math.min(Math.max(0, t), duration - MIN_MARK_GAP);
      // Too close to an existing mark → treat as a miss, not a new state.
      // (Decided against the current marks HERE, not inside the updater —
      // React may defer updaters, and callers need the id synchronously.)
      if (marks.some((m) => Math.abs(m.t - at) < MIN_MARK_GAP)) return null;
      const inherit = attentionAt(marks, at);
      const id = `m-${Math.round(at * 1000)}`;
      setMarks((cur) => [...cur, { ...inherit, id, t: at }]);
      return id;
    },
    [duration, marks],
  );

  /** Slide a mark along the line, stopping short of its neighbours. The origin
   *  mark (t = 0) is pinned — some state must cover the top of the take. */
  const moveMark = useCallback(
    (id: string, t: number) =>
      setMarks((cur) => {
        const sorted = [...cur].sort((a, b) => a.t - b.t);
        const i = sorted.findIndex((m) => m.id === id);
        if (i <= 0) return cur; // absent, or the pinned origin
        const lo = sorted[i - 1].t + MIN_MARK_GAP;
        const hi = (i < sorted.length - 1 ? sorted[i + 1].t : duration) - MIN_MARK_GAP;
        const at = Math.min(Math.max(t, lo), Math.max(lo, hi));
        return cur.map((m) => (m.id === id ? { ...m, t: at } : m));
      }),
    [duration],
  );

  /** Change what a mark points the eye at. Switching kind picks a sensible
   *  default target so the mark is never left half-configured. */
  const setMarkKind = useCallback(
    (id: string, kind: AttentionKind) =>
      setMarks((cur) =>
        cur.map((m) => {
          if (m.id !== id) return m;
          if (kind === 'object') {
            const present = subjectsAt(m.t);
            return { ...m, kind, subjectId: m.subjectId ?? present[0]?.id, areaLabel: undefined };
          }
          if (kind === 'area') return { ...m, kind, areaLabel: m.areaLabel ?? 'Area', subjectId: undefined };
          return { ...m, kind, subjectId: undefined, areaLabel: undefined };
        }),
      ),
    [],
  );

  const setMarkSubject = useCallback(
    (id: string, subjectId: string) =>
      setMarks((cur) =>
        cur.map((m) => (m.id === id ? { ...m, kind: 'object', subjectId, areaLabel: undefined } : m)),
      ),
    [],
  );

  /** Commit a region drawn on the stage. The label follows the region's
   *  position unless the user has renamed it to something of their own. */
  const setMarkAreaRegion = useCallback(
    (id: string, region: AreaRegion) =>
      setMarks((cur) =>
        cur.map((m) => {
          if (m.id !== id) return m;
          const wasAuto =
            !m.areaLabel || m.areaLabel === 'Area' || (m.area && m.areaLabel === autoAreaName(m.area));
          return {
            ...m,
            kind: 'area',
            area: region,
            subjectId: undefined,
            areaLabel: wasAuto ? autoAreaName(region) : m.areaLabel,
          };
        }),
      ),
    [],
  );

  const setMarkArea = useCallback(
    (id: string, areaLabel: string) =>
      setMarks((cur) =>
        cur.map((m) => (m.id === id ? { ...m, kind: 'area', areaLabel, subjectId: undefined } : m)),
      ),
    [],
  );

  /** Remove a mark; the run before it simply extends. The origin mark stays. */
  const removeMark = useCallback(
    (id: string) =>
      setMarks((cur) => {
        const sorted = [...cur].sort((a, b) => a.t - b.t);
        if (sorted[0]?.id === id) return cur;
        return cur.filter((m) => m.id !== id);
      }),
    [],
  );

  /* --- Shots (framing) ------------------------------------------------------ */

  /** Edit any of a camera state's properties. The clip's name and the stage's
   *  crop are both DERIVED from these fields, so one patch moves everything. */
  const patchShot = useCallback(
    (id: string, patch: Partial<Pick<Shot, 'rig' | 'preset' | 'anchor' | 'stability' | 'subjectId'>>) =>
      setShots((cur) => cur.map((s) => (s.id === id ? { ...s, ...patch } : s))),
    [],
  );

  const rollShot = useCallback(
    (id: string, edge: 'start' | 'end', seconds: number) =>
      setShots((cur) => {
        const i = cur.findIndex((s) => s.id === id);
        if (i < 0) return cur;
        const seam = edge === 'start' ? i - 1 : i;
        return rollAt(cur, seam, seconds, MIN_SHOT_SEC);
      }),
    [],
  );

  const splitShot = useCallback(
    (id: string, seconds: number) =>
      setShots((cur) => {
        const i = cur.findIndex((s) => s.id === id);
        if (i < 0) return cur;
        const shot = cur[i];
        if (seconds - shot.start < MIN_SHOT_SEC || shot.end - seconds < MIN_SHOT_SEC) return cur;
        const next = [...cur];
        next.splice(
          i,
          1,
          { ...shot, end: seconds },
          { ...shot, id: `s-${Math.round(seconds * 1000)}`, start: seconds },
        );
        return next;
      }),
    [],
  );

  const removeShot = useCallback(
    (id: string) =>
      setShots((cur) => (cur.length <= 1 ? cur : seal(cur.filter((s) => s.id !== id), duration))),
    [duration],
  );

  /* --- Script clips ---------------------------------------------------------- */

  const patchRow = useCallback(
    (rowId: string, next: (row: AvatarRow) => Partial<AvatarRow>) =>
      setRows((cur) => cur.map((r) => (r.id === rowId ? { ...r, ...next(r) } : r))),
    [],
  );

  const rowOfScript = useCallback(
    (id: string) => rows.find((r) => r.scripts.some((s) => s.id === id))?.id,
    [rows],
  );

  const rowOfInteraction = useCallback(
    (id: string) => rows.find((r) => r.interactions.some((i) => i.id === id))?.id,
    [rows],
  );

  /** Retime a script clip. Word timings are re-spread across the new window, so
   *  the playback highlight stays exactly in step with the clip after a trim. */
  const retimeScript = useCallback(
    (id: string, edge: 'start' | 'end', seconds: number) => {
      const rowId = rowOfScript(id);
      if (!rowId) return;
      patchRow(rowId, (row) => ({
        scripts: row.scripts.map((c) => {
          if (c.id !== id) return c;
          const { lo, hi } = freeWindow(row.scripts, id, duration);
          const start =
            edge === 'start' ? Math.min(Math.max(lo, seconds), c.end - MIN_CLIP_SEC) : c.start;
          const end =
            edge === 'end' ? Math.max(Math.min(hi, seconds), c.start + MIN_CLIP_SEC) : c.end;
          return { ...c, start, end, words: c.words ? speak(clipText(c), start, end) : undefined };
        }),
      }));
    },
    [duration, patchRow, rowOfScript],
  );

  /** Slide a whole clip, keeping its length. */
  const moveScript = useCallback(
    (id: string, seconds: number) => {
      const rowId = rowOfScript(id);
      if (!rowId) return;
      patchRow(rowId, (row) => ({
        scripts: row.scripts.map((c) => {
          if (c.id !== id) return c;
          const len = c.end - c.start;
          const { lo, hi } = freeWindow(row.scripts, id, duration);
          const start = Math.min(Math.max(lo, seconds), Math.max(lo, hi - len));
          return { ...c, start, end: start + len, words: c.words ? speak(clipText(c), start, start + len) : undefined };
        }),
      }));
    },
    [duration, patchRow, rowOfScript],
  );

  const editScript = useCallback(
    (id: string, text: string) => {
      const rowId = rowOfScript(id);
      if (!rowId) return;
      const trimmed = text.trim();
      if (!trimmed) return;
      patchRow(rowId, (row) => ({
        scripts: row.scripts.map((c) =>
          c.id === id
            ? c.label !== undefined
              ? { ...c, label: trimmed }
              : { ...c, words: speak(trimmed, c.start, c.end) }
            : c,
        ),
      }));
    },
    [patchRow, rowOfScript],
  );

  /** Add a fresh line to `rowId` at `start`. The window is sized to fit the
   *  words (scriptWindow) and clamped against the lane's neighbours; a click
   *  inside a clip, or in a gap too small to hold a line, adds nothing. */
  const addScript = useCallback(
    (rowId: string, start: number, text: string): string | null => {
      const trimmed = text.trim();
      if (!trimmed) return null;
      const row = rows.find((r) => r.id === rowId);
      if (!row) return null;
      const at = Math.min(Math.max(0, start), duration - MIN_CLIP_SEC);
      if (row.scripts.some((c) => at > c.start - MIN_CLIP_SEC && at < c.end)) return null;
      const nextStart = row.scripts.reduce(
        (m, c) => (c.start >= at ? Math.min(m, c.start) : m),
        duration,
      );
      if (nextStart - at < MIN_CLIP_SEC) return null;
      const end = Math.min(at + scriptWindow(trimmed), nextStart);
      const id = `${rowId}-sc-${Math.round(at * 1000)}`;
      patchRow(rowId, (r) => ({
        scripts: [...r.scripts, { id, start: at, end, words: speak(trimmed, at, end) }],
      }));
      return id;
    },
    [duration, patchRow, rows],
  );

  /** Remove a line. Reactions it triggered stay on their lanes but stand
   *  alone — their connectors simply disappear with the parent. */
  const removeScript = useCallback(
    (id: string) =>
      setRows((cur) =>
        cur.map((r) => ({
          ...r,
          scripts: r.scripts.filter((c) => c.id !== id),
          interactions: r.interactions.map((i) =>
            i.triggerId === id ? { ...i, triggerId: undefined } : i,
          ),
        })),
      ),
    [],
  );

  /* --- Interactions ----------------------------------------------------------- */

  const retimeInteraction = useCallback(
    (id: string, edge: 'start' | 'end', seconds: number) => {
      const rowId = rowOfInteraction(id);
      if (!rowId) return;
      patchRow(rowId, (row) => ({
        interactions: row.interactions.map((it) => {
          if (it.id !== id) return it;
          const { lo, hi } = freeWindow(row.interactions, id, duration);
          return edge === 'start'
            ? { ...it, start: Math.min(Math.max(lo, seconds), it.end - MIN_CLIP_SEC) }
            : { ...it, end: Math.max(Math.min(hi, seconds), it.start + MIN_CLIP_SEC) };
        }),
      }));
    },
    [duration, patchRow, rowOfInteraction],
  );

  const moveInteraction = useCallback(
    (id: string, seconds: number) => {
      const rowId = rowOfInteraction(id);
      if (!rowId) return;
      patchRow(rowId, (row) => ({
        interactions: row.interactions.map((it) => {
          if (it.id !== id) return it;
          const len = it.end - it.start;
          const { lo, hi } = freeWindow(row.interactions, id, duration);
          const start = Math.min(Math.max(lo, seconds), Math.max(lo, hi - len));
          return { ...it, start, end: start + len };
        }),
      }));
    },
    [duration, patchRow, rowOfInteraction],
  );

  const setInteractionEmoji = useCallback(
    (id: string, emoji: string, label: string) => {
      const rowId = rowOfInteraction(id);
      if (!rowId) return;
      patchRow(rowId, (row) => ({
        interactions: row.interactions.map((it) => (it.id === id ? { ...it, emoji, label } : it)),
      }));
    },
    [patchRow, rowOfInteraction],
  );

  /** Rename a gesture or write its description — the identity edits that don't
   *  touch the emoji itself, which stays with `setInteractionEmoji`. */
  const patchInteraction = useCallback(
    (id: string, patch: Partial<Pick<Interaction, 'label' | 'description'>>) => {
      const rowId = rowOfInteraction(id);
      if (!rowId) return;
      patchRow(rowId, (row) => ({
        interactions: row.interactions.map((it) => (it.id === id ? { ...it, ...patch } : it)),
      }));
    },
    [patchRow, rowOfInteraction],
  );

  /** Whether `rowId`'s reaction lane has room for a new chip at `at` — the
   *  same test addInteraction applies, exposed so menus can hide the cast
   *  members that moment has no room for. */
  const canAddInteraction = useCallback(
    (rowId: string, at: number): boolean => {
      const row = rows.find((r) => r.id === rowId);
      if (!row) return false;
      const start = Math.min(Math.max(0, at), duration - MIN_CLIP_SEC);
      if (row.interactions.some((i) => start > i.start - MIN_CLIP_SEC && start < i.end)) return false;
      const nextStart = row.interactions.reduce(
        (m, i) => (i.start >= start ? Math.min(m, i.start) : m),
        duration,
      );
      return nextStart - start >= MIN_CLIP_SEC;
    },
    [duration, rows],
  );

  /** Add a reaction to `rowId`, attributed to the line spoken at that moment
   *  when there is one, so the connector it draws is meaningful immediately.
   *  The 2s default window parks against the lane's next neighbour; a spot
   *  that cannot hold even a minimum chip adds nothing and returns null. */
  const addInteraction = useCallback(
    (rowId: string, at: number, triggerId?: string, gesture?: { emoji: string; label: string }) => {
      const row = rows.find((r) => r.id === rowId);
      if (!row) return null;
      const start = Math.min(Math.max(0, at), duration - MIN_CLIP_SEC);
      if (row.interactions.some((i) => start > i.start - MIN_CLIP_SEC && start < i.end)) return null;
      const nextStart = row.interactions.reduce(
        (m, i) => (i.start >= start ? Math.min(m, i.start) : m),
        duration,
      );
      if (nextStart - start < MIN_CLIP_SEC) return null;
      const id = `${rowId}-i-${Math.round(start * 1000)}`;
      patchRow(rowId, (r) => ({
        interactions: [
          ...r.interactions,
          {
            id,
            emoji: gesture?.emoji ?? '👀',
            label: gesture?.label ?? ':eyes',
            start,
            end: Math.min(start + 2, nextStart),
            triggerId,
          } satisfies Interaction,
        ],
      }));
      return id;
    },
    [duration, patchRow, rows],
  );

  const removeInteraction = useCallback(
    (id: string) => {
      const rowId = rowOfInteraction(id);
      if (!rowId) return;
      patchRow(rowId, (row) => ({
        interactions: row.interactions.filter((it) => it.id !== id),
      }));
    },
    [patchRow, rowOfInteraction],
  );

  /** Re-parent a reaction onto a different line — dragging the relationship
   *  rather than the clip. */
  const setTrigger = useCallback(
    (id: string, triggerId: string | undefined) => {
      const rowId = rowOfInteraction(id);
      if (!rowId) return;
      patchRow(rowId, (row) => ({
        interactions: row.interactions.map((it) => (it.id === id ? { ...it, triggerId } : it)),
      }));
    },
    [patchRow, rowOfInteraction],
  );

  /* --- Lookups ---------------------------------------------------------------- */

  const allScripts: ScriptClip[] = rows.flatMap((r) => r.scripts);
  const allInteractions: Interaction[] = rows.flatMap((r) => r.interactions);

  /** The state driving the stage at a given moment. */
  const markAtTime = (t: number) => attentionAt(marks, t);
  const shotAt = (t: number) => shots.find((s) => t >= s.start && t < s.end) ?? shots.at(-1);

  return {
    marks: sortedMarks,
    runs,
    shots,
    rows,
    allScripts,
    allInteractions,
    markAtTime,
    shotAt,
    // attention
    addMark,
    moveMark,
    setMarkKind,
    setMarkSubject,
    setMarkArea,
    setMarkAreaRegion,
    removeMark,
    // shots
    patchShot,
    rollShot,
    splitShot,
    removeShot,
    // script
    addScript,
    retimeScript,
    moveScript,
    editScript,
    removeScript,
    // interactions
    retimeInteraction,
    moveInteraction,
    setInteractionEmoji,
    patchInteraction,
    canAddInteraction,
    addInteraction,
    removeInteraction,
    setTrigger,
    rowOfInteraction,
    rowOfScript,
  };
}

export type SceneEditing = ReturnType<typeof useSceneEditing>;
