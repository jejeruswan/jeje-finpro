import { Trash, UserFocus, X } from '@phosphor-icons/react';
import { IconButton } from '../../../ui/IconButton';
import { MIN_PRESENCE_SEC } from '../data';
import type { PresenceEntity, PresenceRun } from '../data';
import type { PresenceEdge } from '../usePresence';
import { TimeField } from './PanelFields';

const fmtSecs = (s: number) => {
  const r = Math.round(s * 10) / 10;
  return `${Number.isInteger(r) ? r : r.toFixed(1)}s`;
};

/**
 * Inspector for one presence run: when the subject enters and leaves frame,
 * both edges free-trimming (a presence gap is absence, not a shared seam),
 * plus the quiet screen-time fact and delete. Same surface as the other
 * inspectors, so the lens reads as part of the family.
 */
export function PresencePanel({
  entity,
  run,
  duration,
  onClose,
  onRetime,
  onRemove,
}: {
  entity: PresenceEntity;
  run: PresenceRun;
  duration: number;
  onClose: () => void;
  onRetime: (edge: PresenceEdge, seconds: number) => void;
  onRemove: () => void;
}) {
  const i = entity.runs.findIndex((r) => r.id === run.id);
  const prev = entity.runs[i - 1];
  const next = entity.runs[i + 1];
  const total = entity.runs.reduce((t, r) => t + (r.end - r.start), 0);
  const share = Math.round((total / duration) * 100);

  return (
    <aside className="prop-panel prop-panel--attn" aria-label="Presence">
      <header className="prop-panel__header">
        <span className="prop-panel__title">
          <UserFocus size={20} /> Presence
          <span className="prop-panel__chip">{entity.label}</span>
        </span>
        <IconButton
          size={32}
          variant="ghost"
          className="prop-panel__hbtn"
          aria-label="Close"
          onClick={onClose}
        >
          <X size={16} />
        </IconButton>
      </header>

      <div className="prop-panel__section">
        <div className="prop-panel__fields">
          <TimeField
            label="Enters"
            value={run.start}
            min={prev ? prev.end + MIN_PRESENCE_SEC : 0}
            max={run.end - MIN_PRESENCE_SEC}
            onCommit={(sec) => onRetime('start', sec)}
          />
          <TimeField
            label="Exits"
            value={run.end}
            min={run.start + MIN_PRESENCE_SEC}
            max={next ? next.start - MIN_PRESENCE_SEC : duration}
            onCommit={(sec) => onRetime('end', sec)}
          />
        </div>
      </div>

      {/* Screen time is a fact, not a headline — seconds first, share muted. */}
      <div className="prop-panel__section">
        <p className="presence-stat">
          On screen {fmtSecs(total)} of {fmtSecs(duration)}
          <span className="presence-stat__share"> · {share}%</span>
        </p>
      </div>

      <div className="prop-panel__section">
        <button type="button" className="attn-delete" onClick={onRemove}>
          <Trash size={16} />
          Delete
        </button>
      </div>
    </aside>
  );
}
