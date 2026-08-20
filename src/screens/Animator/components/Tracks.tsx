import { useLayoutEffect, useRef, useState } from 'react';
import { Eye, VideoCamera } from '@phosphor-icons/react';
import { CLIP_H, LANE_H, cameraStateName, laneTop, markLabel } from '../data';
import type {
  AttentionRun,
  AvatarRow,
  Interaction,
  ScriptClip,
  Shot,
  TimelineSelection,
} from '../data';
import { useClipDrag } from '../useClipDrag';
import type { SceneEditing } from '../useSceneEditing';

/* Every clip is its own component: each one owns a drag gesture, and a hook
   cannot live inside a .map() — splitting a clip changes the list's length,
   which would change the hook count and tear the render down. */

/**
 * The trim handle every editor has: a white end cap with a dark grip line.
 * `in` caps sit inside a contiguous clip's ends (its neighbours are flush
 * against it); `out` caps hang outside a free clip so it keeps its exact
 * length while selected.
 */
function Handle({
  edge,
  place,
  locked,
  drag,
}: {
  edge: 'start' | 'end';
  place: 'in' | 'out';
  locked?: boolean;
  drag?: ReturnType<ReturnType<typeof useClipDrag>['dragProps']>;
}) {
  return (
    <span
      className={`anim-handle anim-handle--${place} anim-handle--${edge}`}
      data-locked={locked || undefined}
      aria-hidden
      {...(locked ? {} : drag)}
    />
  );
}

/* --- The attention lane -----------------------------------------------------
   Not a block track: a full-width amber band with one continuous line through
   its centre. Marks sit ON the line, each starting the state it names:

     ● filled dot   → the eye is on an object
     ✼ asterisk     → the eye is on an area
     ○ hollow dot   → no preference; the run after it greys out

   Runs between marks are derived. Click a run to select its mark, double-click
   a run to drop a new mark there (inheriting the current state), drag a glyph
   to move the boundary. Clicking here never moves the playhead — jumping is the
   ruler's and the scrubber's job. */

function AttentionGlyph({
  run,
  pad,
  pxPerSec,
  selected,
  pinned,
  onSelect,
  scene,
}: {
  run: AttentionRun;
  pad: number;
  pxPerSec: number;
  selected: boolean;
  /** The origin mark (t = 0) can be retargeted but never moved. */
  pinned: boolean;
  onSelect: () => void;
  scene: SceneEditing;
}) {
  const drag = useClipDrag(pxPerSec, (kind, seconds) => {
    if (kind === 'move' && !pinned) scene.moveMark(run.mark.id, seconds);
  });
  const { kind } = run.mark;

  return (
    <button
      type="button"
      className="anim-attn__glyph"
      data-kind={kind}
      data-selected={selected || undefined}
      aria-pressed={selected}
      aria-label={`${kind} — ${markLabel(run.mark)} from ${run.start.toFixed(1)}s`}
      title={`${markLabel(run.mark)} · drag to move`}
      style={{ left: pad + run.mark.t * pxPerSec, cursor: pinned ? 'pointer' : 'ew-resize' }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      {...(pinned ? {} : drag.dragProps('move', run.mark.t))}
    >
      {kind === 'area' ? '✼' : ''}
    </button>
  );
}

function AttentionLane({
  runs,
  pad,
  pxPerSec,
  duration,
  selection,
  trackOn,
  onToggleTrack,
  onSelect,
  onCreate,
  scene,
}: {
  runs: AttentionRun[];
  pad: number;
  pxPerSec: number;
  duration: number;
  selection: TimelineSelection | null;
  trackOn: boolean;
  onToggleTrack: () => void;
  onSelect: (markId: string) => void;
  /** Reports a freshly double-clicked mark; falls back to plain selection. */
  onCreate?: (markId: string) => void;
  scene: SceneEditing;
}) {
  /** Pointer x inside the band → seconds. */
  const timeAt = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return (e.clientX - rect.left) / pxPerSec;
  };

  return (
    <div className="anim-attn" style={{ height: LANE_H }}>
      {/* Whole-track selection is built exactly like every other selected
          clip: ONE white frame element — caps, ring and all are its single
          background, so nothing can disconnect — with the amber band inset
          inside it. The grips are its pseudo-elements. Inert: the take's
          bounds are fixed by the footage. */}
      {trackOn && (
        <div
          className="anim-attn__frame"
          style={{ left: pad - 18, width: duration * pxPerSec + 36 }}
          aria-hidden
        />
      )}
      {/* The band spans the whole take — attention always has a state. */}
      <div
        className="anim-attn__band"
        data-on={trackOn || undefined}
        style={{ left: pad, width: duration * pxPerSec }}
        onDoubleClick={(e) => {
          const id = scene.addMark(timeAt(e));
          if (id) (onCreate ?? onSelect)(id);
        }}
        onClick={(e) => {
          // The amber background itself selects the whole track — the runs and
          // glyphs sit on top and stop propagation, so this only fires on the
          // band's own strip above and below the line.
          if (e.target === e.currentTarget) onToggleTrack();
        }}
      >
        {runs.map((run) => {
          const selected = selection?.kind === 'attention' && selection.id === run.mark.id;
          return (
            <button
              key={run.mark.id}
              type="button"
              className="anim-attn__run"
              data-kind={run.mark.kind}
              data-selected={selected || undefined}
              aria-pressed={selected}
              aria-label={`${markLabel(run.mark)}, ${run.start.toFixed(1)}–${run.end.toFixed(1)}s`}
              style={{
                left: run.start * pxPerSec,
                width: Math.max(2, (run.end - run.start) * pxPerSec),
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(run.mark.id);
              }}
            />
          );
        })}
      </div>
      {/* Glyphs above the runs so they always take the click. */}
      {runs.map((run, i) => (
        <AttentionGlyph
          key={run.mark.id}
          run={run}
          pad={pad}
          pxPerSec={pxPerSec}
          selected={selection?.kind === 'attention' && selection.id === run.mark.id}
          pinned={i === 0}
          onSelect={() => onSelect(run.mark.id)}
          scene={scene}
        />
      ))}
    </div>
  );
}

