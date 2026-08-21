import { useEffect, useRef, useState } from 'react';
import { CaretDown, Plus, Trash, X } from '@phosphor-icons/react';
import { InteractionOrbit, ScriptScroll } from '../../../assets/icons';
import { IconButton } from '../../../ui/IconButton';
import { MIN_CLIP_SEC, clipText, formatClock } from '../data';
import type { AvatarColor, AvatarRow, Interaction, ScriptClip } from '../data';
import { TextField, TimeField } from './PanelFields';

/**
 * The script instrument's inspector, in the family style: the line itself,
 * its window, and the reactions it triggers — the same objects as the emoji
 * chips on the timeline, whoever performs them. Editing the line re-spreads
 * its per-word timings, so the playback highlight never drifts.
 */
export function ScriptPanel({
  clip,
  speaker,
  color,
  triggered,
  rows,
  onClose,
  onEdit,
  onRetime,
  onAddInteraction,
  onSelectInteraction,
  onRemove,
}: {
  clip: ScriptClip;
  speaker: string;
  /** The speaker's track colour — the title chip wears it, so attribution
   *  reads in the same language as the timeline. */
  color: AvatarColor;
  /** Reactions whose trigger is this clip, with the row that performs each. */
  triggered: { row: AvatarRow; it: Interaction }[];
  rows: AvatarRow[];
  onClose: () => void;
  onEdit: (text: string) => void;
  onRetime: (edge: 'start' | 'end', seconds: number) => void;
  onAddInteraction: (rowId: string) => void;
  onSelectInteraction: (id: string) => void;
  onRemove: () => void;
}) {
  const [interactionsOpen, setInteractionsOpen] = useState(true);
  const [castOpen, setCastOpen] = useState(false);
  const castRef = useRef<HTMLDivElement | null>(null);

  /* The cast menu closes on any outside press or Escape. */
  useEffect(() => {
    if (!castOpen) return;
    const onDown = (e: PointerEvent) => {
      if (castRef.current && !castRef.current.contains(e.target as Node)) setCastOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCastOpen(false);
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [castOpen]);

  return (
    <aside className="prop-panel prop-panel--attn prop-panel--ix" aria-label="Script">
      <div className="cam-page">
        <header className="prop-panel__header">
          <span className="prop-panel__title">
            <ScriptScroll size={20} /> Script
            <span className={`prop-panel__chip prop-panel__chip--${color}`}>{speaker}</span>
          </span>
          <IconButton size={32} variant="ghost" className="prop-panel__hbtn" aria-label="Close" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </header>

        {/* The line itself. Commits on blur or ⌘/Ctrl+Enter. */}
        <div className="prop-panel__section">
          <TextField value={clipText(clip)} ariaLabel="Spoken line" onCommit={onEdit} />
        </div>

        <div className="prop-panel__section">
          <div className="prop-panel__fields">
            <TimeField
              label="Start time"
              value={clip.start}
              max={clip.end - MIN_CLIP_SEC}
              onCommit={(v) => onRetime('start', v)}
            />
            <TimeField
              label="End time"
              value={clip.end}
              min={clip.start + MIN_CLIP_SEC}
              onCommit={(v) => onRetime('end', v)}
            />
          </div>
        </div>

        {/* Reactions triggered by this line — the connector relationships. */}
        <button
          type="button"
          className="sx-groupheader"
          aria-expanded={interactionsOpen}
          onClick={() => setInteractionsOpen((v) => !v)}
        >
          <span className="prop-panel__title">
            <InteractionOrbit size={20} /> Interactions
          </span>
          <CaretDown size={16} className="sx-groupheader__chevron" data-open={interactionsOpen || undefined} />
        </button>

        {interactionsOpen && (
          <div className="prop-panel__section sx-reactions">
            {/* Add a reaction to this line — the menu carries the cast. */}
            <div className="attn-select-wrap" ref={castRef}>
              {/* `rows` arrives pre-filtered to the cast with lane room at this
                  line's moment; nobody free means nothing to offer. */}
              <button
                type="button"
                className="attn-delete"
                aria-expanded={castOpen}
                disabled={!rows.length}
                title={rows.length ? undefined : 'No room on any reaction lane at this moment'}
                onClick={() => setCastOpen((v) => !v)}
              >
                <Plus size={16} />
                Reaction
              </button>
              {castOpen && (
                <div className="attn-menu attn-menu--fit" role="listbox" aria-label="Who reacts">
                  {rows.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      role="option"
                      className="attn-menu__item"
                      onClick={() => {
                        setCastOpen(false);
                        onAddInteraction(row.id);
                      }}
                    >
                      <img className="ix-avatar" src={row.avatar} alt="" width={20} height={20} />
                      {row.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {triggered.map(({ row, it }) => (
              <button
                key={it.id}
                type="button"
                className="sx-reaction"
                onClick={() => onSelectInteraction(it.id)}
              >
                <span className="prop-panel__chip">{formatClock(it.start)}</span>
                <span className={`prop-panel__chip prop-panel__chip--${row.color}`}>{row.name}</span>
                <span className="sx-reaction__gesture">
                  {it.emoji} <span className="sx-reaction__label">{it.label}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="prop-panel__section">
          <button type="button" className="attn-delete" onClick={onRemove}>
            <Trash size={16} />
            Delete
          </button>
        </div>
      </div>
    </aside>
  );
}

/**
 * The Script inspector's DRAFT posture: the same surface, opened the instant a
 * blank track is spawned (Figma 758-167324). The textarea takes focus at once
 * and the track holds a quiet "Type" ghost while you write; Enter commits the
 * line onto the track, Escape (or the X) throws the draft away. Start is
 * already real and editable — End reads as Start until the words size the
 * window.
 */
export function ScriptDraftPanel({
  speaker,
  color,
  start,
  maxStart,
  text,
  onChangeText,
  onRetimeStart,
  onCommit,
  onCancel,
}: {
  speaker: string;
  color: AvatarColor;
  start: number;
  /** Latest the line can begin — the take's end less one minimum clip. */
  maxStart: number;
  text: string;
  onChangeText: (text: string) => void;
  onRetimeStart: (seconds: number) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  const areaRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => areaRef.current?.focus(), []);

  return (
    <aside className="prop-panel prop-panel--attn prop-panel--ix" aria-label="Script">
      <div className="cam-page">
        <header className="prop-panel__header">
          <span className="prop-panel__title">
            <ScriptScroll size={20} /> Script
            <span className={`prop-panel__chip prop-panel__chip--${color}`}>{speaker}</span>
          </span>
          <IconButton size={32} variant="ghost" className="prop-panel__hbtn" aria-label="Close" onClick={onCancel}>
            <X size={16} />
          </IconButton>
        </header>

        {/* Held as draft state so Enter can commit the whole line at once. */}
        <div className="prop-panel__section">
          <textarea
            ref={areaRef}
            className="prop-panel__textarea"
            aria-label="Spoken line"
            placeholder={`Write what you want ${speaker} to say...`}
            rows={3}
            value={text}
            onChange={(e) => onChangeText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onCommit();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                onCancel();
              }
            }}
          />
        </div>

        <div className="prop-panel__section">
          <div className="prop-panel__fields">
            <TimeField
              label="Start time"
              value={start}
              max={maxStart}
              onCommit={onRetimeStart}
            />
            <TimeField label="End time" value={start} disabled onCommit={() => {}} />
          </div>
        </div>

        {/* Present so the surface reads as the same panel, armed on commit —
            a reaction needs a line to point at. */}
        <button type="button" className="sx-groupheader" aria-expanded onClick={() => {}}>
          <span className="prop-panel__title">
            <InteractionOrbit size={20} /> Interactions
          </span>
          <CaretDown size={16} className="sx-groupheader__chevron" data-open />
        </button>
        <div className="prop-panel__section sx-reactions">
          <button type="button" className="attn-delete" disabled>
            <Plus size={16} />
            Reaction
          </button>
        </div>
      </div>
    </aside>
  );
}
