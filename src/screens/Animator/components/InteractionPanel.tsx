import { PencilSimple, X } from '@phosphor-icons/react';
import { IconButton } from '../../../ui/IconButton';
import { InteractionNode } from '../../../assets/icons';
import type { Interaction } from '../data';

/**
 * Floating right-hand inspector for a selected emoji reaction — opened by the
 * chip itself or by the connector line running into it. Shows which reaction it
 * is (glyph, emoji and shortcode) and the window it plays over.
 *
 * Shares the property-panel shell (`.prop-panel__*`) with `ShotStylePanel` and
 * `ScriptPanel`, so all three inspectors read as one surface swapping contents.
 */
export function InteractionPanel({
  interaction,
  onClose,
}: {
  interaction: Interaction;
  onClose: () => void;
}) {
  return (
    <aside className="prop-panel" aria-label="Interaction">
      <header className="prop-panel__header">
        <span className="prop-panel__title">Interaction</span>
        <IconButton size={32} variant="ghost" aria-label="Close" onClick={onClose}>
          <X size={16} />
        </IconButton>
      </header>

      {/* Reaction identity: the node glyph, the emoji as rendered on the track,
          and its shortcode as a tag. The tag takes the row's slack so the edit
          control stays pinned right, the way the other panels' rows do. */}
      <div className="prop-panel__row">
        <InteractionNode size={20} className="prop-panel__row-icon" />
        <span className="prop-panel__emoji">{interaction.emoji}</span>
        <span className="prop-panel__tag">{interaction.label}</span>
        <IconButton size={32} variant="ghost" aria-label="Edit interaction">
          <PencilSimple size={18} />
        </IconButton>
      </div>

      {/* Start / End timestamps. Keyed by reaction so switching selection resets
          the inputs to the newly selected one's times. */}
      <div className="prop-panel__section">
        <div className="prop-panel__fields">
          <label className="prop-panel__field">
            <span className="prop-panel__label">Start</span>
            <input
              className="prop-panel__input"
              type="text"
              defaultValue={interaction.start}
              key={`${interaction.id}-start`}
            />
          </label>
          <label className="prop-panel__field">
            <span className="prop-panel__label">End</span>
            <input
              className="prop-panel__input"
              type="text"
              defaultValue={interaction.end}
              key={`${interaction.id}-end`}
            />
          </label>
        </div>
      </div>
    </aside>
  );
}
