import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CaretDown, PencilSimple, Trash, X } from '@phosphor-icons/react';
import { CameraLens } from '../../../assets/icons';
import { IconButton } from '../../../ui/IconButton';
import { CAMERA_ANCHORS, CAMERA_RIGS, SHOT_PRESETS, cameraStateName } from '../data';
import type { CameraAnchor, CameraRig, Shot, ShotPreset } from '../data';
import { TimeField } from './PanelFields';

type MenuId = 'rig' | 'framing' | 'anchor';

/**
 * Inspector for one camera state — two pages in one panel.
 *
 * SUMMARY: the state's derived name ("Selfie - Wide - Face Track - 42"), the
 * clip's start/end, and delete. The pencil turns the page. EDIT: the four
 * properties behind that name — rig, framing, anchor as dropdowns, stability
 * as a slider — with the back arrow returning to the summary.
 */
export function CameraStatePanel({
  shot,
  onClose,
  onPatch,
  onRetimeStart,
  onRetimeEnd,
  onRemove,
}: {
  shot: Shot;
  onClose: () => void;
  onPatch: (patch: Partial<Pick<Shot, 'rig' | 'preset' | 'anchor' | 'stability'>>) => void;
  /** Roll the leading seam. Absent on the first state — the take starts here. */
  onRetimeStart?: (seconds: number) => void;
  /** Roll the trailing seam. Absent on the last state. */
  onRetimeEnd?: (seconds: number) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [openMenu, setOpenMenu] = useState<MenuId | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  /* Any press outside the open dropdown (or Escape) closes it. */
  useEffect(() => {
    if (!openMenu) return;
    const onDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenu(null);
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [openMenu]);

  /** One "Title + dropdown" section of the edit page. */
  const dropdown = <T extends string>(
    id: MenuId,
    title: string,
    options: { id: T; label: string }[],
    value: T,
    pick: (id: T) => void,
  ) => (
    <div className="prop-panel__section">
      <span className="prop-panel__label">{title}</span>
      <div className="attn-select-wrap" ref={openMenu === id ? menuRef : undefined}>
        <button
          type="button"
          className="attn-select"
          aria-expanded={openMenu === id}
          onClick={() => setOpenMenu((cur) => (cur === id ? null : id))}
        >
          <span className="attn-select__value">
            {options.find((o) => o.id === value)?.label}
          </span>
          <CaretDown size={16} className="attn-select__caret" />
        </button>
        {openMenu === id && (
          <div className="attn-menu attn-menu--fit" role="listbox" aria-label={title}>
            {options.map((o) => (
              <button
                key={o.id}
                type="button"
                role="option"
                className="attn-menu__item"
                aria-selected={o.id === value}
                data-picked={o.id === value || undefined}
                onClick={() => {
                  pick(o.id);
                  setOpenMenu(null);
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  if (editing) {
    return (
      <aside className="prop-panel prop-panel--attn" aria-label="Edit Camera State">
        <div className="cam-page" key="edit">
          <header className="prop-panel__header">
            <span className="prop-panel__title">
              <IconButton
                size={32}
                variant="ghost"
                className="prop-panel__hbtn prop-panel__hbtn--filled"
                aria-label="Back to the camera state"
                onClick={() => {
                  setOpenMenu(null);
                  setEditing(false);
                }}
              >
                <ArrowLeft size={16} />
              </IconButton>
              Edit Camera State
            </span>
            <IconButton size={32} variant="ghost" className="prop-panel__hbtn" aria-label="Close" onClick={onClose}>
              <X size={16} />
            </IconButton>
          </header>

          {dropdown<CameraRig>('rig', 'Rig and Motion', CAMERA_RIGS, shot.rig, (rig) => onPatch({ rig }))}
          {dropdown<ShotPreset>('framing', 'Framing', SHOT_PRESETS, shot.preset, (preset) => onPatch({ preset }))}
          {dropdown<CameraAnchor>('anchor', 'Target Anchor', CAMERA_ANCHORS, shot.anchor, (anchor) => onPatch({ anchor }))}

          <div className="prop-panel__section">
            <span className="prop-panel__label">Stability</span>
            <div className="cam-slider-row">
              <span className="cam-slider">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={Math.round(shot.stability)}
                  aria-label="Stability"
                  style={{ '--fill': `${Math.round(shot.stability)}%` } as React.CSSProperties}
                  onChange={(e) => onPatch({ stability: Number(e.target.value) })}
                />
              </span>
              <span className="cam-slider-value">{Math.round(shot.stability)}</span>
            </div>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="prop-panel prop-panel--attn" aria-label="Camera State">
      <div className="cam-page" key="summary">
        <header className="prop-panel__header">
          <span className="prop-panel__title">
            <CameraLens size={20} /> Camera State
          </span>
          <IconButton size={32} variant="ghost" className="prop-panel__hbtn" aria-label="Close" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </header>

        {/* The state's name IS its settings — the pencil opens them. */}
        <div className="prop-panel__section cam-namerow">
          <span className="cam-name">{cameraStateName(shot)}</span>
          <IconButton size={24} variant="ghost" aria-label="Edit the camera state" onClick={() => setEditing(true)}>
            <PencilSimple size={16} />
          </IconButton>
        </div>

        {/* Both edges are seams with the neighbouring state — editing an edge
            ROLLS it, exactly like dragging the boundary on the track. */}
        <div className="prop-panel__section">
          <div className="prop-panel__fields">
            <TimeField
              label="Start time"
              value={shot.start}
              disabled={!onRetimeStart}
              onCommit={(sec) => onRetimeStart?.(sec)}
            />
            <TimeField
              label="End time"
              value={shot.end}
              disabled={!onRetimeEnd}
              onCommit={(sec) => onRetimeEnd?.(sec)}
            />
          </div>
        </div>

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
