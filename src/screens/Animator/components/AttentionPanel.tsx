import { Eye, PencilSimple, Trash, X } from '@phosphor-icons/react';
import { IconButton } from '../../../ui/IconButton';
import { formatClock, subjectsAt } from '../data';
import type { AttentionKind, AttentionRun } from '../data';

const KINDS: { id: AttentionKind; glyph: string; label: string; hint: string }[] = [
  { id: 'object', glyph: '●', label: 'Object', hint: 'a subject from the frame' },
  { id: 'area', glyph: '✼', label: 'Area', hint: 'a region you draw on the frame' },
  { id: 'none', glyph: '○', label: 'None', hint: 'no preference — the line greys' },
];

/**
 * Inspector for one attention mark and the run it starts.
 *
 * Picking a KIND is only half the choice, so each kind opens its own second
 * step: OBJECT lists what is actually on screen at that moment (hovering a row
 * lights its box on the canvas; clicking a box on the canvas picks it here —
 * same choice, two surfaces), and AREA hands you the stage itself: a draw mode
 * where everything outside your drag frosts over, because the region you keep
 * clear is the thing being pointed at.
 */
export function AttentionPanel({
  run,
  pinned,
  drawing,
  onClose,
  onSetKind,
  onSetSubject,
  onPeekSubject,
  onSetArea,
  onRedrawArea,
  onRemove,
}: {
  run: AttentionRun;
  /** The origin mark — retargetable, never deletable. */
  pinned: boolean;
  /** True while the stage's area draw mode is armed for this mark. */
  drawing: boolean;
  onClose: () => void;
  onSetKind: (kind: AttentionKind) => void;
  onSetSubject: (subjectId: string) => void;
  onPeekSubject: (subjectId: string | null) => void;
  onSetArea: (label: string) => void;
  onRedrawArea: () => void;
  onRemove: () => void;
}) {
  const { mark } = run;
  // Legal object targets: what is actually on screen when this state begins.
  const present = subjectsAt(mark.t);

  return (
    <aside className="prop-panel prop-panel--attn" aria-label="Attention">
      <header className="prop-panel__header">
        <span className="prop-panel__title">
          <Eye size={16} weight="bold" /> Attention
        </span>
        <IconButton size={32} variant="ghost" aria-label="Close" onClick={onClose}>
          <X size={16} />
        </IconButton>
      </header>

      {/* WHAT KIND of target. One glyph per state, same symbols as the line. */}
      <div className="prop-panel__section">
        <span className="prop-panel__label">The eye is on</span>
        <div className="prop-panel__kinds">
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              className="prop-panel__kind"
              data-picked={mark.kind === k.id || undefined}
              aria-pressed={mark.kind === k.id}
              title={k.hint}
              onClick={() => onSetKind(k.id)}
            >
              <span className="prop-panel__kind-glyph" data-kind={k.id}>
                {k.glyph}
              </span>
              {k.label}
            </button>
          ))}
        </div>
      </div>

      {/* WHICH target — the second half of the choice. */}
      {mark.kind === 'object' && (
        <div className="prop-panel__section" onMouseLeave={() => onPeekSubject(null)}>
          <span className="prop-panel__label">Subject — on screen at {formatClock(mark.t)}</span>
          <div className="prop-panel__objects">
            {present.map((s) => (
              <button
                key={s.id}
                type="button"
                className="prop-panel__object"
                data-picked={s.id === mark.subjectId || undefined}
                aria-pressed={s.id === mark.subjectId}
                onMouseEnter={() => onPeekSubject(s.id)}
                onClick={() => onSetSubject(s.id)}
              >
                <span className="prop-panel__object-label">{s.label}</span>
                <span className="prop-panel__object-kind">{s.kind}</span>
              </button>
            ))}
          </div>
          <p className="prop-panel__note">Or click a box on the video — same choice.</p>
        </div>
      )}

      {mark.kind === 'area' && (
        <div className="prop-panel__section">
          {drawing ? (
            <p className="prop-panel__note prop-panel__note--live">
              Draw on the video: drag from the centre of the area outward. Everything outside
              stays frosted. Esc cancels.
            </p>
          ) : mark.area ? (
            <>
              <div className="prop-panel__field">
                <span className="prop-panel__label">Area</span>
                <div className="prop-panel__arearow">
                  <input
                    className="prop-panel__input"
                    type="text"
                    value={mark.areaLabel ?? ''}
                    aria-label="Area label"
                    onChange={(e) => onSetArea(e.target.value)}
                  />
                  <IconButton size={32} variant="ghost" aria-label="Redraw the area" onClick={onRedrawArea}>
                    <PencilSimple size={16} />
                  </IconButton>
                </div>
              </div>
              <p className="prop-panel__note">
                A soft region of the frame — the eye stays here, no detection needed. Redraw with
                the pencil.
              </p>
            </>
          ) : (
            <button className="prop-panel__add" type="button" onClick={onRedrawArea}>
              Draw the area on the video
            </button>
          )}
        </div>
      )}

      {mark.kind === 'none' && (
        <div className="prop-panel__section">
          <p className="prop-panel__note">
            No preference from here — the eye goes wherever the frame sends it, and the line greys
            until the next mark.
          </p>
        </div>
      )}

      {/* WHEN it holds. Both edges belong to marks; drag them on the line. */}
      <div className="prop-panel__section">
        <div className="prop-panel__fields">
          <div className="prop-panel__field">
            <span className="prop-panel__label">From</span>
            <span className="prop-panel__readout">{formatClock(run.start)}</span>
          </div>
          <div className="prop-panel__field">
            <span className="prop-panel__label">Until</span>
            <span className="prop-panel__readout">{formatClock(run.end)}</span>
          </div>
        </div>
        <p className="prop-panel__note">Drag the glyphs on the line to move the boundaries.</p>
      </div>

      <div className="prop-panel__section prop-panel__section--actions">
        <span className="prop-panel__note">
          {pinned ? 'The opening mark can be retargeted but not removed.' : 'Remove this mark — the previous state extends.'}
        </span>
        {!pinned && (
          <IconButton size={32} variant="ghost" aria-label="Delete this mark" onClick={onRemove}>
            <Trash size={16} />
          </IconButton>
        )}
      </div>
    </aside>
  );
}
