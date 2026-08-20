import { useState } from 'react';
import { formatClock, parseClock } from '../data';
import { useNumberScrub } from '../useNumberScrub';

/**
 * A timestamp field you can either type into or scrub, shared by every
 * inspector on this screen so all four read as one surface.
 *
 * The label and the two edge strips are scrub zones (`ew-resize`); the middle of
 * the box stays a plain text input with an I-beam, so manual entry is untouched.
 * While typing, a local draft shadows the value so a half-finished "0:1" isn't
 * parsed and clamped out from under the caret — Enter and blur commit, Escape
 * throws it away.
 */
export function TimeField({
  label,
  value,
  min = 0,
  max = Infinity,
  disabled,
  onCommit,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  onCommit: (seconds: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  // `getValue` reads the committed prop, so each scrub starts from where the
  // last one actually landed after clamping.
  const scrub = useNumberScrub({ getValue: () => value, onChange: onCommit, min, max });

  const commit = () => {
    if (draft === null) return;
    const parsed = parseClock(draft);
    if (parsed !== null) onCommit(Math.min(max, Math.max(min, parsed)));
    setDraft(null);
  };

  return (
    <div className="prop-panel__field">
      <span
        className={`prop-panel__label ${disabled ? '' : 'prop-panel__label--scrub'}`}
        {...(disabled ? {} : scrub)}
      >
        {label}
      </span>
      <div className="prop-panel__input-wrap">
        {!disabled && <span className="prop-panel__scrub" data-edge="left" aria-hidden {...scrub} />}
        <input
          className="prop-panel__input"
          type="text"
          inputMode="numeric"
          disabled={disabled}
          value={draft ?? formatClock(value)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
              e.currentTarget.blur();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              setDraft(null);
              e.currentTarget.blur();
            }
          }}
        />
        {!disabled && (
          <span className="prop-panel__scrub" data-edge="right" aria-hidden {...scrub} />
        )}
      </div>
    </div>
  );
}

/**
 * An editable multi-line text block — the spoken line in the Script inspector.
 * Commits on blur or ⌘/Ctrl+Enter; Escape reverts.
 */
export function TextField({
  value,
  ariaLabel,
  onCommit,
}: {
  value: string;
  ariaLabel: string;
  onCommit: (text: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <textarea
      className="prop-panel__textarea"
      aria-label={ariaLabel}
      rows={3}
      value={draft ?? value}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== null && draft.trim()) onCommit(draft);
        setDraft(null);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          e.currentTarget.blur();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setDraft(null);
          e.currentTarget.blur();
        }
      }}
    />
  );
}
