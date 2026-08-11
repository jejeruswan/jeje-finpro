import { useEffect, useId, useRef, useState } from 'react';
import { Target, PencilSimple, Eye, CaretDown, Plus, Trash, X } from '@phosphor-icons/react';
import { IconButton } from '../../../ui/IconButton';
import { useNumberScrub } from '../useNumberScrub';
import {
  FOCUS_TARGETS,
  MIN_SHOT_SEC,
  SHOT_PRESETS,
  SPEAKERS,
  formatClock,
  parseClock,
} from '../data';
import type { Focus, Scene, ShotPreset } from '../data';

/**
 * A timestamp field you can either type into or scrub.
 *
 * The label and the two edge strips are scrub zones (`ew-resize`); the middle
 * of the box stays a plain text input with an I-beam, so manual entry is
 * untouched. While typing, a local draft shadows the value so a half-finished
 * "0:1" isn't parsed and clamped out from under the caret — Enter and blur
 * commit it, Escape throws it away.
 */
function TimeField({
  label,
  value,
  min,
  max,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onCommit: (seconds: number) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);

  // `getValue` reads the committed prop, so each scrub starts from where the
  // last one actually landed after clamping.
  const scrub = useNumberScrub({ getValue: () => value, onChange: onCommit, min, max });

  const commitDraft = () => {
    if (draft === null) return;
    const parsed = parseClock(draft);
    if (parsed !== null) onCommit(Math.min(max, Math.max(min, parsed)));
    setDraft(null);
  };

  return (
    <div className="prop-panel__field">
      <label className="prop-panel__label prop-panel__label--scrub" htmlFor={id} {...scrub}>
        {label}
      </label>
      <div className="prop-panel__input-wrap">
        <span className="prop-panel__scrub" data-edge="left" aria-hidden {...scrub} />
        <input
          id={id}
          className="prop-panel__input"
          type="text"
          inputMode="numeric"
          value={draft ?? formatClock(value)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitDraft();
              e.currentTarget.blur();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              setDraft(null);
              e.currentTarget.blur();
            }
          }}
        />
        <span className="prop-panel__scrub" data-edge="right" aria-hidden {...scrub} />
      </div>
    </div>
  );
}

