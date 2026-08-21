import { UserFocus } from '@phosphor-icons/react';
import type { PresenceEntity, PresenceRun } from '../data';
import { useClipDrag } from '../useClipDrag';
import type { PresenceEdge } from '../usePresence';

/**
 * The subject lens's single lane (Figma 756-166274): one near-invisible
 * baseline across the whole strip, with the entity's on-screen life drawn
 * over it in green. A bead marks each end of every run — the entrance and
 * the exit — and both are draggable to retime.
 *
 * Rendered as a DERIVED view, like the ruler: the real multitrack scroller
 * stays mounted (hidden) underneath, so scroll-is-scrub keeps its wiring and
 * this lane just maps seconds through pad/scrollLeft the same way.
 */
export function PresenceTrack({
  entity,
  selectedRunId,
  onSelectRun,
  onRetime,
  pad,
  pxPerSec,
  scrollLeft,
  onWheelSeek,
}: {
  entity: PresenceEntity;
  selectedRunId: string | null;
  onSelectRun: (runId: string) => void;
  onRetime: (runId: string, edge: PresenceEdge, seconds: number) => void;
  pad: number;
  pxPerSec: number;
  scrollLeft: number;
  /** The hidden scroller can't hear the wheel — scrub by seconds instead. */
  onWheelSeek: (deltaSeconds: number) => void;
}) {
  const toX = (t: number) => pad + t * pxPerSec - scrollLeft;

  return (
    <div
      className="anim-presence"
      onWheel={(e) => {
        const d = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
        onWheelSeek(d / pxPerSec);
      }}
    >
      <div className="anim-rail anim-presence__rail">
        <UserFocus
          size={18}
          className="anim-rail__icon"
          aria-label={`${entity.label} — presence`}
        />
      </div>
      <div className="anim-presence__viewport">
        <span className="anim-presence__base" aria-hidden />
        {entity.runs.map((run) => (
          <PresenceRunEl
            key={run.id}
            entity={entity}
            run={run}
            toX={toX}
            pxPerSec={pxPerSec}
            selected={selectedRunId === run.id}
            onSelect={() => onSelectRun(run.id)}
            onRetime={(edge, s) => onRetime(run.id, edge, s)}
          />
        ))}
      </div>
    </div>
  );
}

function PresenceRunEl({
  entity,
  run,
  toX,
  pxPerSec,
  selected,
  onSelect,
  onRetime,
}: {
  entity: PresenceEntity;
  run: PresenceRun;
  toX: (t: number) => number;
  pxPerSec: number;
  selected: boolean;
  onSelect: () => void;
  onRetime: (edge: PresenceEdge, seconds: number) => void;
}) {
  const dragIn = useClipDrag(pxPerSec, (_k, s) => onRetime('start', s));
  const dragOut = useClipDrag(pxPerSec, (_k, s) => onRetime('end', s));

  const bead = (
    edge: PresenceEdge,
    t: number,
    drag: ReturnType<typeof useClipDrag>,
    label: string,
  ) => (
    <button
      type="button"
      className="anim-presence__bead"
      data-selected={selected || undefined}
      style={{ left: toX(t) }}
      aria-label={`${entity.label} ${label} at ${t.toFixed(1)}s — drag to retime`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      {...drag.dragProps(edge, t)}
    />
  );

  return (
    <>
      <button
        type="button"
        className="anim-presence__run"
        data-selected={selected || undefined}
        aria-pressed={selected}
        aria-label={`${entity.label} on screen ${run.start.toFixed(1)}–${run.end.toFixed(1)}s`}
        style={{ left: toX(run.start), width: Math.max(2, (run.end - run.start) * pxPerSec) }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      />
      {bead('start', run.start, dragIn, 'enters frame')}
      {bead('end', run.end, dragOut, 'leaves frame')}
    </>
  );
}
