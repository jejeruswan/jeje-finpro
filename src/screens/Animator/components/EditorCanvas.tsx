import { useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { Pause, Play } from '@phosphor-icons/react';
import { ChatShine } from '../../../assets/icons';
import { IconButton } from '../../../ui/IconButton';
import {
  SOURCE_VIDEO,
  TAKE_CUTS,
  boxAt,
  clipRegion,
  framingParams,
  framingSubject,
  mapRegion,
  subjectsAt,
} from '../data';
import type { AreaRegion, AttentionMark, Shot, SubjectKind } from '../data';
import type { SceneEditing } from '../useSceneEditing';
import { CurvedScrubber } from './CurvedScrubber';
import { FilmstripScrubber, type StripScene } from './FilmstripScrubber';

/**
 * The Frame Canvas stage, matched to the design frame:
 *
 *  - the video sits centred; standalone, the play control lives INSIDE its
 *    bottom-left corner, while in strip mode (Figma 756-165361) the button is
 *    docked at the canvas's left edge, above the timeline ruler
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
  renderPhase,
  strip,
  presenceHud,
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
  /** The one-second rerender world (see useRenderStatus): while an edit is
   *  rendering, the picture diffuses soft and resolves back to crisp. */
  renderPhase?: 'clean' | 'dirty' | 'resolving';
  /** When the Mirage host supplies the scene sequence, the embedded filmstrip
   *  replaces the curved wave as the take's time player. */
  strip?: { scenes: StripScene[]; onExit?: (sceneId?: string) => void };
  /** The always-available subject layer: lens-enabled entities with their box
   *  at the current time. Quiet until hovered — labels reveal on hover whether
   *  the take is playing or paused — and clicking one travels the lens. While
   *  the attention track holds the stage (showTargets), this layer yields:
   *  there, clicking a box means "target it", not "open it". */
  presenceHud?: {
    boxes: { id: string; label: string; kind: SubjectKind; box: AreaRegion }[];
    lensId: string | null;
    onPick: (entityId: string) => void;
    /** A press on the bare stage while the lens is open — the host peels. */
    onStageDown?: () => void;
  };
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

  /* --- The presence layer's cursor tag ---------------------------------------
     While a subject is merely HOVERED its label rides the cursor (Figma
     751-162363); it only docks to the box once the subject is selected (the
     open lens). Position is written straight to the element — a pointermove
     must never re-render the canvas. */
  const [hoverEntityId, setHoverEntityId] = useState<string | null>(null);
  const cursorTagRef = useRef<HTMLSpanElement | null>(null);
  const moveCursorTag = (e: ReactPointerEvent<HTMLElement>) => {
    const el = cursorTagRef.current;
    if (!el) return;
    const r = e.currentTarget.getBoundingClientRect();
    // The chip hangs below-right of the cursor tip, per the design — but the
    // preview clips its own overflow, so near an edge the chip flips to the
    // cursor's other side instead of shearing off (and clamps as a last
    // resort, for a subject wedged into a corner).
    const cx = e.clientX - r.left;
    const cy = e.clientY - r.top;
    let x = cx + 12;
    let y = cy + 16;
    if (x + el.offsetWidth > r.width - 4) x = cx - el.offsetWidth - 12;
    if (y + el.offsetHeight > r.height - 4) y = cy - el.offsetHeight - 12;
    x = Math.max(4, Math.min(x, r.width - el.offsetWidth - 4));
    y = Math.max(4, Math.min(y, r.height - el.offsetHeight - 4));
    // The tight corner is the one pointing at the cursor — it flips with us.
    el.dataset.flipX = x < cx ? 'true' : '';
    el.dataset.flipY = y < cy ? 'true' : '';
    el.style.transform = `translate(${x}px, ${y}px)`;
    el.style.visibility = 'visible';
  };

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
  /** The subject layer is live whenever attention isn't holding the stage. */
  const presenceLive = !!presenceHud && !showTargets && !drawing;
  /** The hovered subject's label, riding the cursor — never for the open lens
   *  (its chip is docked), and gone the moment the box itself is (a run can
   *  end mid-hover during playback). */
  const cursorTag =
    presenceLive && hoverEntityId && hoverEntityId !== presenceHud!.lensId
      ? presenceHud!.boxes.find((b) => b.id === hoverEntityId)
      : undefined;
  // Only what is actually in frame right now — the take cuts between rooms.
  const present = subjectsAt(time);
  const targetId = activeMark.kind === 'object' ? activeMark.subjectId : undefined;

  return (
    <div className="anim-canvas">
      {/* One quiet utility where the pillar used to be. */}
      <div className="anim-utils">
        <IconButton size={40} pill aria-label="Chat">
          <ChatShine size={20} />
        </IconButton>
      </div>

      <div className="anim-preview-wrap">
        {/* The stage column: in strip mode the filmstrip scrubber rides ABOVE
            the video frame, left-aligned with it (Figma 756-165386). */}
        <div className="anim-stage">
          {strip && (
            <FilmstripScrubber
              scenes={strip.scenes}
              duration={duration}
              time={time}
              cuts={TAKE_CUTS}
              onSeek={onSeek}
              onPause={onPause}
              onExit={strip.onExit}
            />
          )}
          <div
            className="anim-preview"
            data-render={renderPhase !== 'clean' ? renderPhase : undefined}
            onPointerDown={presenceHud?.lensId ? presenceHud.onStageDown : undefined}
            onPointerMove={presenceLive ? moveCursorTag : undefined}
          >
            <video
              ref={videoRef}
              className="anim-preview__video"
              src={SOURCE_VIDEO}
              style={{ transform }}
              playsInline
              preload="metadata"
              /* The level flight canvas-captures frames; when the take streams
                 from Vercel Blob (cross-origin) the capture needs CORS opt-in
                 or the canvas taints and the hero dissolve falls back. */
              crossOrigin="anonymous"
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
                const b = clipRegion(mapRegion(framing, boxAt(s, time)));
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

            {/* The subject layer — the take's contents are always touchable.
                Boxes are invisible until the cursor finds them (playing or
                paused alike); the open lens's own box stays lit with handles,
                and clicking it again closes the lens. Hidden while attention
                holds the stage: there the boxes above mean "target", and two
                meanings for one click is one too many. */}
            {presenceLive && (
              <div className="anim-hud anim-hud--presence">
                {presenceHud!.boxes.map((s) => {
                  const b = clipRegion(mapRegion(framing, boxAt(s, time)));
                  if (!b) return null;
                  const inLens = presenceHud!.lensId === s.id;
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
                      data-selected={inLens || undefined}
                      data-tag-in={b.y < 6 || undefined}
                      style={style}
                      aria-label={
                        inLens
                          ? `Close ${s.label}'s presence view`
                          : `See when ${s.label} is on screen`
                      }
                      onPointerDown={(e) => e.stopPropagation()}
                      onPointerEnter={() => setHoverEntityId(s.id)}
                      onPointerLeave={() =>
                        setHoverEntityId((cur) => (cur === s.id ? null : cur))
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        presenceHud!.onPick(s.id);
                      }}
                    >
                      {/* The label docks to the box ONLY once selected — while
                          merely hovered it rides the cursor instead. */}
                      {inLens && <span className="anim-hud__tag">{s.label}</span>}
                      {inLens && (
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

            {/* The cursor tag itself: positioned by moveCursorTag, hidden until
                the first move so it never flashes at the frame's origin. */}
            {cursorTag && (
              <span ref={cursorTagRef} className="anim-hud__cursortag" aria-hidden>
                {cursorTag.label}
              </span>
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

            {/* Standalone: play control inside the frame, whole-take wave over
                the picture. In strip mode both leave the frame — the filmstrip
                is above it and the play button docks at the canvas edge. */}
            {!strip && (
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
            )}

            {!strip && (
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
      </div>

      {/* Strip mode's play control: the same 40px pill as the chat utility,
          docked at the canvas's left edge above the timeline ruler. */}
      {strip && (
        <IconButton
          size={40}
          pill
          className="anim-play--dock"
          aria-label={isPlaying ? 'Pause' : 'Play'}
          aria-pressed={isPlaying}
          onClick={onTogglePlay}
        >
          {/* No nudge on the triangle: Phosphor's play glyph already sits
              optically right of centre inside its own box. */}
          {isPlaying ? <Pause size={20} weight="fill" /> : <Play size={20} weight="fill" />}
        </IconButton>
      )}

      {children}
    </div>
  );
}