/** One focus cut: whose eyeline, when, how long, and a control to drop it. */
function FocusRow({
  focus,
  onUpdate,
  onRemove,
}: {
  focus: Focus;
  onUpdate: (next: Partial<Focus>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="prop-panel__listrow">
      <select
        className="prop-panel__select prop-panel__select--chip"
        value={focus.target}
        aria-label="Focus target"
        onChange={(e) => onUpdate({ target: e.target.value })}
      >
        {FOCUS_TARGETS.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <span className="prop-panel__chip">{formatClock(focus.time)}</span>
      <span className="prop-panel__listrow-label">{formatClock(focus.duration)}s</span>
      <IconButton
        size={24}
        variant="ghost"
        aria-label={`Delete focus on ${focus.target} at ${formatClock(focus.time)}`}
        onClick={onRemove}
      >
        <Trash size={16} />
      </IconButton>
    </div>
  );
}

/**
 * Floating right-hand inspector for a selected camera-shot clip: the shot's
 * name and framing preset, its start / end times, and the eye-contact cuts
 * that play inside it. Every control writes straight through to the timeline.
 */
export function ShotStylePanel({
  scene,
  onClose,
  onRename,
  onRetime,
  onSetPreset,
  onSetSpeaker,
  onAddFocus,
  onRemoveFocus,
  onUpdateFocus,
}: {
  scene: Scene;
  onClose: () => void;
  onRename: (label: string) => void;
  onRetime: (edge: 'start' | 'end', seconds: number) => void;
  onSetPreset: (preset: ShotPreset) => void;
  onSetSpeaker: (speaker: string) => void;
  onAddFocus: () => void;
  onRemoveFocus: (focusId: string) => void;
  onUpdateFocus: (focusId: string, next: Partial<Focus>) => void;
}) {
  const [eyeExpanded, setEyeExpanded] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const renameRef = useRef<HTMLInputElement>(null);

  // Selecting a different clip drops any half-finished rename.
  useEffect(() => setRenaming(false), [scene.id]);

  useEffect(() => {
    if (renaming) renameRef.current?.select();
  }, [renaming]);

  return (
    <aside className="prop-panel" aria-label="Shot Style">
      <header className="prop-panel__header">
        <span className="prop-panel__title">Shot Style</span>
        <IconButton size={32} variant="ghost" aria-label="Close" onClick={onClose}>
          <X size={16} />
        </IconButton>
      </header>

      {/* Shot identity — the name is edited in place, and the change shows on
          the timeline clip's tag as soon as it commits. */}
      <div className="prop-panel__row">
        <Target size={20} className="prop-panel__row-icon" />
        {renaming ? (
          <input
            ref={renameRef}
            className="prop-panel__input prop-panel__input--inline"
            type="text"
            defaultValue={scene.label}
            aria-label="Shot name"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onRename(e.currentTarget.value);
                setRenaming(false);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setRenaming(false); // blur handler sees `renaming` already false
              }
            }}
            onBlur={() => setRenaming(false)}
          />
        ) : (
          <>
            <span className="prop-panel__row-title">{scene.label}</span>
            <IconButton
              size={32}
              variant="ghost"
              aria-label="Rename shot"
              onClick={() => setRenaming(true)}
            >
              <PencilSimple size={18} />
            </IconButton>
          </>
        )}
      </div>

      {/* Framing preset — reframes the preview and re-tags the clip. */}
      <div className="prop-panel__section">
        <div className="prop-panel__field">
          <span className="prop-panel__label">Framing</span>
          <select
            className="prop-panel__select"
            value={scene.preset}
            aria-label="Shot preset"
            onChange={(e) => onSetPreset(e.target.value as ShotPreset)}
          >
            {SHOT_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Start / End timestamps — always visible, independent of Eye Contact.
          Each is bounded by the other so the shot can never invert. */}
      <div className="prop-panel__section">
        <div className="prop-panel__fields">
          <TimeField
            label="Start"
            value={scene.start}
            min={0}
            max={scene.end - MIN_SHOT_SEC}
            onCommit={(v) => onRetime('start', v)}
          />
          <TimeField
            label="End"
            value={scene.end}
            min={scene.start + MIN_SHOT_SEC}
            max={Infinity}
            onCommit={(v) => onRetime('end', v)}
          />
        </div>
      </div>

      {/* Eye Contact — collapsible group holding the speaker selector, the focus
          cuts and the add control, so collapsing hides those together. */}
      <div className="prop-panel__collapsible" data-expanded={eyeExpanded || undefined}>
        <button
          className="prop-panel__row prop-panel__row--button"
          type="button"
          aria-expanded={eyeExpanded}
          onClick={() => setEyeExpanded((v) => !v)}
        >
          <Eye size={20} className="prop-panel__row-icon" />
          <span className="prop-panel__row-title">Eye Contact</span>
          <CaretDown size={18} className="prop-panel__row-icon prop-panel__chevron" />
        </button>
        {eyeExpanded && (
          <div className="prop-panel__collapsible-body">
            {/* Who holds the camera for this shot */}
            <div className="prop-panel__listrow">
              <select
                className="prop-panel__select prop-panel__select--chip"
                value={scene.speaker}
                aria-label="Speaker holding eye contact"
                onChange={(e) => onSetSpeaker(e.target.value)}
              >
                {SPEAKERS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <span className="prop-panel__arrow">→</span>
              <span className="prop-panel__chip">camera</span>
            </div>

            <button className="prop-panel__add" type="button" onClick={onAddFocus}>
              <Plus size={16} weight="bold" />
              Add a focus
            </button>

            {scene.focuses.map((f) => (
              <FocusRow
                key={f.id}
                focus={f}
                onUpdate={(next) => onUpdateFocus(f.id, next)}
                onRemove={() => onRemoveFocus(f.id)}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
