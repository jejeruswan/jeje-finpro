import { useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { ChatCircle, GearSix, Pause, Play } from '@phosphor-icons/react';
import { IconButton } from '../../../ui/IconButton';
import { SOURCE_VIDEO, framingFor, subjectById, subjectsAt } from '../data';
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
  /** The stage's video element — the clock during playback (see useVideoSync). */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** When the Mirage host supplies the scene sequence, the embedded filmstrip
   *  replaces the curved wave as the take's time player. */
  strip?: { scenes: StripScene[]; onExit?: () => void };
  /** The floating inspector for whatever is selected. */
  children?: React.ReactNode;
}) {
  // The crop is derived from the shot's subject, so a clip tagged
  // "CU - Maison Perrier" actually frames the bottle. While DRAWING, the crop
  // is suspended: regions are stored in full-frame coordinates, so you draw on
  // the whole frame, not on a crop of it.
  const transform =
    !drawing && activeShot
      ? framingFor(activeShot.preset, subjectById(activeShot.subjectId))
      : undefined;

  /* --- Area drawing: drag from the centre outward -------------------------- */

  const drawRef = useRef<{ cx: number; cy: number } | null>(null);
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
      const p = pctPoint(e);
      drawRef.current = { cx: p.x, cy: p.y };
      setDraft({ cx: p.x, cy: p.y, rx: 0, ry: 0 });
    },
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
      const c = drawRef.current;
      if (!c) return;
      const p = pctPoint(e);
      setDraft({
        cx: c.cx,
        cy: c.cy,
        rx: Math.max(2, Math.abs(p.x - c.cx)),
        ry: Math.max(2, Math.abs(p.y - c.cy)),
      });
    },
    onPointerUp: (e: ReactPointerEvent<HTMLElement>) => {
      const c = drawRef.current;
      if (!c) return;
      drawRef.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      const done = draft && draft.rx > 3 && draft.ry > 3
        ? draft
        : { cx: c.cx, cy: c.cy, rx: 16, ry: 16 }; // plain click → default spot
      setDraft(null);
      onDrawArea(done);
    },
  };

  /** The frosted-glass overlay: everything OUTSIDE the region blurs and dims —
   *  the region itself stays crisp, because it is the thing being pointed at.
   *  The soft edge comes from the radial mask, and it is the honest edge:
   *  attention is a gradient, not a boundary. */
  const frostRegion = draft ?? (drawing ? null : editingArea);
  const frostMask = frostRegion
    ? `radial-gradient(ellipse ${frostRegion.rx}% ${frostRegion.ry}% at ${frostRegion.cx}% ${frostRegion.cy}%, transparent 62%, black 96%)`
    : undefined;
  const showFrost = drawing || editingArea !== null;
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
          <div className="anim-hud" data-live style={{ transform }} data-inert={drawing || undefined}>
            {present.map((s) => {
              const isTarget = s.id === targetId;
              const style: CSSProperties = {
                left: `${s.box.x}%`,
                top: `${s.box.y}%`,
                width: `${s.box.w}%`,
                height: `${s.box.h}%`,
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
                </button>
              );
            })}
          </div>
          )}

          {/* Frost: while drawing (full frost until a region opens a clear
              hole) and while a drawn area is selected for editing. */}
          {showFrost && (
            <div
              className="anim-frost"
              style={{
                transform,
                ...(frostMask
                  ? { maskImage: frostMask, WebkitMaskImage: frostMask }
                  : {}),
              }}
              aria-hidden
            />
          )}

          {/* Status outline: the region currently holding the eye — again only
              while the attention track is selected. */}
          {showTargets && !showFrost && activeArea && (
            <span
              className="anim-area-outline"
              style={{
                left: `${activeArea.cx - activeArea.rx}%`,
                top: `${activeArea.cy - activeArea.ry}%`,
                width: `${activeArea.rx * 2}%`,
                height: `${activeArea.ry * 2}%`,
                transform,
              }}
              aria-hidden
            />
          )}

          {/* The draw surface — only exists while armed, so it cannot swallow
              clicks any other time. */}
          {drawing && (
            <div className="anim-drawlayer" {...drawHandlers}>
              {!draft && <span className="anim-drawhint">Drag to set the area — Esc to cancel</span>}
            </div>
          )}

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