/* --- Shot clips ------------------------------------------------------------
   Teal blocks, words only — the reticle icon is retired. Contiguous, so a
   boundary drag ROLLS the seam against the neighbour. */

function ShotClip({
  shot,
  pad,
  pxPerSec,
  selected,
  onSelect,
  scene,
  hasPrev,
  hasNext,
}: {
  shot: Shot;
  pad: number;
  pxPerSec: number;
  selected: boolean;
  onSelect: () => void;
  scene: SceneEditing;
  hasPrev: boolean;
  hasNext: boolean;
}) {
  const drag = useClipDrag(pxPerSec, (kind, seconds) => {
    if (kind !== 'move') scene.rollShot(shot.id, kind, seconds);
  });

  return (
    <button
      type="button"
      className="anim-clip anim-clip--shot"
      data-selected={selected || undefined}
      aria-pressed={selected}
      style={{ left: pad + shot.start * pxPerSec, width: (shot.end - shot.start) * pxPerSec }}
      onClick={() => onSelect()}
      onDoubleClick={() => scene.splitShot(shot.id, (shot.start + shot.end) / 2)}
      title={`${cameraStateName(shot)} · double-click to split`}
    >
      {selected && (
        <Handle edge="start" place="in" locked={!hasPrev} drag={drag.dragProps('start', shot.start)} />
      )}
      <span className="anim-clip__body">
        <span className="anim-clip__label">{cameraStateName(shot)}</span>
      </span>
      {selected && (
        <Handle edge="end" place="in" locked={!hasNext} drag={drag.dragProps('end', shot.end)} />
      )}
      {!selected && hasPrev && (
        <span className="anim-seam anim-seam--start" {...drag.dragProps('start', shot.start)} />
      )}
      {!selected && hasNext && (
        <span className="anim-seam anim-seam--end" {...drag.dragProps('end', shot.end)} />
      )}
    </button>
  );
}

/* --- Script clips ------------------------------------------------------------
   A spoken line as a row of word badges. The badges keep their natural text
   width (readable at any zoom), and the highlight is GEOMETRIC: the badge the
   playhead line is visually touching lights up — never the one after it. The
   badge spans are measured once after layout and re-measured when the words
   change, so the comparison is against where the chips actually sit. */

