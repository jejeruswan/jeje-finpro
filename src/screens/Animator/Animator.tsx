import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppHeader, EditorCanvas, TimelineResizer, TimelineRuler, Tracks } from './components';
import { AttentionPanel } from './components/AttentionPanel';
import { InteractionDraftPanel, InteractionPanel } from './components/InteractionPanel';
import { PresencePanel } from './components/PresencePanel';
import { PresenceTrack } from './components/PresenceTrack';
import { ScriptDraftPanel, ScriptPanel } from './components/ScriptPanel';
import { CameraStatePanel } from './components/CameraStatePanel';
import type { ReactionDraft, ScriptDraft } from './components/Tracks';
import { MIN_CLIP_SEC, PROJECT_TITLE, RAIL, SUBJECTS, boxAt } from './data';
import type { TimelineSelection } from './data';
import { usePresence } from './usePresence';
import { useRenderStatus } from './useRenderStatus';
import { useResizableTimeline } from './useResizableTimeline';
import { useSceneEditing } from './useSceneEditing';
import type { SceneEditing } from './useSceneEditing';
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
  initialProgress,
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
  /** Scene sequence for the embedded filmstrip scrubber (Mirage host only).
   *  onExit receives the scene to land on back at the corkboard. */
  strip?: { scenes: { id: string; thumb: string }[]; onExit?: (sceneId?: string) => void };
  /** Where in the take to open, as a fraction [0,1] — the entered scene's
   *  segment start, so the playhead begins on the scene that was clicked. */
  initialProgress?: number;
} = {}) {
  void onBack;
  void breadcrumbs;
  /** Where we are in the take, how wide a second is, how far we've scrolled. */
  const tl = useTimeline();

  // Open ON the entered scene: seek once, on mount, to its segment start —
  // nudged a few frames in, because the <video> snaps currentTime to frame
  // boundaries and a snap BACKWARD across the boundary would relabel the
  // playhead as the previous scene.
  const seededProgress = useRef(false);
  useEffect(() => {
    if (seededProgress.current || !initialProgress) return;
    seededProgress.current = true;
    tl.seek(initialProgress * tl.duration + 0.05);
  }, [tl, initialProgress]);
  /** Every edit the scene can take, with the timing rules enforced inside. */
  const rawScene = useSceneEditing(tl.duration);

  /* --- The one-second rerender ------------------------------------------------
     EVERY timeline edit re-renders the video — attention, shots, scripts and
     gestures alike, plus the lens's presence edits below — shown on the stage
     as the diffusion resolve (the frame snaps soft, then sharpens across the
     render second). The scene the app uses is the raw one with every MUTATOR
     wrapped to kick the render; the reads stay bare, and an add that refuses
     (returns null) renders nothing. */
  const render = useRenderStatus();
  const { kick } = render;
  const scene: SceneEditing = useMemo(() => {
    const READS = new Set(['markAtTime', 'shotAt', 'rowOfScript', 'rowOfInteraction', 'canAddInteraction']);
    const wrapped: Record<string, unknown> = { ...rawScene };
    for (const [key, value] of Object.entries(rawScene)) {
      if (typeof value !== 'function' || READS.has(key)) continue;
      const edit = value as (...args: unknown[]) => unknown;
      wrapped[key] = (...args: unknown[]) => {
        const out = edit(...args);
        if (out !== null) kick();
        return out;
      };
    }
    return wrapped as SceneEditing;
  }, [rawScene, kick]);

  /** One selected object at a time, across every lane. */
  const [selection, setSelection] = useState<TimelineSelection | null>(null);
  /** A script line being written: spawned by clicking empty script-lane space,
   *  typed in the Script panel, real only once Enter commits it. */
  const [draft, setDraft] = useState<ScriptDraft | null>(null);
  /** A reaction being placed the same way — real once a gesture is picked. */
  const [reactionDraft, setReactionDraft] = useState<ReactionDraft | null>(null);
  /** Area draw mode: the mark id being drawn for, or null. While armed, the
   *  timeline slides out of view so the canvas has the room to itself. */
  const [drawingFor, setDrawingFor] = useState<string | null>(null);
  /** Subject lit on the canvas because its row is hovered in the inspector. */
  const [peekSubjectId, setPeekSubjectId] = useState<string | null>(null);
  /** The mark just dropped on the line — its inspector opens with the kind
   *  chips unfolded, because a fresh mark's whole point is choosing one. */
  const [freshMarkId, setFreshMarkId] = useState<string | null>(null);
  /** Track-level selection: the rail's eye toggles the WHOLE attention track
   *  on, so the stage keeps its targeting overlays live through playback —
   *  no need to select runs one by one. Deliberately does not pause. */
  const [attnTrackOn, setAttnTrackOn] = useState(false);

  /* --- The subject lens --------------------------------------------------------
     Entering a subject is navigation, not selection: the multitrack collapses
     into that entity's single presence lane, the stage widens, and its box
     stays lit. Playback is deliberately untouched — the world keeps moving
     while the timeline changes what it is about. */
  const rawPresence = usePresence(tl.duration);
  /* Component mode lives in the same rerender world: retiming or removing a
     presence run re-renders the video exactly like a multitrack edit. */
  const presence = useMemo(
    () => ({
      ...rawPresence,
      retimeRun: (...a: Parameters<typeof rawPresence.retimeRun>) => {
        kick();
        rawPresence.retimeRun(...a);
      },
      removeRun: (...a: Parameters<typeof rawPresence.removeRun>) => {
        kick();
        rawPresence.removeRun(...a);
      },
    }),
    [rawPresence, kick],
  );
  const [lensId, setLensId] = useState<string | null>(null);
  /** The lens's own selection — one presence run, with the panel open on it. */
  const [lensRunId, setLensRunId] = useState<string | null>(null);
  const lensEntity = lensId ? (presence.entities.find((e) => e.id === lensId) ?? null) : null;

  const enterLens = (id: string) => {
    // The lens takes the whole stage: every other selection posture drops.
    setSelection(null);
    setDraft(null);
    setReactionDraft(null);
    setAttnTrackOn(false);
    setDrawingFor(null);
    setPeekSubjectId(null);
    setLensRunId(null);
    setLensId(id);
  };
  const exitLens = () => {
    setLensId(null);
    setLensRunId(null);
  };

  /** Escape peels one layer at a time — run selection, then the lens itself —
   *  and is consumed in the CAPTURE phase so the Mirage host underneath never
   *  reads the same press as "zoom out to the corkboard". */
  useEffect(() => {
    if (!lensId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      if (lensRunId) setLensRunId(null);
      else exitLens();
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [lensId, lensRunId]);

  /** The lens entities' boxes at the current moment: the box comes from
   *  whichever beat-scoped subject instance carries the entity right now, and
   *  it only exists while the playhead is inside one of its presence runs.
   *  EVERY entity stays hoverable inside the lens too — clicking another
   *  subject keeps the lens open and swaps whose presence it shows. */
  const presenceBoxes = useMemo(
    () =>
      presence.entities.flatMap((en) => {
        const member = SUBJECTS.find(
          (s) => en.memberIds.includes(s.id) && tl.time >= s.from && tl.time < s.to,
        );
        const onScreen = en.runs.some((r) => tl.time >= r.start && tl.time < r.end);
        if (!member || !onScreen) return [];
        return [{ id: en.id, label: en.label, kind: en.kind, box: boxAt(member, tl.time) }];
      }),
    [presence.entities, tl.time],
  );

  /* A press anywhere that is not the video or one of the lens's own surfaces
     (its lane, its panel, the transport) leaves component mode — peeling like
     Escape does: an open panel absorbs the first click, the lens the next.
     Presses ON the video are the stage's own business (see onStageDown). */
  useEffect(() => {
    if (!lensId) return;
    const KEEP_LENS =
      '.anim-preview, .anim-presence, .prop-panel, .anim-strip, .anim-utils, ' +
      '.anim-play--dock, .anim-ruler-row, .anim-resizer, header';
    const onDown = (e: PointerEvent) => {
      if (e.target instanceof Element && e.target.closest(KEEP_LENS)) return;
      if (lensRunId) setLensRunId(null);
      else exitLens();
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [lensId, lensRunId]);

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
    setDraft(null);
    setReactionDraft(null);
    setSelection((cur) => (cur?.kind === kind && cur.id === id ? null : { kind, id }));
  };

  /* --- Adding a line or a reaction -----------------------------------------------
     A click on empty lane space spawns a draft: a blank, selected clip under
     the click with its inspector already open. Nothing enters the scene until
     the panel confirms it — Enter for a line, picking a gesture for a
     reaction. Escape, the X, selecting anything else or clicking away all
     discard a draft without a trace, and the two kinds displace each other. */
  const spawnDraft = (rowId: string, seconds: number) => {
    const at = Math.round(seconds * 10) / 10;
    if (at < 0 || at > tl.duration - MIN_CLIP_SEC) return;
    // Only a gap that can actually hold a line takes the click.
    const row = scene.rows.find((r) => r.id === rowId);
    if (!row || row.scripts.some((c) => at > c.start - MIN_CLIP_SEC && at < c.end)) return;
    tl.pause();
    setSelection(null);
    setAttnTrackOn(false);
    setReactionDraft(null);
    setDraft({ rowId, start: at, text: '' });
  };

  const commitDraft = () => {
    if (!draft) return;
    const id = scene.addScript(draft.rowId, draft.start, draft.text);
    if (id === null && draft.text.trim()) return; // no room — keep the draft alive
    setDraft(null);
    if (id) setSelection({ kind: 'script', id });
  };

  /** Lane clicks spawn standalone; the Script panel's + Reaction passes the
   *  line's id so the committed reaction answers it. */
  const spawnReactionDraft = (rowId: string, seconds: number, triggerId?: string) => {
    const at = Math.round(seconds * 10) / 10;
    if (at < 0 || at > tl.duration - MIN_CLIP_SEC) return;
    if (!scene.canAddInteraction(rowId, at)) return;
    tl.pause();
    setSelection(null);
    setAttnTrackOn(false);
    setDraft(null);
    setReactionDraft({ rowId, start: at, triggerId });
  };

  /** Picking a gesture in the panel IS the commit. */
  const commitReactionDraft = (emoji: string, label: string) => {
    if (!reactionDraft) return;
    const id = scene.addInteraction(reactionDraft.rowId, reactionDraft.start, reactionDraft.triggerId, {
      emoji,
      label,
    });
    setReactionDraft(null);
    if (id) setSelection({ kind: 'interaction', id });
  };

  /* --- Click-away --------------------------------------------------------------
     Pressing anywhere that is not an editing surface drops the selection, like
     clicking the canvas in a design tool. The whitelist is every surface a
     selection lives on or is edited through: clips, the attention line and its
     rail, the inspectors, the stage's labelling and draw layer, and the
     transport chrome (ruler, scrubbers, play) — seeking should not close the
     inspector you are working in. */
  useEffect(() => {
    const KEEP =
      '.prop-panel, .anim-clip, .anim-attn, .anim-rail, .anim-handle, ' +
      '.anim-hud__box, .anim-area, .anim-drawlayer, .anim-ruler-row, ' +
      '.anim-resizer, .anim-play, .anim-play--dock, .anim-wave, .anim-strip, .anim-utils, ' +
      '.anim-presence';
    const onDown = (e: PointerEvent) => {
      if (e.target instanceof Element && e.target.closest(KEEP)) return;
      setSelection(null);
      setDraft(null);
      setReactionDraft(null);
      setAttnTrackOn(false);
      setDrawingFor(null);
      setLensRunId(null);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, []);

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
        setDraft(null);
        setReactionDraft(null);
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

  /** This run's end is the NEXT mark's start — editing it moves that mark. */
  const runAfterSelected = selectedRun
    ? scene.runs[scene.runs.findIndex((r) => r.mark.id === selectedRun.mark.id) + 1]
    : undefined;

  const lensRun = lensEntity?.runs.find((r) => r.id === lensRunId);

  const inspector = (() => {
    if (lensEntity && lensRun) {
      return (
        <PresencePanel
          key={lensRun.id}
          entity={lensEntity}
          run={lensRun}
          duration={tl.duration}
          onClose={() => setLensRunId(null)}
          onRetime={(edge, sec) => presence.retimeRun(lensEntity.id, lensRun.id, edge, sec)}
          onRemove={() => {
            presence.removeRun(lensEntity.id, lensRun.id);
            setLensRunId(null);
          }}
        />
      );
    }
    if (draft) {
      const row = scene.rows.find((r) => r.id === draft.rowId);
      if (row) {
        return (
          <ScriptDraftPanel
            key={`draft-${draft.rowId}`}
            speaker={row.name}
            color={row.color}
            start={draft.start}
            maxStart={tl.duration - MIN_CLIP_SEC}
            text={draft.text}
            onChangeText={(text) => setDraft((d) => (d ? { ...d, text } : d))}
            onRetimeStart={(sec) =>
              setDraft((d) => (d ? { ...d, start: Math.round(sec * 10) / 10 } : d))
            }
            onCommit={commitDraft}
            onCancel={() => setDraft(null)}
          />
        );
      }
    }
    if (reactionDraft) {
      const row = scene.rows.find((r) => r.id === reactionDraft.rowId);
      if (row) {
        return (
          <InteractionDraftPanel
            key={`ix-draft-${reactionDraft.rowId}`}
            actor={row}
            start={reactionDraft.start}
            maxStart={tl.duration - MIN_CLIP_SEC}
            onRetimeStart={(sec) =>
              setReactionDraft((d) => (d ? { ...d, start: Math.round(sec * 10) / 10 } : d))
            }
            onPreview={(emoji) => setReactionDraft((d) => (d ? { ...d, preview: emoji } : d))}
            onCommit={commitReactionDraft}
            onCancel={() => setReactionDraft(null)}
          />
        );
      }
    }
    if (selectedRun) {
      const pinned = scene.runs[0]?.mark.id === selectedRun.mark.id;
      return (
        <AttentionPanel
          key={selectedRun.mark.id}
          run={selectedRun}
          pinned={pinned}
          fresh={freshMarkId === selectedRun.mark.id}
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
          onRetimeStart={
            pinned ? undefined : (sec) => scene.moveMark(selectedRun.mark.id, sec)
          }
          onRetimeEnd={
            runAfterSelected ? (sec) => scene.moveMark(runAfterSelected.mark.id, sec) : undefined
          }
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
        <CameraStatePanel
          key={selectedShot.id}
          shot={selectedShot}
          onClose={() => setSelection(null)}
          onPatch={(patch) => scene.patchShot(selectedShot.id, patch)}
          onRetimeStart={
            shotIndex > 0 ? (sec) => scene.rollShot(selectedShot.id, 'start', sec) : undefined
          }
          onRetimeEnd={
            shotIndex < scene.shots.length - 1
              ? (sec) => scene.rollShot(selectedShot.id, 'end', sec)
              : undefined
          }
          onRemove={() => {
            scene.removeShot(selectedShot.id);
            setSelection(null);
          }}
        />
      );
    }
    if (selectedScript && scriptRow) {
      // Where a fresh reaction to this line would land — and who actually has
      // room there: a cast member whose lane is occupied at that moment is
      // simply not offered.
      const reactionAt =
        Math.round(Math.min(selectedScript.start + 1, selectedScript.end - 0.5) * 10) / 10;
      return (
        <ScriptPanel
          key={selectedScript.id}
          clip={selectedScript}
          speaker={scriptRow.name}
          color={scriptRow.color}
          rows={scene.rows.filter((r) => scene.canAddInteraction(r.id, reactionAt))}
          triggered={scene.rows.flatMap((row) =>
            row.interactions
              .filter((it) => it.triggerId === selectedScript.id)
              .map((it) => ({ row, it })),
          )}
          onClose={() => setSelection(null)}
          onEdit={(text) => scene.editScript(selectedScript.id, text)}
          onRetime={(edge, sec) => scene.retimeScript(selectedScript.id, edge, sec)}
          onAddInteraction={(rowId) =>
            // The ghost flow, same as a lane click — but answering this line.
            spawnReactionDraft(rowId, reactionAt, selectedScript.id)
          }
          onSelectInteraction={(id) => selectClip('interaction', id)}
          onRemove={() => {
            scene.removeScript(selectedScript.id);
            setSelection(null);
          }}
        />
      );
    }
    if (selectedInteraction && interactionRow) {
      return (
        <InteractionPanel
          key={selectedInteraction.id}
          it={selectedInteraction}
          actor={interactionRow}
          scripts={scene.rows.flatMap((row) => row.scripts.map((clip) => ({ row, clip })))}
          onClose={() => setSelection(null)}
          onSetEmoji={(emoji, label) =>
            scene.setInteractionEmoji(selectedInteraction.id, emoji, label)
          }
          onRename={(label) => scene.patchInteraction(selectedInteraction.id, { label })}
          onSetDescription={(description) =>
            scene.patchInteraction(selectedInteraction.id, { description })
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
    <div className={`anim ${chromeless ? 'anim--embedded' : ''}`} data-lens={lensId || undefined}>
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
                areaLabel={
                  (selectedRun?.mark.kind === 'area'
                    ? selectedRun.mark.areaLabel
                    : activeMark.kind === 'area'
                      ? activeMark.areaLabel
                      : undefined) ?? 'area'
                }
                videoRef={videoEl}
                renderPhase={render.phase}
                strip={strip}
                presenceHud={{
                  boxes: presenceBoxes,
                  lensId,
                  onPick: (id) => (lensId === id ? exitLens() : enterLens(id)),
                  onStageDown: () => {
                    // A press on the bare stage peels like Escape does:
                    // selection first, the lens itself second.
                    if (lensRunId) setLensRunId(null);
                    else exitLens();
                  },
                }}
              >
                {inspector}
              </EditorCanvas>

              {!drawingFor && !lensId && <TimelineResizer {...resizerProps} />}

              <div
                className="anim-timeline"
                data-hidden={drawingFor !== null || undefined}
                data-lens={lensId || undefined}
                /* In the lens the timeline hugs its one lane: ruler + padding
                   + a single track row. The resizer's height is left alone
                   underneath, so leaving the lens restores it untouched. */
                style={{ height: drawingFor ? 0 : lensId ? 24 + 16 + 52 : timelineHeight }}
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
                  />

                  <Tracks
                    scene={scene}
                    selection={selection}
                    onSelectClip={selectClip}
                    onCreateMark={(id) => {
                      setFreshMarkId(id);
                      selectClip('attention', id);
                    }}
                    draft={draft}
                    onSpawnDraft={spawnDraft}
                    reactionDraft={reactionDraft}
                    onSpawnReactionDraft={spawnReactionDraft}
                    attnTrackOn={attnTrackOn || selection?.kind === 'attention'}
                    onToggleAttnTrack={() => {
                      setAttnTrackOn((v) => {
                        const next = !v;
                        // Selection is exclusive across tracks in BOTH
                        // directions: turning the attention track on drops any
                        // other track's selection, exactly as selecting another
                        // track drops attention's.
                        if (next) {
                          setSelection((cur) => (cur && cur.kind !== 'attention' ? null : cur));
                        }
                        return next;
                      });
                    }}
                    time={tl.time}
                    pad={tl.lead}
                    pxPerSec={tl.pxPerSec}
                    contentWidth={tl.contentWidth}
                    scrollerRef={tl.scrollerRef}
                  />

                  {/* The subject lens's lane rides OVER the multitrack (which
                      stays mounted underneath, hidden — the scroller's
                      scroll-is-scrub wiring must survive the lens). */}
                  {lensEntity && (
                    <PresenceTrack
                      key={lensEntity.id}
                      entity={lensEntity}
                      selectedRunId={lensRunId}
                      onSelectRun={(id) => {
                        tl.pause();
                        setLensRunId((cur) => (cur === id ? null : id));
                      }}
                      onRetime={(runId, edge, sec) =>
                        presence.retimeRun(lensEntity.id, runId, edge, sec)
                      }
                      pad={tl.lead}
                      pxPerSec={tl.pxPerSec}
                      scrollLeft={tl.scrollLeft}
                      onWheelSeek={(d) => tl.seek(tl.time + d)}
                    />
                  )}

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
