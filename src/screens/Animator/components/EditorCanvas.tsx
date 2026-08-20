import { useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { ChatCircle, GearSix, Pause, Play } from '@phosphor-icons/react';
import { IconButton } from '../../../ui/IconButton';
import {
  SOURCE_VIDEO,
  TAKE_CUTS,
  clipRegion,
  framingParams,
  framingSubject,
  mapRegion,
  subjectsAt,
} from '../data';
import type { AreaRegion, AttentionMark, Shot } from '../data';
import type { SceneEditing } from '../useSceneEditing';
import { CurvedScrubber } from './CurvedScrubber';
import { FilmstripScrubber, type StripScene } from './FilmstripScrubber';

/**
 * The Frame Canvas stage, matched to the design frame:
 *
 *  - the video sits centred with the play control INSIDE its bottom-left corner
 *  - the whole-take scrubber is the organic curve overlaid on the lower third
 *    of the picture (see CurvedScrubber) — click or drag it to jump anywhere
 *  - two quiet utility buttons float at the top-left of the canvas (chat toggle
 *    and settings); the tool pillar is gone
 *  - the HUD stays: the object graph's boxes reveal on hover and clicking one
 *    points the current attention mark at that subject
 *
 * The stage always follows the PLAYHEAD: the framing you see is whatever shot
 * covers the current time.
 */
export function EditorCanvas({
  scene,
  time,
  duration,
  isPlaying,
  onTogglePlay,
  onSeek,
  onPause,
  activeShot,
  activeMark,
  onTargetSubject,
  selectedSubjectId,
  peekSubjectId,
  showTargets,
  drawing,
  onDrawArea,
  editingArea,
  activeArea,
  areaLabel,
  videoRef,
  strip,
  children,
}: {
  scene: SceneEditing;
  time: number;
  duration: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
  onPause: () => void;
  activeShot: Shot | undefined;
  activeMark: AttentionMark;
  onTargetSubject: (subjectId: string) => void;
  /** Subject highlighted because its mark or clip is selected. */
  selectedSubjectId?: string;
  /** Subject momentarily lit because its row is hovered in the inspector. */
  peekSubjectId?: string | null;
  /** True while something on the attention track is selected. Only then does
   *  the stage show its labeling — boxes, target glow, area outline. The rest
   *  of the time the video is clean. */
  showTargets: boolean;
  /** Area draw mode: armed by the inspector; drag on the stage to set it. */
  drawing: boolean;
  onDrawArea: (region: AreaRegion) => void;
  /** The selected mark's region — frosted while it is being edited. */
  editingArea: AreaRegion | null;
  /** The region holding the eye at the playhead — outlined as status. */
  activeArea: AreaRegion | null;
  /** Label for whichever region is showing (the mark's name). */
  areaLabel?: string;
  /** The stage's video element — the clock during playback (see useVideoSync). */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** When the Mirage host supplies the scene sequence, the embedded filmstrip
   *  replaces the curved wave as the take's time player. */
  strip?: { scenes: StripScene[]; onExit?: (sceneId?: string) => void };
  /** The floating inspector for whatever is selected. */
  children?: React.ReactNode;
}) {
  // The crop is derived from the shot's subject, so a clip tagged
  // "CU - Maison Perrier" actually frames the bottle. While DRAWING, the crop
  // is suspended: regions are stored in full-frame coordinates, so you draw on
  // the whole frame, not on a crop of it.
  //
  // Only the VIDEO gets the CSS transform. The HUD's geometry is mapped
  // through the same numbers instead (mapRegion), so a box tracks its subject
  // through any crop while its stroke, chip and corner handles keep their
  // true size — a close-up zooms the picture, never the labelling.
  const framing =
    !drawing && activeShot
      ? framingParams(activeShot.preset, framingSubject(activeShot))
      : { z: 1, dx: 0, dy: 0 };
  const transform =
    framing.z === 1
      ? undefined
      : `scale(${framing.z}) translate(${framing.dx}%, ${framing.dy}%)`;

  /* --- Area drawing: a corner-to-corner marquee, per the design ------------- */

  const drawRef = useRef<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<AreaRegion | null>(null);

  const pctPoint = (e: ReactPointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)),
      y: Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100)),
    };
  };

  const drawHandlers = {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      drawRef.current = pctPoint(e);
    },
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
      const c = drawRef.current;
      if (!c) return;
      const p = pctPoint(e);
      setDraft({
        x: Math.min(c.x, p.x),
        y: Math.min(c.y, p.y),
        w: Math.abs(p.x - c.x),
        h: Math.abs(p.y - c.y),
      });
    },
    onPointerUp: (e: ReactPointerEvent<HTMLElement>) => {
      const c = drawRef.current;
      if (!c) return;
      drawRef.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      // A plain click drops a default-size region centred on the point.
      const done =
        draft && draft.w > 2 && draft.h > 2
          ? draft
          : {
              x: Math.max(0, Math.min(76, c.x - 12)),
              y: Math.max(0, Math.min(76, c.y - 12)),
              w: 24,
              h: 24,
            };
      setDraft(null);
      onDrawArea(done);
    },
  };

  /** While dragging, the background DIMS and the marquee stays clear — the
   *  clear rectangle is the thing being pointed at. */
  const showDim = drawing;
  // Only what is actually in frame right now — the take cuts between rooms.
  const present = subjectsAt(time);
  const targetId = activeMark.kind === 'object' ? activeMark.subjectId : undefined;

  return (
    <div className="anim-canvas">
      {/* Two quiet utilities where the pillar used to be. */}
      <div className="anim-utils">
        <IconButton size={40} pill aria-label="Chat">
          <ChatCircle size={20} />
        </IconButton>
        <IconButton size={40} pill aria-label="Settings">
          <GearSix size={20} />
        </IconButton>
      </div>

      <div className="anim-preview-wrap">
        <div className={`anim-preview ${strip ? 'anim-preview--strip' : ''}`}>
          <video
            ref={videoRef}
            className="anim-preview__video"
            src={SOURCE_VIDEO}
            style={{ transform }}
            muted
            playsInline
            preload="metadata"
          />

          {/* The object graph — only while the attention track is selected.
              Then the stage is a targeting surface and the boxes show outright
              (no hover needed); otherwise the video stays free of labeling. */}
          {showTargets && (
          <div className="anim-hud" data-live data-inert={drawing || undefined}>
            {present.map((s) => {
              const isTarget = s.id === targetId;
              // Clipped to the frame: a selection never exceeds the picture,
              // and a subject the crop pushes out of view gets no box at all.
              const b = clipRegion(mapRegion(framing, s.box));
              if (!b) return null;
              const style: CSSProperties = {
                left: `${b.x}%`,
                top: `${b.y}%`,
                width: `${b.w}%`,
                height: `${b.h}%`,
              };
              return (
                <button
                  type="button"
                  className="anim-hud__box"
                  key={s.id}
                  data-kind={s.kind}
                  data-target={isTarget || undefined}
                  data-selected={s.id === selectedSubjectId || s.id === peekSubjectId || undefined}
                  data-provenance={s.provenance}
                  data-tag-in={b.y < 6 || undefined}
                  style={style}
                  aria-label={
                    isTarget ? `${s.label} — currently holds the eye` : `Put the eye on ${s.label}`
                  }
                  title={isTarget ? `${s.label} holds the eye here` : `Click to put the eye on ${s.label}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTargetSubject(s.id);
                  }}
                >
                  <span className="anim-hud__tag">{s.label}</span>
                  {(isTarget || s.id === selectedSubjectId || s.id === peekSubjectId) && (
                    <>
                      <i className="anim-corner anim-corner--tl" />
                      <i className="anim-corner anim-corner--tr" />
                      <i className="anim-corner anim-corner--bl" />
                      <i className="anim-corner anim-corner--br" />
                    </>
                  )}
                </button>
              );
            })}
          </div>
          )}

          {/* While drawing: the background dims; the marquee (once a drag is
              in flight) is a clear cutout with a light stroke. */}
          {showDim &&
            (draft ? (
              <div className="anim-dimlayer" aria-hidden>
                <span
                  className="anim-marquee"
                  style={{
                    left: `${draft.x}%`,
                    top: `${draft.y}%`,
                    width: `${draft.w}%`,
                    height: `${draft.h}%`,
                  }}
                />
              </div>
            ) : (
              <div className="anim-dimlayer anim-dimlayer--full" aria-hidden />
            ))}

          {/* The committed region: outline + auto-named chip; corner handles
              only while its mark is selected (editingArea), matching how the
              object boxes behave. Shown only while attention holds the stage. */}
          {showTargets && !drawing && (editingArea ?? activeArea) && (
            (() => {
              const r = clipRegion(mapRegion(framing, editingArea ?? activeArea!));
              if (!r) return null;
              return (
                <span
                  className="anim-area"
                  data-editing={editingArea ? true : undefined}
                  data-tag-in={r.y < 6 || undefined}
                  style={{
                    left: `${r.x}%`,
                    top: `${r.y}%`,
                    width: `${r.w}%`,
                    height: `${r.h}%`,
                  }}
                  aria-hidden
                >
                  <span className="anim-hud__tag">{areaLabel}</span>
                  {/* A shown region IS selected for attention — it always
                      wears the corner squares; stroke-only is the hover look,
                      and areas have no hover state. */}
                  <i className="anim-corner anim-corner--tl" />
                  <i className="anim-corner anim-corner--tr" />
                  <i className="anim-corner anim-corner--bl" />
                  <i className="anim-corner anim-corner--br" />
                </span>
              );
            })()
          )}

          {/* The draw surface — only exists while armed, so it cannot swallow
              clicks any other time. */}
          {drawing && <div className="anim-drawlayer" {...drawHandlers} />}

          {/* Play control, inside the frame per the design. */}
          <button
            className="anim-play"
            type="button"
            aria-label={isPlaying ? 'Pause' : 'Play'}
            aria-pressed={isPlaying}
            onClick={onTogglePlay}
          >
            {isPlaying ? (
              <Pause size={18} weight="fill" />
            ) : (
              /* A triangle reads centred slightly right of true centre. */
              <Play size={18} weight="fill" style={{ transform: 'translateX(1px)' }} />
            )}
          </button>

          {/* The take's time player: the embedded filmstrip when the host
              supplies the scene sequence, the organic wave otherwise. */}
          {strip ? (
            <FilmstripScrubber
              scenes={strip.scenes}
              duration={duration}
              time={time}
              cuts={TAKE_CUTS}
              onSeek={onSeek}
              onPause={onPause}
              onExit={strip.onExit}
            />
          ) : (
            <CurvedScrubber
              scene={scene}
              duration={duration}
              time={time}
              onSeek={onSeek}
              onPause={onPause}
            />
          )}
        </div>
      </div>

      {children}
    </div>
  );
}
