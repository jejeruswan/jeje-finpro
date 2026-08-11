import { useState } from 'react';
import { Eye, CaretDown, PencilSimple, Plus, X } from '@phosphor-icons/react';
import { IconButton } from '../../../ui/IconButton';
import type { ScriptChip } from '../data';

/**
 * Floating right-hand inspector for a selected script clip. Shows the spoken
 * line, its start / end times and the interactions that fire while it plays.
 * Shares the property-panel shell (`.prop-panel__*`) with `ShotStylePanel`, so
 * the two inspectors read as one surface swapping contents.
 */
export function ScriptPanel({ chip, onClose }: { chip: ScriptChip; onClose: () => void }) {
  const [interactionsExpanded, setInteractionsExpanded] = useState(true);

  // Short chips carry a `label`; full lines are stored per word so the timeline
  // can highlight them individually during playback.
  const line = chip.label ?? chip.words?.join(' ') ?? '';

  return (
    <aside className="prop-panel" aria-label="Script">
      <header className="prop-panel__header">
        <span className="prop-panel__title">Script</span>
        <IconButton size={32} variant="ghost" aria-label="Close" onClick={onClose}>
          <X size={16} />
        </IconButton>
      </header>

      {/* The spoken line, with an explicit edit affordance */}
      <div className="prop-panel__section">
        <div className="prop-panel__textfield">
          <span className="prop-panel__textfield-text">{line}</span>
          <IconButton size={32} variant="ghost" aria-label="Edit script">
            <PencilSimple size={18} />
          </IconButton>
        </div>
      </div>

      {/* Start / End timestamps. Keyed by clip so switching selection resets the
          inputs to the newly selected clip's times. */}
      <div className="prop-panel__section">
        <div className="prop-panel__fields">
          <label className="prop-panel__field">
            <span className="prop-panel__label">Start</span>
            <input
              className="prop-panel__input"
              type="text"
              defaultValue={chip.start}
              key={`${chip.id}-start`}
            />
          </label>
          <label className="prop-panel__field">
            <span className="prop-panel__label">End</span>
            <input
              className="prop-panel__input"
              type="text"
              defaultValue={chip.end}
              key={`${chip.id}-end`}
            />
          </label>
        </div>
      </div>

      {/* Interactions — collapsible group wrapping the add control and the rows,
          so collapsing it hides them together. */}
      <div
        className="prop-panel__collapsible prop-panel__collapsible--divided"
        data-expanded={interactionsExpanded || undefined}
      >
        <button
          className="prop-panel__row prop-panel__row--button"
          type="button"
          aria-expanded={interactionsExpanded}
          onClick={() => setInteractionsExpanded((v) => !v)}
        >
          <Eye size={20} className="prop-panel__row-icon" />
          <span className="prop-panel__row-title">Interactions</span>
          <CaretDown size={18} className="prop-panel__row-icon prop-panel__chevron" />
        </button>
        {interactionsExpanded && (
          <div className="prop-panel__collapsible-body">
            <button className="prop-panel__add" type="button">
              <Plus size={16} weight="bold" />
              Add an interaction
            </button>

            {chip.interactions.map((it) => (
              <div className="prop-panel__listrow" key={it.id}>
                <span className="prop-panel__chip">{it.time}</span>
                <span className={`prop-panel__chip prop-panel__chip--${it.color}`}>
                  {it.speaker}
                </span>
                <span className="prop-panel__listrow-label">{it.action}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
