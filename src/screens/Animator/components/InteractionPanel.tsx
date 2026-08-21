import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowUUpLeft,
  ArrowUUpRight,
  CaretDown,
  Check,
  Eraser,
  PencilSimple,
  Plus,
  Trash,
  X,
} from '@phosphor-icons/react';
import { InteractionOrbit } from '../../../assets/icons';
import { IconButton } from '../../../ui/IconButton';
import { EMOJI_CHOICES, MIN_CLIP_SEC, clipText } from '../data';
import type { AvatarRow, Interaction, ScriptClip } from '../data';
import { TextField, TimeField } from './PanelFields';

type Page = 'summary' | 'edit' | 'custom';
type Tab = 'prompt' | 'draw';
type Tool = 'pen' | 'eraser';

/** The draw tab's ink colours, per the design's toolbar. */
const INK_COLORS = ['#ffffff', '#000000', '#26c9f2', '#34d399', '#a78bfa', '#f9a0c0'];

type Stroke = { color: string; points: string };

/** How close (in viewbox units) the eraser must pass to take a stroke. */
const ERASE_RADIUS = 5;

const strokeHit = (s: Stroke, [px, py]: number[]): boolean =>
  s.points.split(' ').some((pt) => {
    const [x, y] = pt.split(',').map(Number);
    return Math.hypot(x - px, y - py) < ERASE_RADIUS;
  });

/** Gesture names keep the timeline's shortcode dress — ":like-this". */
const toShortcode = (text: string): string =>
  `:${text.trim().toLowerCase().replace(/^:+/, '').replace(/\s+/g, '-')}`;

/**
 * The CUSTOM gesture page — describe one as a prompt, or draw it with the
 * floating ink toolbar. One surface with two doors: the edit page of an
 * existing reaction and the draft panel of a brand-new one both open it, and
 * `onPick` hands back whatever gesture the prompt produced.
 */