function Script({
  clip,
  pad,
  time,
  pxPerSec,
  selected,
  onSelect,
  scene,
}: {
  clip: ScriptClip;
  pad: number;
  time: number;
  pxPerSec: number;
  selected: boolean;
  onSelect: () => void;
  scene: SceneEditing;
}) {
  const drag = useClipDrag(pxPerSec, (kind, seconds) => {
    if (kind === 'move') scene.moveScript(clip.id, seconds);
    else scene.retimeScript(clip.id, kind, seconds);
  });

  const bodyRef = useRef<HTMLSpanElement>(null);
  /** Each badge's [left, right] inside the clip, in px. */
  const [spans, setSpans] = useState<Array<{ a: number; b: number }>>([]);

  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el || !clip.words) return;
    const chips = el.querySelectorAll<HTMLElement>('.anim-word');
    setSpans(
      Array.from(chips).map((c) => ({ a: c.offsetLeft, b: c.offsetLeft + c.offsetWidth })),
    );
  }, [clip.words]);

  // TIME picks the word; the row slides so that word sits exactly under the
  // playhead line. Chip-space (natural text widths) is longer than time-space
  // (the clip's width), so the row is continuously mapped between them: as the
  // take plays, early words exit left and the words clipped off the right edge
  // glide into view — and the badge under the line is ALWAYS the word being
  // spoken, because the slide is what aligns the two spaces.
  const headInClip = (time - clip.start) * pxPerSec;
  const words = clip.words ?? [];
  const activeIndex =
    time >= clip.start && time < clip.end
      ? words.findIndex((w) => time >= w.start && time < w.end)
      : -1;
  let slide = 0;
  const clipW = (clip.end - clip.start) * pxPerSec;
  if (activeIndex >= 0 && spans[activeIndex]) {
    const w = words[activeIndex];
    const sp = spans[activeIndex];
    // Where the spoken instant sits inside the active badge, in chip-space.
    const frac = (time - w.start) / Math.max(0.001, w.end - w.start);
    const chipX = sp.a + frac * (sp.b - sp.a);
    // Never slide further than it takes to bring the LAST word into view — and
    // if the whole line already fits, don't slide at all.
    const last = spans[spans.length - 1];
    const maxSlide = Math.max(0, last.b + 8 - clipW);
    slide = Math.min(Math.max(0, chipX - headInClip), maxSlide);
  }

  return (
    <button
      type="button"
      className="anim-clip anim-clip--script"
      data-selected={selected || undefined}
      aria-pressed={selected}
      style={{ left: pad + clip.start * pxPerSec, width: (clip.end - clip.start) * pxPerSec }}
      onClick={() => onSelect()}
      {...drag.dragProps('move', clip.start)}
    >
      <span className="anim-clip__body anim-clip__body--words" ref={bodyRef}>
        {clip.label ? (
          <span className="anim-clip__label">{clip.label}</span>
        ) : (
          /* The slide lives on this INNER row. The body above it never moves —
             it is the clip's mask, so even a selected clip (whose own overflow
             is visible, for the outside handles) keeps its words contained. */
          <span className="anim-words" style={{ transform: `translateX(${-slide}px)` }}>
            {clip.words?.map((w, i) => (
              <span className="anim-word" data-active={i === activeIndex || undefined} key={i}>
                {w.t}
              </span>
            ))}
          </span>
        )}
      </span>
      {selected && (
        <>
          <Handle edge="start" place="out" drag={drag.dragProps('start', clip.start)} />
          <Handle edge="end" place="out" drag={drag.dragProps('end', clip.end)} />
        </>
      )}
    </button>
  );
}

/* --- Interactions ------------------------------------------------------------- */

function Reaction({
  it,
  pad,
  pxPerSec,
  selected,
  onSelect,
  scene,
}: {
  it: Interaction;
  pad: number;
  pxPerSec: number;
  selected: boolean;
  onSelect: () => void;
  scene: SceneEditing;
}) {
  const drag = useClipDrag(pxPerSec, (kind, seconds) => {
    if (kind === 'move') scene.moveInteraction(it.id, seconds);
    else scene.retimeInteraction(it.id, kind, seconds);
  });

  return (
    <button
      type="button"
      className="anim-clip anim-clip--emoji"
      data-selected={selected || undefined}
      aria-pressed={selected}
      aria-label={`Reacts ${it.label}`}
      style={{
        left: pad + it.start * pxPerSec,
        width: Math.max(32, (it.end - it.start) * pxPerSec),
      }}
      onClick={() => onSelect()}
      {...drag.dragProps('move', it.start)}
    >
      <span className="anim-clip__body anim-clip__body--emoji">{it.emoji}</span>
      {selected && (
        <>
          <Handle edge="start" place="out" drag={drag.dragProps('start', it.start)} />
          <Handle edge="end" place="out" drag={drag.dragProps('end', it.end)} />
        </>
      )}
    </button>
  );
}

