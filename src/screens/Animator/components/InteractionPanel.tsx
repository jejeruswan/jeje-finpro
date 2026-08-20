import { Trash, X } from '@phosphor-icons/react';
import { IconButton } from '../../../ui/IconButton';
import { InteractionNode } from '../../../assets/icons';
import { EMOJI_CHOICES, MIN_CLIP_SEC, clipText } from '../data';
import type { AvatarRow, Interaction, ScriptClip } from '../data';
import { TimeField } from './PanelFields';

/**
 * The gesture instrument's inspector — fully editable.
 *
 * A reaction has two owners and the panel makes both explicit: the ACTOR is the
 * avatar whose lane it sits on, and the TRIGGER is the line it reacts to, which
 * is usually someone else's. Re-parenting the trigger here is the same edit as
 * dragging the connector line on the timeline.
 */
export function InteractionPanel({
  it,
  actor,
  scripts,
  onClose,
  onSetEmoji,
  onRetime,
  onSetTrigger,
  onRemove,
}: {
  it: Interaction;
  actor: AvatarRow;
  /** Every script clip, with the row that speaks it, as trigger candidates. */
  scripts: { row: AvatarRow; clip: ScriptClip }[];
  onClose: () => void;
  onSetEmoji: (emoji: string, label: string) => void;
  onRetime: (edge: 'start' | 'end', seconds: number) => void;
  onSetTrigger: (triggerId: string | undefined) => void;
  onRemove: () => void;
}) {
  return (
    <aside className="prop-panel" aria-label="Interaction">
      <header className="prop-panel__header">
        <span className="prop-panel__title">Interaction</span>
        <IconButton size={32} variant="ghost" aria-label="Close" onClick={onClose}>
          <X size={16} />
        </IconButton>
      </header>

      <div className="prop-panel__row">
        <InteractionNode size={20} className="prop-panel__row-icon" />
        <span className="prop-panel__emoji">{it.emoji}</span>
        <span className="prop-panel__tag">{it.label}</span>
        <span className={`prop-panel__chip prop-panel__chip--${actor.color}`}>{actor.name}</span>
      </div>

      {/* Which gesture. Emoji is the vocabulary — kept, per the design. */}
      <div className="prop-panel__section">
        <span className="prop-panel__label">Gesture</span>
        <div className="prop-panel__emojigrid">
          {EMOJI_CHOICES.map((c) => (
            <button
              key={c.label}
              type="button"
              className="prop-panel__emojibtn"
              data-picked={c.emoji === it.emoji || undefined}
              aria-pressed={c.emoji === it.emoji}
              aria-label={c.label}
              title={c.label}
              onClick={() => onSetEmoji(c.emoji, c.label)}
            >
              {c.emoji}
            </button>
          ))}
        </div>
      </div>

      <div className="prop-panel__section">
        <div className="prop-panel__fields">
          <TimeField
            label="From"
            value={it.start}
            max={it.end - MIN_CLIP_SEC}
            onCommit={(v) => onRetime('start', v)}
          />
          <TimeField
            label="To"
            value={it.end}
            min={it.start + MIN_CLIP_SEC}
            onCommit={(v) => onRetime('end', v)}
          />
        </div>
      </div>

      {/* The relationship the connector line draws. */}
      <div className="prop-panel__section">
        <div className="prop-panel__field">
          <span className="prop-panel__label">Reacting to</span>
          <select
            className="prop-panel__select"
            value={it.triggerId ?? ''}
            aria-label="The line this reaction responds to"
            onChange={(e) => onSetTrigger(e.target.value || undefined)}
          >
            <option value="">Nothing — stands alone</option>
            {scripts.map(({ row, clip }) => (
              <option key={clip.id} value={clip.id}>
                {row.name}: {clipText(clip).slice(0, 32)}
                {clipText(clip).length > 32 ? '…' : ''}
              </option>
            ))}
          </select>
        </div>
        <p className="prop-panel__note">
          Draws the connector on the timeline. {actor.name} performs it; whoever
          is speaking triggers it.
        </p>
      </div>

      <div className="prop-panel__section prop-panel__section--actions">
        <span className="prop-panel__note">Remove this reaction</span>
        <IconButton size={32} variant="ghost" aria-label="Delete this reaction" onClick={onRemove}>
          <Trash size={16} />
        </IconButton>
      </div>
    </aside>
  );
}
