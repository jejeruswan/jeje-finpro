import { useEffect, useRef, useState } from 'react';
import { Check, Plus, User } from '@phosphor-icons/react';
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

/**
 * One corkboard card (Raw 04/05): thumbnail, title + snippet, derived start
 * timecode and cast chips. While the scene's background render is cooking (or
 * RE-cooking after a generative edit) the thumbnail sits under a heavy blur
 * that resolves to sharp — the copy stays readable and the card interactive.
 *
 * The pencil (on hover) shifts the card into an in-place edit posture — no
 * flip, no modal: title and summary become inputs, the badge becomes a
 * scrubbable duration, and the cast row becomes editable with full provenance
 * semantics (generated avatars recast/remove; detected people can be named or
 * claimed into avatars). Generative edits mark the scene stale and re-cook.
 */
export function SceneCard({
  scene,
  cooking,
  playing = false,
  editing = false,
  startSec,
  onOpen,
  onEndEdit,
  onEdit,
  registerEl,
}: {
  scene: Scene;
  cooking: boolean;
  playing?: boolean;
  editing?: boolean;
  /** The scene's derived start time — the badge value. */
  startSec: number;
  onOpen: (el: HTMLElement) => void;
  onBeginEdit: () => void;
  onEndEdit: () => void;
  /** Apply a patch; `recook` marks the render stale (blur-to-clear again). */
  onEdit: (patch: ScenePatch, opts?: { recook?: boolean }) => void;
  registerEl?: (el: HTMLDivElement | null) => void;
}) {
  const [menu, setMenu] = useState<CastMenu>(null);
  const [summaryDraft, setSummaryDraft] = useState(scene.summary);
  const [scrubSec, setScrubSec] = useState<number | null>(null);
  const scrub = useRef<{ startX: number; base: number } | null>(null);

  // Fresh drafts each time edit mode opens; menus close when it ends. The
  // summary is deliberately sampled only at open — while typing, the draft is
  // the source of truth until commit.
  const summaryRef = useRef(scene.summary);
  summaryRef.current = scene.summary;
  useEffect(() => {
    if (editing) setSummaryDraft(summaryRef.current);
    else setMenu(null);
  }, [editing]);

  const commitSummary = () => {
    const next = summaryDraft.trim();
    if (next && next !== scene.summary) onEdit({ summary: next }, { recook: true });
  };

  const patchCast = (cast: CastMember[]) => {
    setMenu(null);
    onEdit({ cast }, { recook: true });
  };

  const availableAvatars = (Object.keys(AVATARS) as AvatarId[]).filter(
    (id) => !scene.cast.some((m) => m.id === id),
  );

  const chip = (m: CastMember, interactive: boolean) => (
    <button
      key={m.id}
      type="button"
      className={`mir-cast ${m.provenance === 'detected' ? 'mir-cast--detected' : ''}`}
      title={
        m.provenance === 'detected'
          ? `${m.name} — detected in your footage (unclaimed)`
          : `${m.name} — Captions avatar`
      }
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

  /* --- View posture ----------------------------------------------------------- */
  if (!editing) {
    return (
      <div
        className={`mir-card ${cooking ? 'mir-card--cooking' : ''}`}
        ref={registerEl}
        onClick={(e) => onOpen(e.currentTarget)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onOpen(e.currentTarget)}
      >
        <div className="mir-card__top">
          <div className="mir-card__thumb">
            <img src={scene.thumb} alt="" draggable={false} />
            {cooking && <span className="mir-card__cooking-dot" aria-label="Rendering" />}
            {playing && (
              <span
                className="mir-card__progress"
                style={{ animationDuration: `${PLAYBACK_SCENE_MS}ms` }}
                aria-label="Playing"
              />
            )}
            {/* Edit entry point intentionally absent for now — updated edit
                designs are coming; the edit posture below stays wired. */}
          </div>
          <h3 className="mir-card__title">{scene.title}</h3>
          <p className="mir-card__summary">{scene.summary}</p>
        </div>

        <div className="mir-card__bottom">
          <span className="mir-card__badge">{formatTimecode(startSec)}</span>
          <span className="mir-card__cast">{scene.cast.map((m) => chip(m, false))}</span>
        </div>
      </div>
    );
  }

  /* --- Edit posture ------------------------------------------------------------ */
  const shownSec = scrubSec ?? scene.durationSec;
  const member = menu?.kind === 'member' ? scene.cast.find((m) => m.id === menu.id) : null;

  return (
    <div
      className={`mir-card mir-card--editing ${cooking ? 'mir-card--cooking' : ''}`}
      ref={registerEl}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          commitSummary();
          onEndEdit();
        }
      }}
    >
      <div className="mir-card__top">
        <div className="mir-card__thumb">
          <img src={scene.thumb} alt="" draggable={false} />
          {cooking && <span className="mir-card__cooking-dot" aria-label="Rendering" />}
        </div>
        <input
          className="mir-card__title-input"
          value={scene.title}
          aria-label="Scene title"
          onChange={(e) => onEdit({ title: e.target.value })}
        />
        <textarea
          className="mir-card__summary-input"
          value={summaryDraft}
          rows={4}
          aria-label="Scene description"
          placeholder="Describe the scene — Mirage restages it on save"
          onChange={(e) => setSummaryDraft(e.target.value)}
          onBlur={commitSummary}
        />
      </div>

      <div className="mir-card__bottom">
        <span
          className="mir-card__badge mir-card__badge--scrub"
          title="Drag to retime the scene"
          onPointerDown={(e) => {
            e.stopPropagation();
            scrub.current = { startX: e.clientX, base: scene.durationSec };
            setScrubSec(scene.durationSec);
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!scrub.current) return;
            const delta = Math.round((e.clientX - scrub.current.startX) / 8);
            setScrubSec(Math.min(120, Math.max(2, scrub.current.base + delta)));
          }}
          onPointerUp={() => {
            if (scrub.current && scrubSec != null && scrubSec !== scene.durationSec) {
              onEdit({ durationSec: scrubSec }, { recook: true });
            }
            scrub.current = null;
            setScrubSec(null);
          }}
        >
          {shownSec}s
        </span>

        <span className="mir-card__cast mir-card__cast--edit">
          {scene.cast.map((m) => chip(m, true))}
          <button
            type="button"
            className="mir-cast mir-cast--add"
            aria-label="Add an avatar to this scene"
            onClick={(e) => {
              e.stopPropagation();
              setMenu((cur) => (cur?.kind === 'add' ? null : { kind: 'add' }));
            }}
          >
            <Plus size={12} weight="bold" />
          </button>
          <button
            type="button"
            className="mir-cast mir-cast--done"
            aria-label="Done editing"
            onClick={(e) => {
              e.stopPropagation();
              commitSummary();
              onEndEdit();
            }}
          >
            <Check size={13} weight="bold" />
          </button>
        </span>
      </div>

      {/* --- Cast popovers ------------------------------------------------------ */}
      {member && (
        <div className="mir-cast-menu" onClick={(e) => e.stopPropagation()}>
          <p className="mir-cast-menu__head">
            {member.name}
            <span className="mir-cast-menu__tag" data-provenance={member.provenance}>
              {member.provenance}
            </span>
          </p>
          {member.provenance === 'detected' ? (
            <>
              <button
                type="button"
                className="mir-cast-menu__row"
                onClick={() => {
                  const name = window.prompt('Name this person', member.name) ?? member.name;
                  patchCast(scene.cast.map((m) => (m.id === member.id ? { ...m, name } : m)));
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
                    scene.cast.map((m) =>
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
                onClick={() =>
                  patchCast(scene.cast.map((m) => (m.id === member.id ? castOf(id) : m)))
                }
              >
                Recast as {AVATARS[id].name}
              </button>
            ))
          )}
          <button
            type="button"
            className="mir-cast-menu__row mir-cast-menu__row--danger"
            onClick={() => patchCast(scene.cast.filter((m) => m.id !== member.id))}
          >
            Remove from scene
          </button>
        </div>
      )}

      {menu?.kind === 'add' && (
        <div className="mir-cast-menu" onClick={(e) => e.stopPropagation()}>
          <p className="mir-cast-menu__head">Add to scene</p>
          {availableAvatars.length === 0 && (
            <p className="mir-cast-menu__empty">Every avatar is already in this scene.</p>
          )}
          {availableAvatars.map((id) => (
            <button
              type="button"
              className="mir-cast-menu__row"
              key={id}
              onClick={() => patchCast([...scene.cast, castOf(id)])}
            >
              <img className="mir-cast-menu__chip" src={AVATARS[id].chip} alt="" />
              {AVATARS[id].name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
