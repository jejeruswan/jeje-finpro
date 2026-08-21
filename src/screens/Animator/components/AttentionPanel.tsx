import { useEffect, useRef, useState } from 'react';
import { CaretDown, PencilSimple, Trash, X } from '@phosphor-icons/react';
import { AttentionEye, MarkGlyph } from '../../../assets/icons';
import { IconButton } from '../../../ui/IconButton';
import { subjectsAt } from '../data';
import type { AttentionKind, AttentionRun } from '../data';
import { TimeField } from './PanelFields';

const KINDS: { id: AttentionKind; label: string; hint: string }[] = [
  { id: 'object', label: 'Object', hint: 'a subject from the frame' },
  { id: 'area', label: 'Area', hint: 'a region you draw on the frame' },
  { id: 'none', label: 'None', hint: 'no preference — the line greys' },
];

/**
 * Inspector for one attention mark and the run it starts.
 *
 * The kind row breathes: a fresh mark opens with all three kinds laid out as
 * chips, and picking one collapses the row to a compact kind-dropdown beside
 * that kind's target control — clicking the dropdown unfolds the chips again.
 * One row, two postures; the dropdown IS the collapsed chips.
 *
 * Picking OBJECT opens a list of what is actually on screen at that moment
 * (hovering a row lights its box on the canvas; clicking a box on the canvas
 * picks it here — same choice, two surfaces). Picking AREA hands you the
 * stage itself: a draw mode where everything outside your drag frosts over.
 */
