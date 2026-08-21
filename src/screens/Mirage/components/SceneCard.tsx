import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, Plus, User, X } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AVATARS,
  castOf,
  formatTimecode,
  PLAYBACK_SCENE_MS,
  type AvatarId,
  type CastMember,
  type Scene,
  type ScenePatch,
} from '../data';

/** Which cast popover is open inside the editing card. */
type CastMenu = { kind: 'member'; id: string } | { kind: 'add' } | null;

const clampDuration = (n: number) => Math.min(120, Math.max(2, n));

/** "MM:SS" → seconds, or null when it doesn't parse. */
const parseTimecode = (v: string): number | null => {
  const m = /^(\d{1,3}):([0-5]?\d)$/.exec(v.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/**
 * One corkboard card (Raw 04/05): thumbnail, title + snippet, derived start
 * timecode and cast chips. While the scene's background render is cooking (or
 * RE-cooking after a generative edit) the thumbnail is hidden until it lands.
 *
 * The edit posture (Figma 718-136736) replaces the whole card face — no
 * thumbnail, since the render itself is not editable here: an "Edit Scene"
 * form with the avatars row, duration + start/end times, title and
 * description. Everything edits a local DRAFT; the cyan check commits it all
 * at once (re-cooking the render when a generative field changed) and stays
 * disabled until something actually differs. ✕ or Escape discards.
 */
export function SceneCard({
  scene,
  videoCast,
  cooking,
  playing = false,
  editing = false,
  fresh = false,
  startSec,
  onOpen,
  onEndEdit,
  onEdit,
  registerEl,
}: {
  scene: Scene;
  /** The video's cast — the only avatars this scene's editor can add. */
  videoCast: AvatarId[];
  cooking: boolean;
  playing?: boolean;
  editing?: boolean;
  /** A just-inserted, never-committed scene: the duration/time fields seed
   *  EMPTY (not from the blank scene's default), and the ✓ always recooks —
   *  the render only starts once the card has been filled in. */
  fresh?: boolean;
  /** The scene's derived start time — the badge value. */
  startSec: number;
  onOpen: (el: HTMLElement) => void;
  onEndEdit: () => void;
  /** Apply a patch; `recook` marks the render stale. */
  onEdit: (patch: ScenePatch, opts?: { recook?: boolean }) => void;
  registerEl?: (el: HTMLDivElement | null) => void;
}) {
  const [menu, setMenu] = useState<CastMenu>(null);

  /* --- Edit drafts: seeded when the posture opens, committed by the check --- */
  const [draftTitle, setDraftTitle] = useState(scene.title);
  const [draftSummary, setDraftSummary] = useState(scene.summary);
  const [draftDuration, setDraftDuration] = useState(scene.durationSec);
  const [draftCast, setDraftCast] = useState<CastMember[]>(scene.cast);
  const [durStr, setDurStr] = useState(fresh ? '' : String(scene.durationSec));
  const [endStr, setEndStr] = useState(fresh ? '' : formatTimecode(startSec + scene.durationSec));

  /* The edit face scrolls as a whole (no inner textarea scroll): the summary
     box grows with its content, and a shadow above the confirm row says
     "there's more below the fold". */
  const editScrollRef = useRef<HTMLDivElement | null>(null);
  const areaRef = useRef<HTMLTextAreaElement | null>(null);
  const [moreBelow, setMoreBelow] = useState(false);

  /* A whisper of a flip whenever the card changes posture (view ⇄ edit).
     Compares against the previous value (not a consumed-once flag, which
     StrictMode's doubled effects burn on mount) and runs before paint so the
     new face never shows an unanimated frame. */
  const [turning, setTurning] = useState(false);
  const prevEditing = useRef(editing);
  useLayoutEffect(() => {
    if (prevEditing.current !== editing) setTurning(true);
    prevEditing.current = editing;
  }, [editing]);
  const turnProps = {
    onAnimationEnd: (e: React.AnimationEvent) => {
      if (e.animationName === 'mir-card-turn') setTurning(false);
    },
  };
  const measureOverflow = () => {
    const el = editScrollRef.current;
    if (el) setMoreBelow(el.scrollTop + el.clientHeight < el.scrollHeight - 2);
  };
  useEffect(() => {
    if (!editing) return;
    const area = areaRef.current;
    if (area) {
      area.style.height = 'auto';
      area.style.height = `${area.scrollHeight}px`;
    }
    requestAnimationFrame(measureOverflow);
  }, [editing, draftSummary]);

  useEffect(() => {
    if (!editing) {
      setMenu(null);
      return;
    }
    setDraftTitle(scene.title);
    setDraftSummary(scene.summary);
    setDraftDuration(scene.durationSec);
    setDraftCast(scene.cast);
    setDurStr(fresh ? '' : String(scene.durationSec));
    setEndStr(fresh ? '' : formatTimecode(startSec + scene.durationSec));
    // seed only on OPEN — while editing, the drafts are the source of truth
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const castChanged =
    draftCast.length !== scene.cast.length ||
    draftCast.some(
      (m, i) => m.id !== scene.cast[i]?.id || m.name !== scene.cast[i]?.name || m.provenance !== scene.cast[i]?.provenance,
    );
  const dirty =
    draftTitle.trim() !== scene.title ||
    draftSummary.trim() !== scene.summary ||
    draftDuration !== scene.durationSec ||
    castChanged;

  const commit = () => {
    if (!dirty) return;
    if (fresh) {
      // First commit of an inserted card: everything lands at once and the
      // render starts NOW — the card flips to its view face and cooks.
      onEdit(
        {
          title: draftTitle.trim() || 'New scene',
          summary: draftSummary.trim(),
          durationSec: draftDuration,
          cast: draftCast,
        },
        { recook: true },
      );
      onEndEdit();
      return;
    }
    const patch: ScenePatch = {};
    if (draftTitle.trim() && draftTitle.trim() !== scene.title) patch.title = draftTitle.trim();
    if (draftSummary.trim() && draftSummary.trim() !== scene.summary) patch.summary = draftSummary.trim();
    if (draftDuration !== scene.durationSec) patch.durationSec = draftDuration;
    if (castChanged) patch.cast = draftCast;
    // Title alone is cosmetic; summary / duration / cast send the scene back
    // to the renderer.
    const recook = 'summary' in patch || 'durationSec' in patch || 'cast' in patch;
    onEdit(patch, { recook });
    onEndEdit();
  };

  const setDuration = (n: number) => {
    const d = clampDuration(n);
    setDraftDuration(d);
    setEndStr(formatTimecode(startSec + d));
  };

  const patchCast = (cast: CastMember[]) => {
    setMenu(null);
    setDraftCast(cast);
  };

  /** Only the VIDEO's avatars are addable here — bringing a new library
   *  avatar into the video happens at the board meta's +, not per scene. */
  const availableAvatars = videoCast.filter((id) => !draftCast.some((m) => m.id === id));

  const chip = (m: CastMember, interactive: boolean) => {
    const face = (
      <button
        key={interactive ? undefined : m.id}
        type="button"
        className={`mir-cast ${m.provenance === 'detected' ? 'mir-cast--detected' : ''}`}
        aria-label={m.name}
        tabIndex={interactive ? 0 : -1}
        onClick={(e) => {
          if (!interactive) return;
          e.stopPropagation();
          setMenu((cur) => (cur?.kind === 'member' && cur.id === m.id ? null : { kind: 'member', id: m.id }));
        }}
      >
        {m.chip ? <img src={m.chip} alt="" /> : <User size={13} weight="bold" />}
      </button>
    );
    if (!interactive) return face;
    // Editing: each chip wears a small ✕ — remove without opening the popover.
    return (
      <span className="mir-cast-wrap" key={m.id}>
        {face}
        <button
          type="button"
          className="mir-cast-remove"
          aria-label={`Remove ${m.name} from this scene`}
          onClick={(e) => {
            e.stopPropagation();
            patchCast(draftCast.filter((x) => x.id !== m.id));
          }}
        >
          <X size={8} weight="bold" />
        </button>
      </span>
    );
  };

  /* --- View posture ----------------------------------------------------------- */
  if (!editing) {
    return (
      <div
        className={`mir-card ${cooking ? 'mir-card--cooking' : ''} ${turning ? 'mir-card--turn' : ''} ${
          playing ? 'mir-card--playing' : ''
        }`}
        ref={registerEl}
        onClick={(e) => onOpen(e.currentTarget)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onOpen(e.currentTarget)}
        {...turnProps}
      >
        <div className="mir-card__top">
          <div className="mir-card__thumb">
            <img src={scene.thumb} alt="" draggable={false} />
            {playing && (
              <span
                className="mir-card__progress"
                style={{ animationDuration: `${PLAYBACK_SCENE_MS}ms` }}
                aria-label="Playing"
              />
            )}
          </div>
          <h3 className="mir-card__title">{scene.title}</h3>
          <p className="mir-card__summary">{scene.summary}</p>
        </div>

        <div className="mir-card__bottom">
          <span className="mir-card__badge">{formatTimecode(startSec)}</span>
          {/* Idle cards just SHOW the cast — all editing enters through the
              hover pencil, so the pile carries no + of its own. */}
          <span className="mir-card__cast">{scene.cast.map((m) => chip(m, false))}</span>
        </div>
      </div>
    );
  }

  /* --- Edit posture (Figma 718-136736) ----------------------------------------- */
  const member = menu?.kind === 'member' ? draftCast.find((m) => m.id === menu.id) : null;

  /* Cast popovers (attn-menu style), anchored under the avatars row. They edit
     the DRAFT; the check commits. Exits mirror the entrance keyframes, and
     keying by member lets switching popovers cross-fade instead of cutting. */
  const MENU_EXIT = {
    opacity: 0,
    y: -2,
    scale: 0.98,
    transition: { duration: 0.12, ease: 'easeOut' as const },
  };
  const castMenus = (
    <AnimatePresence>
      {member && (
        <motion.div
          key={`member-${member.id}`}
          className="mir-cast-menu"
          exit={MENU_EXIT}
          onClick={(e) => e.stopPropagation()}
        >
          {member.provenance === 'detected' ? (
            <>
              <button
                type="button"
                className="mir-cast-menu__row"
                onClick={() => {
                  const name = window.prompt('Name this person', member.name) ?? member.name;
                  patchCast(draftCast.map((m) => (m.id === member.id ? { ...m, name } : m)));
                }}
              >
                Name this person
              </button>
              <button
                type="button"
                className="mir-cast-menu__row mir-cast-menu__row--primary"
                onClick={() =>
                  // The claim flow: a detected person becomes a real, editable
                  // Captions avatar — the scene is now recastable around them.
                  patchCast(
                    draftCast.map((m) =>
                      m.id === member.id ? { ...m, provenance: 'generated' as const } : m,
                    ),
                  )
                }
              >
                Make an avatar from this person
              </button>
            </>
          ) : (
            availableAvatars.slice(0, 2).map((id) => (
              <button
                type="button"
                className="mir-cast-menu__row"
                key={id}
                onClick={() => patchCast(draftCast.map((m) => (m.id === member.id ? castOf(id) : m)))}
              >
                Recast as {AVATARS[id].name}
              </button>
            ))
          )}
          <button
            type="button"
            className="mir-cast-menu__row mir-cast-menu__row--danger"
            onClick={() => patchCast(draftCast.filter((m) => m.id !== member.id))}
          >
            Remove from scene
          </button>
        </motion.div>
      )}

      {menu?.kind === 'add' && (
        <motion.div
          key="add"
          className="mir-cast-menu"
          exit={MENU_EXIT}
          onClick={(e) => e.stopPropagation()}
        >
          {availableAvatars.map((id) => (
            <button
              type="button"
              className="mir-cast-menu__row"
              key={id}
              onClick={() => patchCast([...draftCast, castOf(id)])}
            >
              <img className="mir-cast-menu__chip" src={AVATARS[id].chip} alt="" />
              {AVATARS[id].name}
            </button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div
      className={`mir-card mir-card--editing ${cooking ? 'mir-card--cooking' : ''} ${turning ? 'mir-card--turn' : ''}`}
      ref={registerEl}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onEndEdit();
        }
      }}
      {...turnProps}
    >
      <div className="mir-edit" ref={editScrollRef} onScroll={measureOverflow}>
        <div className="mir-edit__head">
          <span className="mir-edit__heading">Edit Scene</span>
          <button
            type="button"
            className="mir-edit__close"
            aria-label="Discard changes"
            onClick={onEndEdit}
          >
            <X size={16} />
          </button>
        </div>

        <div className="mir-edit__section">
          <span className="mir-edit__label">Avatars</span>
          <div className="mir-edit__castwrap">
            <div className="mir-edit__cast">
              {/* Dead once the whole video cast is in the scene — new avatars
                  join the VIDEO at the board meta's +, not here. */}
              <button
                type="button"
                className="mir-cast mir-cast--plus"
                aria-label="Add an avatar to this scene"
                disabled={availableAvatars.length === 0}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenu((cur) => (cur?.kind === 'add' ? null : { kind: 'add' }));
                }}
              >
                <Plus size={14} weight="bold" />
              </button>
              {draftCast.map((m) => chip(m, true))}
            </div>
            {castMenus}
          </div>
        </div>

        <div className="mir-edit__times">
          <div className="mir-edit__section mir-edit__section--duration">
            <span className="mir-edit__label" id={`dur-${scene.id}`}>
              Duration
            </span>
            <div className="mir-edit__field mir-edit__field--suffix">
              <input
                value={durStr}
                inputMode="numeric"
                aria-labelledby={`dur-${scene.id}`}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 3);
                  setDurStr(v);
                  if (v) setDuration(Number(v));
                }}
                onBlur={() => setDurStr(String(draftDuration))}
              />
              <span className="mir-edit__suffix">s</span>
            </div>
          </div>
          <div className="mir-edit__pair">
            <div className="mir-edit__section">
              <span className="mir-edit__label">Start time</span>
              <input
                className="mir-edit__field mir-edit__field--start"
                value={formatTimecode(startSec)}
                readOnly
                aria-label="Start time (derived from the scenes before)"
                tabIndex={-1}
              />
            </div>
            <div className="mir-edit__section">
              <span className="mir-edit__label">End time</span>
              <input
                className="mir-edit__field mir-edit__field--end"
                value={endStr}
                aria-label="End time"
                onChange={(e) => setEndStr(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                onBlur={() => {
                  const sec = parseTimecode(endStr);
                  if (sec != null && sec > startSec) {
                    const d = clampDuration(sec - startSec);
                    setDraftDuration(d);
                    setDurStr(String(d));
                    setEndStr(formatTimecode(startSec + d));
                  } else {
                    setEndStr(formatTimecode(startSec + draftDuration));
                  }
                }}
              />
            </div>
          </div>
        </div>

        <div className="mir-edit__section">
          <span className="mir-edit__label" id={`title-${scene.id}`}>
            Title
          </span>
          <input
            className="mir-edit__field"
            value={draftTitle}
            aria-labelledby={`title-${scene.id}`}
            /* A fresh card opens ready to type — and with focus inside the
               card, Escape reaches its discard handler immediately. */
            autoFocus={fresh}
            onChange={(e) => setDraftTitle(e.target.value)}
          />
        </div>

        <div className="mir-edit__section">
          <span className="mir-edit__label" id={`desc-${scene.id}`}>
            Description
          </span>
          <textarea
            className="mir-edit__field mir-edit__area"
            ref={areaRef}
            rows={2}
            value={draftSummary}
            aria-labelledby={`desc-${scene.id}`}
            placeholder="Describe the scene — Mirage restages it on save"
            onChange={(e) => setDraftSummary(e.target.value)}
          />
        </div>
      </div>

      {/* More below the fold: shadow only, never a scrollbar. */}
      {moreBelow && <div className="mir-edit__more" aria-hidden />}

      {/* Commit: lit cyan only once something actually changed. */}
      <button
        type="button"
        className="mir-edit__confirm"
        aria-label={dirty ? 'Save changes' : 'No changes to save'}
        disabled={!dirty}
        onClick={commit}
      >
        <Check size={14} weight="bold" />
      </button>
    </div>
  );
}
