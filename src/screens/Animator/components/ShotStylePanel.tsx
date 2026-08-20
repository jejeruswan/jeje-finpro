import { useEffect, useRef, useState } from 'react';
import { CornersOut, PencilSimple, Scissors, Trash, X } from '@phosphor-icons/react';
import { IconButton } from '../../../ui/IconButton';
import { MIN_SHOT_SEC, SHOT_PRESETS, subjectsIn } from '../data';
import type { Shot, ShotPreset } from '../data';
import { TimeField } from './PanelFields';

/**
 * The framing instrument's inspector: what this shot is called, how it crops the
 * take, and the window it covers.
 *
 * Eye contact used to live here. It moved to the Attention panel, because gaze
 * is not a property of the camera — it is one of several ways to put the viewer's
 * eye on a subject, and it belongs next to the intent it serves. That also
 * retired the keyframe diamonds that used to collide with the clip's own label.
 *
 * Both time fields roll the seam against the neighbouring shot: the rail is
 * contiguous, so every frame keeps exactly one shot style and the take's length
 * never changes.
 */
export function ShotStylePanel({
  shot,
  neighbours,
  onClose,
  onRename,
  onRoll,
  onSetPreset,
  onSetSubject,
  onSplit,
  onRemove,
  playhead,
}: {
  shot: Shot;
  neighbours: { hasPrev: boolean; hasNext: boolean };
  onClose: () => void;
  onRename: (label: string) => void;
  onRoll: (edge: 'start' | 'end', seconds: number) => void;
  onSetPreset: (preset: ShotPreset) => void;
  onSetSubject: (subjectId: string) => void;
  onSplit: (seconds: number) => void;
  onRemove: () => void;
  playhead: number;
}) {
  const [renaming, setRenaming] = useState(false);
  const renameRef = useRef<HTMLInputElement>(null);

  // Selecting a different clip drops any half-finished rename.
  useEffect(() => setRenaming(false), [shot.id]);
  useEffect(() => {
    if (renaming) renameRef.current?.select();
  }, [renaming]);

  const canSplit = playhead > shot.start + MIN_SHOT_SEC && playhead < shot.end - MIN_SHOT_SEC;

  return (
    <aside className="prop-panel" aria-label="Shot Style">
      <header className="prop-panel__header">
        <span className="prop-panel__title">Shot Style</span>
        <IconButton size={32} variant="ghost" aria-label="Close" onClick={onClose}>
          <X size={16} />
        </IconButton>
      </header>

      {/* Identity — the name is edited in place and shows on the clip's tag as
          soon as it commits. */}
      <div className="prop-panel__row">
        <CornersOut size={20} className="prop-panel__row-icon" />
        {renaming ? (
          <input
            ref={renameRef}
            className="prop-panel__input prop-panel__input--inline"
            type="text"
            defaultValue={shot.label}
            aria-label="Shot name"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onRename(e.currentTarget.value);
                setRenaming(false);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setRenaming(false);
              }
            }}
            onBlur={(e) => {
              onRename(e.currentTarget.value);
              setRenaming(false);
            }}
          />
        ) : (
          <>
            <span className="prop-panel__row-title">{shot.label}</span>
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

      {/* Framing + subject. Changing either re-tags the clip, which is what
          surfaces the change on the rail. */}
      <div className="prop-panel__section">
        <div className="prop-panel__fields">
          <div className="prop-panel__field">
            <span className="prop-panel__label">Framing</span>
            <select
              className="prop-panel__select"
              value={shot.preset}
              aria-label="Shot preset"
              onChange={(e) => onSetPreset(e.target.value as ShotPreset)}
            >
              {SHOT_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>
          <div className="prop-panel__field">
            <span className="prop-panel__label">On</span>
            <select
              className="prop-panel__select"
              value={shot.subjectId}
              aria-label="Shot subject"
              onChange={(e) => onSetSubject(e.target.value)}
            >
              {subjectsIn(shot.start, shot.end).map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>
        <p className="prop-panel__note">
          A shot style is a virtual reframe of the one raw take — nothing
          re-renders when you move it, and the crop follows the subject you pick.
        </p>
      </div>

      {/* Start / End — each bounded by its neighbour so the rail can't tear. */}
      <div className="prop-panel__section">
        <div className="prop-panel__fields">
          <TimeField
            label="From"
            value={shot.start}
            max={shot.end - MIN_SHOT_SEC}
            disabled={!neighbours.hasPrev}
            onCommit={(v) => onRoll('start', v)}
          />
          <TimeField
            label="To"
            value={shot.end}
            min={shot.start + MIN_SHOT_SEC}
            disabled={!neighbours.hasNext}
            onCommit={(v) => onRoll('end', v)}
          />
        </div>
      </div>

      <div className="prop-panel__section prop-panel__section--actions">
        <button
          className="prop-panel__add"
          type="button"
          disabled={!canSplit}
          onClick={() => onSplit(playhead)}
          title={canSplit ? 'Split at the playhead' : 'Move the playhead inside this shot to split it'}
        >
          <Scissors size={16} />
          Split at playhead
        </button>
        <IconButton size={32} variant="ghost" aria-label="Delete this shot" onClick={onRemove}>
          <Trash size={16} />
        </IconButton>
      </div>
    </aside>
  );
}