/* --- Derived connector lines ---------------------------------------------
   Computed from live clip geometry, never hardcoded: a clip that is dragged or
   trimmed takes its line with it. A line runs from a reaction to the script clip
   that TRIGGERS it — the actor and the speaker are usually different people, and
   that relationship is the thing a traditional timeline has no place to record. */

type Connector = { id: string; x: number; top: number; height: number; interactionId: string };

function connectors(
  rows: AvatarRow[],
  pad: number,
  pxPerSec: number,
  laneIndexOf: (rowId: string, kind: 'script' | 'interaction') => number,
): Connector[] {
  const scripts = new Map<string, { rowId: string; clip: ScriptClip }>();
  rows.forEach((r) => r.scripts.forEach((c) => scripts.set(c.id, { rowId: r.id, clip: c })));

  const inset = (LANE_H - CLIP_H) / 2;
  const out: Connector[] = [];
  rows.forEach((row) => {
    row.interactions.forEach((it) => {
      if (!it.triggerId) return;
      const trigger = scripts.get(it.triggerId);
      if (!trigger) return;
      const from = laneTop(laneIndexOf(row.id, 'interaction'));
      const to = laneTop(laneIndexOf(trigger.rowId, 'script'));
      // Each chip spans [laneTop + inset .. + CLIP_H]; bridge the nearest edges.
      const a = from < to ? from + inset + CLIP_H : from + inset;
      const b = from < to ? to + inset : to + inset + CLIP_H;
      out.push({
        id: `nl-${it.id}`,
        x: pad + ((it.start + it.end) / 2) * pxPerSec,
        top: Math.min(a, b),
        height: Math.abs(b - a),
        interactionId: it.id,
      });
    });
  });
  return out;
}

/* --- The stack ---------------------------------------------------------- */

/**
 * The timeline tracks. Top to bottom the stack reads as a causal chain:
 *   1. ATTENTION — the amber band: where the viewer's eye should be
 *   2. SHOT STYLES — the framing serving it
 *   3+. one layer per cast member: a script lane over a reaction lane
 *
 * Every position is `pad + seconds × pxPerSec`, so the lanes, the ruler above
 * them and the playhead share one coordinate system by construction. `pad` is
 * half a viewport of padding, which is what lets the playhead stay centred while
 * the content moves under it.
 */