function CustomGesturePage({
  onBack,
  onClose,
  onPick,
}: {
  onBack: () => void;
  onClose: () => void;
  onPick: (emoji: string, label: string) => void;
}) {
  const [tab, setTab] = useState<Tab>('prompt');

  /* Draw tab state: committed strokes, the one being drawn, and full-canvas
     snapshots for undo/redo — a snapshot survives an erase, which can take
     strokes from anywhere in the pile, not just the top. */
  const [ink, setInk] = useState(INK_COLORS[0]);
  const [tool, setTool] = useState<Tool>('pen');
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [history, setHistory] = useState<Stroke[][]>([]);
  const [future, setFuture] = useState<Stroke[][]>([]);
  const drawing = useRef<{ points: number[][] } | null>(null);
  const erasing = useRef<{ before: Stroke[]; erased: boolean } | null>(null);
  const [livePoints, setLivePoints] = useState<string | null>(null);
  const canvasRef = useRef<SVGSVGElement | null>(null);

  /** Bank the pre-edit canvas so undo can restore it; a new edit clears redo. */
  const snapshot = (before: Stroke[]) => {
    setHistory((h) => [...h, before]);
    setFuture([]);
  };

  const undo = () => {
    if (!history.length) return;
    setFuture((f) => [...f, strokes]);
    setStrokes(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
  };

  const redo = () => {
    if (!future.length) return;
    setHistory((h) => [...h, strokes]);
    setStrokes(future[future.length - 1]);
    setFuture((f) => f.slice(0, -1));
  };

  /** Remove every stroke passing near the point, flagging the drag as an edit. */
  const eraseAt = (p: number[]) =>
    setStrokes((cur) => {
      const next = cur.filter((s) => !strokeHit(s, p));
      if (next.length === cur.length) return cur;
      if (erasing.current) erasing.current.erased = true;
      return next;
    });

  const canvasPoint = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return [
      Math.round(((e.clientX - r.left) / r.width) * 1000) / 10,
      Math.round(((e.clientY - r.top) / r.height) * 1000) / 10,
    ];
  };

  return (
    <aside className="prop-panel prop-panel--attn prop-panel--ix" aria-label="Custom Interaction">
      <div className="cam-page" key={`custom-${tab}`}>
        <header className="prop-panel__header">
          <span className="prop-panel__title">
            <IconButton
              size={32}
              variant="ghost"
              className="prop-panel__hbtn prop-panel__hbtn--filled"
              aria-label="Back"
              onClick={onBack}
            >
              <ArrowLeft size={16} />
            </IconButton>
            Custom Interaction
          </span>
          <IconButton size={32} variant="ghost" className="prop-panel__hbtn" aria-label="Close" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </header>

        <div className="ix-tabs">
          <button type="button" className="ix-tab" data-active={tab === 'prompt' || undefined} onClick={() => setTab('prompt')}>
            Prompt
          </button>
          <button type="button" className="ix-tab" data-active={tab === 'draw' || undefined} onClick={() => setTab('draw')}>
            Draw
          </button>
        </div>

        {tab === 'prompt' ? (
          <div className="prop-panel__section">
            <textarea
              className="prop-panel__textarea ix-prompt"
              placeholder="Prompt what you want..."
              aria-label="Describe the gesture"
              rows={2}
              onKeyDown={(e) => {
                // Enter performs the prompt: the gesture takes the described
                // name. The emoji is "generated" — stubbed to ❤️ for now.
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  const text = e.currentTarget.value.trim();
                  if (!text) return;
                  onPick('❤️', `:${text.toLowerCase().split(/\s+/).slice(0, 3).join('-')}`);
                }
              }}
            />
          </div>
        ) : (
          <div className="prop-panel__section ix-canvaswrap">
            {/* The floating ink toolbar, riding the panel's left edge. */}
            <div className="ix-tools" role="toolbar" aria-label="Drawing tools">
              {INK_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="ix-ink"
                  style={{ background: c }}
                  data-picked={c === ink || undefined}
                  aria-label={`Ink ${c}`}
                  onClick={() => {
                    // Picking a colour is a statement of intent to draw.
                    setInk(c);
                    setTool('pen');
                  }}
                />
              ))}
              <span className="ix-tools__gap" />
              <button
                type="button"
                className="ix-tool"
                data-active={tool === 'pen' || undefined}
                aria-label="Pencil"
                onClick={() => setTool('pen')}
              >
                <PencilSimple size={18} />
              </button>
              <button
                type="button"
                className="ix-tool"
                data-active={tool === 'eraser' || undefined}
                aria-label="Eraser"
                onClick={() => setTool('eraser')}
              >
                <Eraser size={18} />
              </button>
              <button type="button" className="ix-tool" aria-label="Undo" onClick={undo}>
                <ArrowUUpLeft size={18} />
              </button>
              <button type="button" className="ix-tool" aria-label="Redo" onClick={redo}>
                <ArrowUUpRight size={18} />
              </button>
            </div>

            <svg
              ref={canvasRef}
              className="ix-canvas"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              role="img"
              aria-label="Drawing canvas"
              data-tool={tool}
              onPointerDown={(e) => {
                // The click-away deselect checks the target's ancestry, and an
                // erased stroke is detached before that check runs — so keep
                // canvas presses out of the window listener entirely.
                e.stopPropagation();
                e.currentTarget.setPointerCapture(e.pointerId);
                if (tool === 'eraser') {
                  erasing.current = { before: strokes, erased: false };
                  eraseAt(canvasPoint(e));
                  return;
                }
                drawing.current = { points: [canvasPoint(e)] };
                setLivePoints(drawing.current.points.map((p) => p.join(',')).join(' '));
              }}
              onPointerMove={(e) => {
                if (erasing.current) {
                  eraseAt(canvasPoint(e));
                  return;
                }
                if (!drawing.current) return;
                drawing.current.points.push(canvasPoint(e));
                setLivePoints(drawing.current.points.map((p) => p.join(',')).join(' '));
              }}
              onPointerUp={() => {
                if (erasing.current) {
                  // One erase drag is one undo step, however many strokes it took.
                  const { before, erased } = erasing.current;
                  erasing.current = null;
                  if (erased) snapshot(before);
                  return;
                }
                if (!drawing.current) return;
                const points = drawing.current.points.map((p) => p.join(',')).join(' ');
                drawing.current = null;
                setLivePoints(null);
                snapshot(strokes);
                setStrokes((cur) => [...cur, { color: ink, points }]);
              }}
            >
              {strokes.map((s, i) => (
                <polyline key={i} points={s.points} stroke={s.color} />
              ))}
              {livePoints && <polyline points={livePoints} stroke={ink} />}
            </svg>

            {/* Done: the drawing "generates" the gesture (stubbed to ❤️) — the
                same circled check the scene cards commit with, below the
                canvas at the right. */}
            <button
              type="button"
              className="ix-confirm"
              aria-label="Done — generate the gesture"
              disabled={!strokes.length}
              /* No default name: the empty label sends the summary page
                 straight into its rename field. */
              onClick={() => onPick('❤️', '')}
            >
              <Check size={14} weight="bold" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

/**
 * The gesture inspector's DRAFT posture — the surface a reaction-lane click
 * opens (same gesture as adding a line, Figma 758-167324). The vocabulary IS
 * the confirmation: picking an emoji commits the reaction; hovering one
 * previews it as the ghost in the timeline chip. The Custom door commits the
 * same way. Escape or the X discards. Standalone by design — a parent line
 * is attached afterwards, in the panel.
 */
export function InteractionDraftPanel({
  actor,
  start,
  maxStart,
  onRetimeStart,
  onPreview,
  onCommit,
  onCancel,
}: {
  actor: AvatarRow;
  start: number;
  /** Latest the reaction can begin — the take's end less one minimum chip. */
  maxStart: number;
  onRetimeStart: (seconds: number) => void;
  /** A gesture under the pointer, mirrored into the draft chip's ghost. */
  onPreview: (emoji: string | null) => void;
  onCommit: (emoji: string, label: string) => void;
  onCancel: () => void;
}) {
  const [custom, setCustom] = useState(false);

  /* The same custom door the edit page has — a prompted gesture commits the
     draft exactly like a picked emoji does. */
  if (custom) {
    return (
      <CustomGesturePage onBack={() => setCustom(false)} onClose={onCancel} onPick={onCommit} />
    );
  }

  return (
    <aside className="prop-panel prop-panel--attn prop-panel--ix" aria-label="Interaction">
      <div className="cam-page" key="draft">
        <header className="prop-panel__header">
          <span className="prop-panel__title">
            <InteractionOrbit size={20} /> Interaction
            <span className={`prop-panel__chip prop-panel__chip--${actor.color}`}>{actor.name}</span>
          </span>
          <IconButton size={32} variant="ghost" className="prop-panel__hbtn" aria-label="Close" onClick={onCancel}>
            <X size={16} />
          </IconButton>
        </header>

        <div className="prop-panel__section">
          <button type="button" className="attn-delete" onClick={() => setCustom(true)}>
            <Plus size={16} />
            Custom
          </button>
        </div>

        {/* Picking from the vocabulary is the Enter of this flow. */}
        <div className="prop-panel__section">
          <span className="prop-panel__label">Pick a gesture</span>
          <div className="ix-grid" onMouseLeave={() => onPreview(null)}>
            {EMOJI_CHOICES.map((c) => (
              <button
                key={c.label}
                type="button"
                className="ix-emoji"
                aria-label={c.label}
                onMouseEnter={() => onPreview(c.emoji)}
                onFocus={() => onPreview(c.emoji)}
                onBlur={() => onPreview(null)}
                onClick={() => onCommit(c.emoji, c.label)}
              >
                {c.emoji}
              </button>
            ))}
          </div>
        </div>

        <div className="prop-panel__section">
          <div className="prop-panel__fields">
            <TimeField label="Start time" value={start} max={maxStart} onCommit={onRetimeStart} />
            <TimeField label="End time" value={Math.min(start + 2, maxStart + MIN_CLIP_SEC)} disabled onCommit={() => {}} />
          </div>
        </div>
      </div>
    </aside>
  );
}

/**
 * The gesture instrument's inspector — three pages in one panel.
 *
 * SUMMARY: the PARENT line this reaction answers (tinted with its speaker's
 * track colour — the relationship the connector draws), the gesture itself as
 * emoji + shortcode, start/end, delete. EDIT: the emoji vocabulary, plus the
 * door to CUSTOM: describe a gesture as a prompt, or draw it on a canvas with
 * the floating ink toolbar.
 */
export function InteractionPanel({
  it,
  actor,
  scripts,
  onClose,
  onSetEmoji,
  onRename,
  onSetDescription,
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
  /** Rename the gesture — the user's own shortcode, same emoji. */
  onRename: (label: string) => void;
  /** Write (or clear) the gesture's free-text description. */
  onSetDescription: (text: string) => void;
  onRetime: (edge: 'start' | 'end', seconds: number) => void;
  onSetTrigger: (triggerId: string | undefined) => void;
  onRemove: () => void;
}) {
  const [page, setPage] = useState<Page>('summary');
  const [parentOpen, setParentOpen] = useState(false);
  const parentRef = useRef<HTMLDivElement | null>(null);

  /* Renaming swaps the shortcode tag for an inline input; null = not renaming. */
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const renameCancelled = useRef(false);

  /* The parent menu closes on any outside press or Escape. */
  useEffect(() => {
    if (!parentOpen) return;
    const onDown = (e: PointerEvent) => {
      if (parentRef.current && !parentRef.current.contains(e.target as Node)) setParentOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setParentOpen(false);
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [parentOpen]);

  /** How far around the reaction a line still counts as "its" moment: a
   *  reaction usually trails what it answers by a beat, sometimes leads it. */
  const LOOKBACK_SEC = 4;
  const LOOKAHEAD_SEC = 2;

  /** Parent candidates: the lines in this reaction's column of the take
   *  (overlapping its widened window), plus whatever line is already the
   *  parent — the row must always tell the truth. */
  const candidates = scripts
    .filter(
      ({ clip }) =>
        clip.id === it.triggerId ||
        (clip.start < it.end + LOOKAHEAD_SEC && clip.end > it.start - LOOKBACK_SEC),
    )
    .sort((a, b) => a.clip.start - b.clip.start);

  const trigger = candidates.find((s) => s.clip.id === it.triggerId);

  const header = (title: string, onBack?: () => void) => (
    <header className="prop-panel__header">
      <span className="prop-panel__title">
        {onBack ? (
          <IconButton
            size={32}
            variant="ghost"
            className="prop-panel__hbtn prop-panel__hbtn--filled"
            aria-label="Back"
            onClick={onBack}
          >
            <ArrowLeft size={16} />
          </IconButton>
        ) : (
          <InteractionOrbit size={20} />
        )}
        {title}
        {/* Who PERFORMS the gesture, in the timeline's own colour language. */}
        {!onBack && (
          <span className={`prop-panel__chip prop-panel__chip--${actor.color}`}>{actor.name}</span>
        )}
      </span>
      <IconButton size={32} variant="ghost" className="prop-panel__hbtn" aria-label="Close" onClick={onClose}>
        <X size={16} />
      </IconButton>
    </header>
  );

  /* --- Page: Custom Interaction (prompt | draw) ------------------------------ */

  if (page === 'custom') {
    return (
      <CustomGesturePage
        onBack={() => setPage('edit')}
        onClose={onClose}
        onPick={(emoji, label) => {
          onSetEmoji(emoji, label);
          setPage('summary');
          // A drawn gesture arrives NAMELESS — land with the name field open
          // and the cursor in it, so naming it is the obvious next move.
          if (!label) setNameDraft('');
        }}
      />
    );
  }

  /* --- Page: Edit Interaction (the emoji vocabulary) -------------------------- */

  if (page === 'edit') {
    return (
      <aside className="prop-panel prop-panel--attn prop-panel--ix" aria-label="Edit Interaction">
        <div className="cam-page" key="edit">
          {header('Edit Interaction', () => setPage('summary'))}

          <div className="prop-panel__section">
            <button type="button" className="attn-delete" onClick={() => setPage('custom')}>
              <Plus size={16} />
              Custom
            </button>
          </div>

          <div className="prop-panel__section">
            <div className="ix-grid">
              {EMOJI_CHOICES.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  className="ix-emoji"
                  data-picked={c.emoji === it.emoji || undefined}
                  aria-pressed={c.emoji === it.emoji}
                  aria-label={c.label}
                  onClick={() => {
                    onSetEmoji(c.emoji, c.label);
                    setPage('summary');
                  }}
                >
                  {c.emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>
    );
  }

  /* --- Page: summary ----------------------------------------------------------- */

  return (
    <aside className="prop-panel prop-panel--attn prop-panel--ix" aria-label="Interaction">
      <div className="cam-page" key="summary">
        {header('Interaction')}

        {/* The line this reaction answers, wearing its speaker's track colour.
            A dropdown, but a SHORT one: only the lines spoken in this
            reaction's own stretch of the take (its column of the timeline,
            with a little slack either side) are offered, plus the current
            parent wherever it sits — never the whole script. */}
        <div className="prop-panel__section">
          <span className="prop-panel__label">Parent</span>
          <div className="attn-select-wrap" ref={parentRef}>
            <button
              type="button"
              className="ix-parent"
              data-color={trigger?.row.color}
              aria-expanded={parentOpen}
              onClick={() => setParentOpen((v) => !v)}
            >
              <span className="ix-parent__value">{trigger ? clipText(trigger.clip) : 'None'}</span>
              {/* Same caret as the Edit Camera State selects, up while open. */}
              <CaretDown size={16} className="attn-select__caret" data-open={parentOpen || undefined} />
            </button>
            {parentOpen && (
              <div className="attn-menu" role="listbox" aria-label="The line this reaction responds to">
                <button
                  type="button"
                  role="option"
                  className="attn-menu__item"
                  aria-selected={!it.triggerId}
                  data-picked={!it.triggerId || undefined}
                  onClick={() => {
                    onSetTrigger(undefined);
                    setParentOpen(false);
                  }}
                >
                  None
                </button>
                {candidates.map(({ row, clip }) => (
                  <button
                    key={clip.id}
                    type="button"
                    role="option"
                    className="attn-menu__item"
                    aria-selected={clip.id === it.triggerId}
                    data-picked={clip.id === it.triggerId || undefined}
                    onClick={() => {
                      onSetTrigger(clip.id);
                      setParentOpen(false);
                    }}
                  >
                    {row.name}: {clipText(clip).slice(0, 24)}
                    {clipText(clip).length > 24 ? '…' : ''}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* The gesture itself; the shortcode is yours to rename in place, and
            the pencil opens the vocabulary. */}
        <div className="prop-panel__section cam-namerow">
          <span className="ix-gesture">
            <span className="prop-panel__emoji">{it.emoji}</span>
            {/* A nameless gesture (fresh from the draw canvas) holds the input
                OPEN on the main panel — mounted focused, cursor ready. */}
            {nameDraft !== null || !it.label ? (
              <input
                className="prop-panel__input prop-panel__input--inline"
                type="text"
                aria-label="Gesture name"
                value={nameDraft ?? ''}
                placeholder="Name this gesture"
                autoFocus
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={() => {
                  if (!renameCancelled.current && nameDraft?.trim()) onRename(toShortcode(nameDraft));
                  renameCancelled.current = false;
                  setNameDraft(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.currentTarget.blur();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    renameCancelled.current = true;
                    e.currentTarget.blur();
                  }
                }}
              />
            ) : (
              <button
                type="button"
                className="prop-panel__tag ix-tag-rename"
                onClick={() => setNameDraft(it.label.replace(/^:/, ''))}
              >
                {it.label}
              </button>
            )}
          </span>
          <IconButton size={24} variant="ghost" aria-label="Edit the gesture" onClick={() => setPage('edit')}>
            <PencilSimple size={16} />
          </IconButton>
        </div>

        {/* A free note on how the gesture should read, in the user's own words —
            the placeholder is introduction enough, no label. */}
        <div className="prop-panel__section">
          {/* A gesture WITH a trigger line is a reaction — name it as one. */}
          <TextField
            value={it.description ?? ''}
            ariaLabel={it.triggerId ? 'Reaction description' : 'Gesture description'}
            placeholder={it.triggerId ? 'Describe this reaction...' : 'Describe this gesture...'}
            rows={2}
            allowEmpty
            onCommit={(text) => onSetDescription(text.trim())}
          />
        </div>

        <div className="prop-panel__section">
          <div className="prop-panel__fields">
            <TimeField
              label="Start time"
              value={it.start}
              max={it.end - MIN_CLIP_SEC}
              onCommit={(v) => onRetime('start', v)}
            />
            <TimeField
              label="End time"
              value={it.end}
              min={it.start + MIN_CLIP_SEC}
              onCommit={(v) => onRetime('end', v)}
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
