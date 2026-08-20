import { ChatText, Plus, Trash, X } from '@phosphor-icons/react';
import { IconButton } from '../../../ui/IconButton';
import { MIN_CLIP_SEC, clipText, formatClock } from '../data';
import type { AvatarRow, Interaction, ScriptClip } from '../data';
import { TextField, TimeField } from './PanelFields';

/**
 * The script instrument's inspector — fully editable.
 *
 * Editing the line re-spreads its per-word timings across the clip's window, so
 * the playback highlight stays exactly in step with the new text. Retiming does
 * the same, which is why a trimmed clip never drifts out of sync.
 *
 * The interactions listed here are the SAME objects as the emoji chips on the
 * timeline — this panel shows the reactions triggered by this line, whoever
 * performs them. Adding one from here creates the chip on that avatar's lane and
 * draws the connector back to this clip; removing one deletes the chip.
 */
export function ScriptPanel({
  clip,
  speaker,
  triggered,
  rows,
  onClose,
  onEdit,
  onRetime,
  onAddInteraction,
  onRemoveInteraction,
  onSelectInteraction,
}: {
  clip: ScriptClip;
  speaker: string;
  /** Reactions whose trigger is this clip, with the row that performs each. */
  triggered: { row: AvatarRow; it: Interaction }[];
  rows: AvatarRow[];
  onClose: () => void;
  onEdit: (text: string) => void;
  onRetime: (edge: 'start' | 'end', seconds: number) => void;
  onAddInteraction: (rowId: string) => void;
  onRemoveInteraction: (id: string) => void;
  onSelectInteraction: (id: string) => void;
}) {
  return (
    <aside className="prop-panel" aria-label="Script">
      <header className="prop-panel__header">
        <span className="prop-panel__title">Script</span>
        <IconButton size={32} variant="ghost" aria-label="Close" onClick={onClose}>
          <X size={16} />
        </IconButton>
      </header>

      <div className="prop-panel__row">
        <ChatText size={20} className="prop-panel__row-icon" />
        <span className="prop-panel__row-title">{speaker}</span>
        <span className="prop-panel__chip">
          {formatClock(clip.start)}–{formatClock(clip.end)}
        </span>
      </div>

      {/* The line itself. Commits on blur or ⌘/Ctrl+Enter. */}
      <div className="prop-panel__section">
        <span className="prop-panel__label">Line</span>
        <TextField value={clipText(clip)} ariaLabel="Spoken line" onCommit={onEdit} />
        <p className="prop-panel__note">
          {clip.words
            ? `${clip.words.length} words, timed across the clip — editing re-syncs them.`
            : 'A marker clip — no per-word timing.'}
        </p>
      </div>

      <div className="prop-panel__section">
        <div className="prop-panel__fields">
          <TimeField
            label="From"
            value={clip.start}
            max={clip.end - MIN_CLIP_SEC}
            onCommit={(v) => onRetime('start', v)}
          />
          <TimeField
            label="To"
            value={clip.end}
            min={clip.start + MIN_CLIP_SEC}
            onCommit={(v) => onRetime('end', v)}
          />
        </div>
      </div>

      {/* Reactions triggered by this line — the same chips as on the timeline. */}
      <div className="prop-panel__section">
        <span className="prop-panel__label">Reactions to this line</span>
        <div className="prop-panel__list">
          {triggered.map(({ row, it }) => (
            <div className="prop-panel__listrow" key={it.id}>
              <span className="prop-panel__chip">{formatClock(it.start)}</span>
              <span className={`prop-panel__chip prop-panel__chip--${row.color}`}>{row.name}</span>
              <button
                type="button"
                className="prop-panel__listrow-label prop-panel__listrow-label--button"
                onClick={() => onSelectInteraction(it.id)}
                title="Select this reaction on the timeline"
              >
                {it.emoji} {it.label}
              </button>
              <IconButton
                size={24}
                variant="ghost"
                aria-label={`Remove ${row.name}'s ${it.label}`}
                onClick={() => onRemoveInteraction(it.id)}
              >
                <Trash size={14} />
              </IconButton>
            </div>
          ))}
          {!triggered.length && (
            <p className="prop-panel__note">Nothing reacts to this line yet.</p>
          )}
        </div>

        {/* Add a reaction attributed to this line, on any avatar's lane. */}
        <div className="prop-panel__addrow">
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              className="prop-panel__add prop-panel__add--compact"
              onClick={() => onAddInteraction(row.id)}
              title={`Add a reaction from ${row.name} to this line`}
            >
              <Plus size={14} weight="bold" />
              {row.name}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