export function Tracks({
  scene,
  selection,
  onSelectClip,
  onCreateMark,
  attnTrackOn,
  onToggleAttnTrack,
  time,
  pad,
  pxPerSec,
  contentWidth,
  scrollerRef,
}: {
  scene: SceneEditing;
  selection: TimelineSelection | null;
  onSelectClip: (kind: TimelineSelection['kind'], id: string) => void;
  /** A mark was just double-clicked into the line — the host may want to open
   *  its inspector in the fresh (kind chips unfolded) posture. */
  onCreateMark?: (id: string) => void;
  /** Whole-track selection: keeps the stage's attention overlays live through
   *  playback without selecting runs one by one. */
  attnTrackOn: boolean;
  onToggleAttnTrack: () => void;
  time: number;
  pad: number;
  pxPerSec: number;
  contentWidth: number;
  scrollerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { runs, shots, rows } = scene;

  // Lane indices: attention 0, shots 1, then two lanes per avatar row.
  const laneIndexOf = (rowId: string, kind: 'script' | 'interaction') =>
    2 + rows.findIndex((r) => r.id === rowId) * 2 + (kind === 'interaction' ? 1 : 0);

  // The end-side hatch keeps ten minutes of clearance past the take, so it
  // never crowds the last clips — the ruler runs on, the room stays open.
  const hatchStart = pad + ((runs.at(-1)?.end ?? 0) + 600) * pxPerSec;

  return (
    <div className="anim-tracks" ref={scrollerRef}>
      <div className="anim-tracks__scroll" style={{ width: contentWidth }}>
        {/* Outside the take: the lead-in before 0 is hatched so blank space
            reads as "no media", not as emptiness. */}
        <div className="anim-offtake" style={{ left: 0, width: pad }} aria-hidden />
        <div className="anim-offtake" style={{ left: hatchStart, right: 0 }} aria-hidden />

        {/* 1 — attention */}
        <div className="anim-layer">
          <div className="anim-rail">
            {/* The eye selects the WHOLE track: overlays stay live on the stage
                through playback. It never pauses — that is the point. */}
            <button
              type="button"
              className="anim-rail__toggle"
              data-on={attnTrackOn || undefined}
              aria-pressed={attnTrackOn}
              aria-label={attnTrackOn ? 'Hide attention on the video' : 'Show attention on the video'}
              title={attnTrackOn ? 'Hide attention overlays' : 'Show attention overlays while playing'}
              onClick={onToggleAttnTrack}
            >
              <Eye size={18} weight={attnTrackOn ? 'fill' : 'regular'} />
            </button>
          </div>
          <div className="anim-layer__lanes" style={{ height: LANE_H }}>
            <AttentionLane
              runs={runs}
              pad={pad}
              pxPerSec={pxPerSec}
              duration={scene.runs.at(-1)?.end ?? 0}
              selection={selection}
              trackOn={attnTrackOn}
              onToggleTrack={onToggleAttnTrack}
              onSelect={(id) => onSelectClip('attention', id)}
              onCreate={onCreateMark}
              scene={scene}
            />
          </div>
        </div>

        {/* 2 — shot styles */}
        <div className="anim-layer">
          <div className="anim-rail">
            <VideoCamera size={18} className="anim-rail__icon" aria-label="Camera state" />
          </div>
          <div className="anim-layer__lanes" style={{ height: LANE_H }}>
            <div className="anim-lane-abs">
              {shots.map((shot, i) => (
                <ShotClip
                  key={shot.id}
                  shot={shot}
                  pad={pad}
                  pxPerSec={pxPerSec}
                  selected={selection?.kind === 'shot' && selection.id === shot.id}
                  onSelect={() => onSelectClip('shot', shot.id)}
                  scene={scene}
                  hasPrev={i > 0}
                  hasNext={i < shots.length - 1}
                />
              ))}
            </div>
          </div>
        </div>

        {/* 3+ — one layer per cast member */}
        {rows.map((row) => (
          <div className="anim-layer anim-avatar-row" key={row.id} data-color={row.color}>
            <div className="anim-rail">
              <img className="anim-avatar" src={row.avatar} alt={row.name} />
            </div>
            <div className="anim-layer__lanes" style={{ height: LANE_H * 2 }}>
              <div className="anim-lane anim-lane--script">
                <div className="anim-lane-abs">
                  {row.scripts.map((clip) => (
                    <Script
                      key={clip.id}
                      clip={clip}
                      pad={pad}
                      time={time}
                      pxPerSec={pxPerSec}
                      selected={selection?.kind === 'script' && selection.id === clip.id}
                      onSelect={() => onSelectClip('script', clip.id)}
                      scene={scene}
                    />
                  ))}
                </div>
              </div>
              <div className="anim-lane anim-lane--interaction">
                <div className="anim-lane-abs">
                  {row.interactions.map((it) => (
                    <Reaction
                      key={it.id}
                      it={it}
                      pad={pad}
                      pxPerSec={pxPerSec}
                      selected={selection?.kind === 'interaction' && selection.id === it.id}
                      onSelect={() => onSelectClip('interaction', it.id)}
                      scene={scene}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Derived connectors — above the lanes, below a selected chip. */}
        <div className="anim-links">
          {connectors(rows, pad, pxPerSec, laneIndexOf).map((l) => (
            <button
              key={l.id}
              className="anim-link"
              type="button"
              data-selected={
                (selection?.kind === 'interaction' && selection.id === l.interactionId) || undefined
              }
              aria-label="Reaction trigger"
              style={{ left: l.x, top: l.top, height: l.height }}
              onClick={() => onSelectClip('interaction', l.interactionId)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