export function AttentionPanel({
  run,
  pinned,
  fresh = false,
  drawing,
  onClose,
  onSetKind,
  onSetSubject,
  onPeekSubject,
  onSetArea,
  onRedrawArea,
  onRetimeStart,
  onRetimeEnd,
  onRemove,
}: {
  run: AttentionRun;
  /** The origin mark — retargetable, never deletable. */
  pinned: boolean;
  /** Just dropped on the line: open with the kind chips unfolded. */
  fresh?: boolean;
  /** True while the stage's area draw mode is armed for this mark. */
  drawing: boolean;
  onClose: () => void;
  onSetKind: (kind: AttentionKind) => void;
  onSetSubject: (subjectId: string) => void;
  onPeekSubject: (subjectId: string | null) => void;
  onSetArea: (label: string) => void;
  onRedrawArea: () => void;
  /** Move this mark (the run's start). Absent when the mark is pinned. */
  onRetimeStart?: (seconds: number) => void;
  /** Move the NEXT mark (this run's end). Absent on the last run. */
  onRetimeEnd?: (seconds: number) => void;
  onRemove: () => void;
}) {
  const { mark } = run;
  // Legal object targets: what is actually on screen when this state begins.
  const present = subjectsAt(mark.t);
  const subject = present.find((s) => s.id === mark.subjectId);

  /** Kind row posture. Fresh marks open unfolded; the caller keys this panel
   *  by mark id, so each mark gets its own posture. */
  const [unfolded, setUnfolded] = useState(fresh);
  /** A fresh mark inherits its kind from the previous one, but that is an
   *  accident of contiguity, not an answer — so the segmented control shows
   *  NO selection until the user commits one. */
  const [virgin, setVirgin] = useState(fresh);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  const pickKind = (kind: AttentionKind) => {
    setUnfolded(false);
    setVirgin(false);
    onSetKind(kind);
    // The second half of the choice comes to you: picking Object offers the
    // targets; picking Area arms the stage (the host handles that side).
    setPickerOpen(kind === 'object');
  };

  /* The subject list floats over whatever is below the panel — close it on any
     press outside, and on Escape. */
  useEffect(() => {
    if (!pickerOpen) return;
    const onDown = (e: PointerEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
        onPeekSubject(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPickerOpen(false);
        onPeekSubject(null);
      }
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [pickerOpen, onPeekSubject]);

  return (
    <aside className="prop-panel prop-panel--attn" aria-label="Attention">
      <header className="prop-panel__header">
        <span className="prop-panel__title">
          <AttentionEye size={20} /> Attention
        </span>
        <IconButton size={32} variant="ghost" className="prop-panel__hbtn" aria-label="Close" onClick={onClose}>
          <X size={16} />
        </IconButton>
      </header>

      {/* WHERE the eye goes — "Position". Unfolded: one segmented control
          asking the question. Collapsed: the picked kind as a dropdown,
          beside that kind's target control. */}
      <div className="prop-panel__section attn-kindrow">
        <span className="prop-panel__label">Position</span>
        {unfolded ? (
          <div className="attn-seg" key="segments" role="radiogroup" aria-label="Position">
            {KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                className="attn-seg__opt"
                role="radio"
                aria-checked={!virgin && mark.kind === k.id}
                data-picked={(!virgin && mark.kind === k.id) || undefined}
                onClick={() => pickKind(k.id)}
              >
                <span className="attn-seg__box">
                  <span className="attn-glyph">
                    <MarkGlyph kind={k.id} />
                  </span>
                </span>
                <span className="attn-seg__caption">{k.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="attn-row" key="collapsed">
            <button
              type="button"
              className="attn-select"
              aria-label="Change what the eye is on"
              onClick={() => {
                setPickerOpen(false);
                setUnfolded(true);
              }}
            >
              <span className="attn-select__value">
                <span className="attn-glyph">
                  <MarkGlyph kind={mark.kind} />
                </span>
                {KINDS.find((k) => k.id === mark.kind)?.label}
              </span>
              <CaretDown size={16} className="attn-select__caret" />
            </button>

            {mark.kind === 'object' && (
              <div className="attn-select-wrap" ref={pickerRef}>
                <button
                  type="button"
                  className="attn-select"
                  aria-expanded={pickerOpen}
                  onClick={() => setPickerOpen((v) => !v)}
                >
                  <span className="attn-select__value" data-placeholder={!subject || undefined}>
                    {subject?.label ?? 'Select object'}
                  </span>
                  <CaretDown size={16} className="attn-select__caret" />
                </button>
                {pickerOpen && (
                  <div className="attn-menu" role="listbox" aria-label="Objects on screen" onMouseLeave={() => onPeekSubject(null)}>
                    {present.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        role="option"
                        className="attn-menu__item"
                        aria-selected={s.id === mark.subjectId}
                        data-picked={s.id === mark.subjectId || undefined}
                        onMouseEnter={() => onPeekSubject(s.id)}
                        onClick={() => {
                          onSetSubject(s.id);
                          setPickerOpen(false);
                          onPeekSubject(null);
                        }}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {mark.kind === 'area' &&
              (drawing ? (
                <span className="attn-select attn-select--live">Draw on video…</span>
              ) : mark.area ? (
                <span className="attn-field">
                  <input
                    className="attn-field__input"
                    type="text"
                    value={mark.areaLabel ?? ''}
                    aria-label="Area label"
                    onChange={(e) => onSetArea(e.target.value)}
                  />
                  <IconButton size={24} variant="ghost" aria-label="Redraw the area" onClick={onRedrawArea}>
                    <PencilSimple size={14} />
                  </IconButton>
                </span>
              ) : (
                <button type="button" className="attn-select" onClick={onRedrawArea}>
                  <span className="attn-select__value" data-placeholder>
                    Select area
                  </span>
                </button>
              ))}
          </div>
        )}
      </div>

      {/* WHEN it holds. The start is this mark; the end belongs to the next
          one, so editing it moves that mark — same rule as dragging glyphs. */}
      <div className="prop-panel__section">
        <div className="prop-panel__fields">
          <TimeField
            label="Start time"
            value={run.start}
            disabled={!onRetimeStart}
            onCommit={(sec) => onRetimeStart?.(sec)}
          />
          <TimeField
            label="End time"
            value={run.end}
            disabled={!onRetimeEnd}
            onCommit={(sec) => onRetimeEnd?.(sec)}
          />
        </div>
      </div>

      {/* Delete lives at the bottom, full width — the origin mark can be
          retargeted but never removed, so it gets no delete row at all. */}
      {!pinned && (
        <div className="prop-panel__section">
          <button type="button" className="attn-delete" onClick={onRemove}>
            <Trash size={16} />
            Delete
          </button>
        </div>
      )}
    </aside>
  );
}
