import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AppHeader, EditorCanvas, TimelineResizer, TimelineRuler, Tracks } from './components';
import { AttentionPanel } from './components/AttentionPanel';
import { InteractionPanel } from './components/InteractionPanel';
import { ScriptPanel } from './components/ScriptPanel';
import { ShotStylePanel } from './components/ShotStylePanel';
import { PROJECT_TITLE, RAIL } from './data';
import type { TimelineSelection } from './data';
import { useResizableTimeline } from './useResizableTimeline';
import { useSceneEditing } from './useSceneEditing';
import { useTimeline } from './useTimeline';
import { useVideoSync } from './useVideoSync';
import './animator.css';
import './timeline.css';

export function Animator({
  title,
  onBack,
  breadcrumbs,
  chatContent,
  chromeless = false,
  chatOpen: chatOpenProp,
  onToggleChat: onToggleChatProp,
  strip,
}: {
  title?: string;
  onBack?: () => void;
  breadcrumbs?: { label: string; onClick?: () => void }[];
  chatContent?: ReactNode;
  /** The host (the Mirage zoom) owns the window chrome and header. */
  chromeless?: boolean;
  /** Chat visibility, when the host wants to own it. Uncontrolled otherwise. */
  chatOpen?: boolean;
  onToggleChat?: () => void;
  /** Scene sequence for the embedded filmstrip scrubber (Mirage host only). */
  strip?: { scenes: { id: string; thumb: string }[]; onExit?: () => void };
} = {}) {
  void onBack;
  void breadcrumbs;
  /** Where we are in the take, how wide a second is, how far we've scrolled. */
  const tl = useTimeline();
  /** Every edit the scene can take, with the timing rules enforced inside. */
  const scene = useSceneEditing(tl.duration);

  /** One selected object at a time, across every lane. */
  const [selection, setSelection] = useState<TimelineSelection | null>(null);
  /** Area draw mode: the mark id being drawn for, or null. While armed, the
   *  timeline slides out of view so the canvas has the room to itself. */
  const [drawingFor, setDrawingFor] = useState<string | null>(null);
  /** Subject lit on the canvas because its row is hovered in the inspector. */
  const [peekSubjectId, setPeekSubjectId] = useState<string | null>(null);
  /** Track-level selection: the rail's eye toggles the WHOLE attention track
   *  on, so the stage keeps its targeting overlays live through playback —
   *  no need to select runs one by one. Deliberately does not pause. */
  const [attnTrackOn, setAttnTrackOn] = useState(false);

  // The chat panel is retired — the workspace runs full width. The props stay
  // accepted so the Mirage host keeps compiling; they are simply unused now.
  void chatOpenProp;
  void onToggleChatProp;
  void chatContent;

  // The timeline hugs its content: ruler row + the track stack + its padding.
  // The resizer can only shrink it below that (clipping from the top); it can
  // never grow past it, so there is no dead space and no vertical scrolling.
  const naturalTimelineHeight =
    24 /* ruler row */ + 16 /* timeline padding */ + 52 + 52 + scene.rows.length * 104;
  const { containerRef, timelineHeight, resizerProps } = useResizableTimeline(naturalTimelineHeight);

  /**
   * The <video> on the stage is the clock. During playback the playhead is read
   * from `video.currentTime`, so the picture and the timeline cannot drift.
   */
  const videoEl = useRef<HTMLVideoElement | null>(null);
  useVideoSync(videoEl, {
    time: tl.time,
    isPlaying: tl.isPlaying,
    duration: tl.duration,
    onTime: tl.seek,
    onEnded: tl.stop,
  });

  /**
   * Selecting anything stops playback and moves NOTHING. It must not seek: the
   * playhead is pinned to the centre of the strip, so seeking would scroll the
   * whole timeline out from under the pointer, and a clip's start has no reason
   * to line up with the centre line. Selection and position are separate ideas.
   */
  const selectClip = (kind: TimelineSelection['kind'], id: string) => {
    tl.pause();
    // Moving to another track drops the attention track's selection — only one
    // track holds the stage at a time.
    if (kind !== 'attention') setAttnTrackOn(false);
    setSelection((cur) => (cur?.kind === kind && cur.id === id ? null : { kind, id }));
  };

  /* --- Keyboard --------------------------------------------------------------
     Space plays. Arrows nudge the playhead (Shift = a second). Skipped while a
     field has focus, so typing in an inspector is never eaten. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (
        el instanceof HTMLElement &&
        (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')
      ) {
        return;
      }
      if (e.key === 'Escape') {
        setDrawingFor(null);
        setAttnTrackOn(false);
      } else if (e.key === ' ') {
        e.preventDefault();
        tl.toggle();
      } else if (e.key === 'ArrowLeft' && !e.metaKey) {
        e.preventDefault();
        tl.seek(tl.time - (e.shiftKey ? 1 : 1 / 30));
      } else if (e.key === 'ArrowRight' && !e.metaKey) {
        e.preventDefault();
        tl.seek(tl.time + (e.shiftKey ? 1 : 1 / 30));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tl]);

  /* --- Derived ---------------------------------------------------------------- */

  const activeShot = scene.shotAt(tl.time);
  const activeMark = scene.markAtTime(tl.time);

  const selectedRun =
    selection?.kind === 'attention' ? scene.runs.find((r) => r.mark.id === selection.id) : undefined;
  const selectedShot =
    selection?.kind === 'shot' ? scene.shots.find((s) => s.id === selection.id) : undefined;
  const selectedScript =
    selection?.kind === 'script' ? scene.allScripts.find((c) => c.id === selection.id) : undefined;
  const selectedInteraction =
    selection?.kind === 'interaction'
      ? scene.allInteractions.find((i) => i.id === selection.id)
      : undefined;

  /** Clicking a box on the stage points the relevant mark at that subject — the
   *  selected mark when there is one, otherwise the mark in force right now. */
  const targetSubject = (subjectId: string) => {
    const mark = selectedRun?.mark ?? activeMark;
    scene.setMarkSubject(mark.id, subjectId);
    setSelection({ kind: 'attention', id: mark.id });
  };

  /** The subject the stage should light up because of the current selection. */
  const selectedSubjectId =
    (selectedRun?.mark.kind === 'object' ? selectedRun.mark.subjectId : undefined) ??
    selectedShot?.subjectId;

  const shotIndex = selectedShot ? scene.shots.findIndex((s) => s.id === selectedShot.id) : -1;
  const scriptRow = selectedScript
    ? scene.rows.find((r) => r.scripts.some((c) => c.id === selectedScript.id))
    : undefined;
  const interactionRow = selectedInteraction
    ? scene.rows.find((r) => r.interactions.some((i) => i.id === selectedInteraction.id))
    : undefined;

  const inspector = (() => {
    if (selectedRun) {
      return (
        <AttentionPanel
          run={selectedRun}
          pinned={scene.runs[0]?.mark.id === selectedRun.mark.id}
          drawing={drawingFor === selectedRun.mark.id}
          onClose={() => {
            setSelection(null);
            setDrawingFor(null);
            setPeekSubjectId(null);
          }}
          onSetKind={(kind) => {
            scene.setMarkKind(selectedRun.mark.id, kind);
            // Picking "area" with nothing drawn yet hands you the stage.
            if (kind === 'area' && !selectedRun.mark.area) setDrawingFor(selectedRun.mark.id);
            else setDrawingFor(null);
          }}
          onSetSubject={(subjectId) => scene.setMarkSubject(selectedRun.mark.id, subjectId)}
          onPeekSubject={setPeekSubjectId}
          onSetArea={(label) => scene.setMarkArea(selectedRun.mark.id, label)}
          onRedrawArea={() => setDrawingFor(selectedRun.mark.id)}
          onRemove={() => {
            scene.removeMark(selectedRun.mark.id);
            setSelection(null);
            setDrawingFor(null);
          }}
        />
      );
    }
    if (selectedShot) {
      return (
        <ShotStylePanel
          shot={selectedShot}
          neighbours={{ hasPrev: shotIndex > 0, hasNext: shotIndex < scene.shots.length - 1 }}
          playhead={tl.time}
          onClose={() => setSelection(null)}
          onRename={(label) => scene.renameShot(selectedShot.id, label)}
          onRoll={(edge, sec) => scene.rollShot(selectedShot.id, edge, sec)}
          onSetPreset={(preset) => scene.setPreset(selectedShot.id, preset)}
          onSetSubject={(subjectId) => scene.setShotSubject(selectedShot.id, subjectId)}
          onSplit={(sec) => scene.splitShot(selectedShot.id, sec)}
          onRemove={() => {
            scene.removeShot(selectedShot.id);
            setSelection(null);
          }}
        />
      );
    }
    if (selectedScript && scriptRow) {
      return (
        <ScriptPanel
          clip={selectedScript}
          speaker={scriptRow.name}
          rows={scene.rows}
          triggered={scene.rows.flatMap((row) =>
            row.interactions
              .filter((it) => it.triggerId === selectedScript.id)
              .map((it) => ({ row, it })),
          )}
          onClose={() => setSelection(null)}
          onEdit={(text) => scene.editScript(selectedScript.id, text)}
          onRetime={(edge, sec) => scene.retimeScript(selectedScript.id, edge, sec)}
          onAddInteraction={(rowId) =>
            selectClip(
              'interaction',
              scene.addInteraction(
                rowId,
                Math.min(selectedScript.start + 1, selectedScript.end - 0.5),
                selectedScript.id,
              ),
            )
          }
          onRemoveInteraction={(id) => scene.removeInteraction(id)}
          onSelectInteraction={(id) => selectClip('interaction', id)}
        />
      );
    }
    if (selectedInteraction && interactionRow) {
      return (
        <InteractionPanel
          it={selectedInteraction}
          actor={interactionRow}
          scripts={scene.rows.flatMap((row) => row.scripts.map((clip) => ({ row, clip })))}
          onClose={() => setSelection(null)}
          onSetEmoji={(emoji, label) =>
            scene.setInteractionEmoji(selectedInteraction.id, emoji, label)
          }
          onRetime={(edge, sec) => scene.retimeInteraction(selectedInteraction.id, edge, sec)}
          onSetTrigger={(triggerId) => scene.setTrigger(selectedInteraction.id, triggerId)}
          onRemove={() => {
            scene.removeInteraction(selectedInteraction.id);
            setSelection(null);
          }}
        />
      );
    }
    return null;
  })();

  const headerTitle = title ?? PROJECT_TITLE;

  return (
    <div className={`anim ${chromeless ? 'anim--embedded' : ''}`}>
      <div className="anim-window">
        {!chromeless && (
          <AppHeader title={headerTitle} />
        )}
        <div className="anim-body">
          <div className="anim-shell">
            <main className="anim-main" ref={containerRef}>
              <EditorCanvas
                scene={scene}
                time={tl.time}
                duration={tl.duration}
                isPlaying={tl.isPlaying}
                onTogglePlay={tl.toggle}
                onSeek={tl.seek}
                onPause={tl.pause}
                activeShot={activeShot}
                activeMark={activeMark}
                onTargetSubject={targetSubject}
                selectedSubjectId={selectedSubjectId}
                peekSubjectId={peekSubjectId}
                showTargets={attnTrackOn || selection?.kind === 'attention'}
                drawing={drawingFor !== null}
                onDrawArea={(region) => {
                  if (drawingFor) {
                    scene.setMarkAreaRegion(drawingFor, region);
                    setSelection({ kind: 'attention', id: drawingFor });
                  }
                  setDrawingFor(null);
                }}
                editingArea={
                  selectedRun?.mark.kind === 'area' ? (selectedRun.mark.area ?? null) : null
                }
                activeArea={activeMark.kind === 'area' ? (activeMark.area ?? null) : null}
                videoRef={videoEl}
                strip={strip}
              >
                {inspector}
              </EditorCanvas>

              {!drawingFor && <TimelineResizer {...resizerProps} />}

              <div
                className="anim-timeline"
                data-hidden={drawingFor !== null || undefined}
                style={{ height: drawingFor ? 0 : timelineHeight }}
              >
                <div className="anim-timeline__body">
                  <TimelineRuler
                    time={tl.time}
                    duration={tl.duration}
                    pxPerSec={tl.pxPerSec}
                    scrollLeft={tl.scrollLeft}
                    pad={tl.lead}
                    playheadOffset={tl.playheadOffset}
                    onSeek={(s) => {
                      tl.pause();
                      tl.seek(s);
                    }}
                    onZoomBy={tl.zoomBy}
                    onZoomToFit={tl.zoomToFit}
                  />

                  <Tracks
                    scene={scene}
                    selection={selection}
                    onSelectClip={selectClip}
                    attnTrackOn={attnTrackOn || selection?.kind === 'attention'}
                    onToggleAttnTrack={() => setAttnTrackOn((v) => !v)}
                    time={tl.time}
                    pad={tl.lead}
                    pxPerSec={tl.pxPerSec}
                    contentWidth={tl.contentWidth}
                    scrollerRef={tl.scrollerRef}
                  />

                  {/* Pinned to the middle of the strip: the content moves under
                      it, so the frame being worked on is always in the same
                      place. Selecting a clip cannot knock it off-centre. */}
                  {/* Pinned to the middle of the strip; the content moves
                      under it. */}
                  <span
                    className="anim-playhead"
                    style={{ left: `calc(${RAIL}px + ${tl.playheadOffset}px)` }}
                  />
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
