import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowUUpLeft,
  ArrowUUpRight,
  ChatCircleDots,
  PencilSimple,
  Plus,
  Smiley,
  Trash,
  X,
} from '@phosphor-icons/react';
import { ImagePlus } from 'lucide-react';
import { InteractionOrbit } from '../../../assets/icons';
import { IconButton } from '../../../ui/IconButton';
import { EMOJI_CHOICES, MIN_CLIP_SEC, clipText } from '../data';
import type { AvatarRow, Interaction, ScriptClip } from '../data';
import { TimeField } from './PanelFields';

type Page = 'summary' | 'edit' | 'custom';
type Tab = 'prompt' | 'draw';

/** The draw tab's ink colours, per the design's toolbar. */
const INK_COLORS = ['#ffffff', '#000000', '#26c9f2', '#34d399', '#a78bfa', '#f9a0c0'];

type Stroke = { color: string; points: string };

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
  const [page, setPage] = useState<Page>('summary');
  const [tab, setTab] = useState<Tab>('prompt');
  const [parentOpen, setParentOpen] = useState(false);
  const parentRef = useRef<HTMLDivElement | null>(null);

  /* Draw tab state: committed strokes, the one being drawn, and the redo pile. */
  const [ink, setInk] = useState(INK_COLORS[0]);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [, setRedo] = useState<Stroke[]>([]);
  const drawing = useRef<{ points: number[][] } | null>(null);
  const [livePoints, setLivePoints] = useState<string | null>(null);
  const canvasRef = useRef<SVGSVGElement | null>(null);

  const trigger = scripts.find((s) => s.clip.id === it.triggerId);

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

  const canvasPoint = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return [
      Math.round(((e.clientX - r.left) / r.width) * 1000) / 10,
      Math.round(((e.clientY - r.top) / r.height) * 1000) / 10,
    ];
  };

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
      <aside className="prop-panel prop-panel--attn prop-panel--ix" aria-label="Custom Interaction">
        <div className="cam-page" key={`custom-${tab}`}>
          {header('Custom Interaction', () => setPage('edit'))}

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
                  // name and wears the "generated" spark.
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    const text = e.currentTarget.value.trim();
                    if (!text) return;
                    onSetEmoji('✨', `:${text.toLowerCase().split(/\s+/).slice(0, 3).join('-')}`);
                    setPage('summary');
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
                    onClick={() => setInk(c)}
                  />
                ))}
                <span className="ix-tools__gap" />
                <button type="button" className="ix-tool" data-active aria-label="Pencil">
                  <PencilSimple size={18} />
                </button>
                <button type="button" className="ix-tool" aria-label="Emoji sticker">
                  <Smiley size={18} />
                </button>
                <button type="button" className="ix-tool" aria-label="Caption">
                  <ChatCircleDots size={18} />
                </button>
                <button
                  type="button"
                  className="ix-tool"
                  aria-label="Undo"
                  onClick={() =>
                    setStrokes((cur) => {
                      if (!cur.length) return cur;
                      setRedo((r) => [...r, cur[cur.length - 1]]);
                      return cur.slice(0, -1);
                    })
                  }
                >
                  <ArrowUUpLeft size={18} />
                </button>
                <button
                  type="button"
                  className="ix-tool"
                  aria-label="Redo"
                  onClick={() =>
                    setRedo((cur) => {
                      if (!cur.length) return cur;
                      setStrokes((s) => [...s, cur[cur.length - 1]]);
                      return cur.slice(0, -1);
                    })
                  }
                >
                  <ArrowUUpRight size={18} />
                </button>
                <button
                  type="button"
                  className="ix-tool"
                  aria-label="Clear the canvas"
                  onClick={() => {
                    setStrokes([]);
                    setRedo([]);
                  }}
                >
                  <Trash size={18} />
                </button>
                <button
                  type="button"
                  className="ix-tool"
                  aria-label="Use this drawing"
                  title="Use this drawing as the gesture"
                  onClick={() => {
                    if (!strokes.length) return;
                    onSetEmoji('🎨', ':custom-drawing');
                    setPage('summary');
                  }}
                >
                  <ImagePlus size={18} />
                </button>
              </div>

              <svg
                ref={canvasRef}
                className="ix-canvas"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                role="img"
                aria-label="Drawing canvas"
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  drawing.current = { points: [canvasPoint(e)] };
                  setLivePoints(drawing.current.points.map((p) => p.join(',')).join(' '));
                }}
                onPointerMove={(e) => {
                  if (!drawing.current) return;
                  drawing.current.points.push(canvasPoint(e));
                  setLivePoints(drawing.current.points.map((p) => p.join(',')).join(' '));
                }}
                onPointerUp={() => {
                  if (!drawing.current) return;
                  const points = drawing.current.points.map((p) => p.join(',')).join(' ');
                  drawing.current = null;
                  setLivePoints(null);
                  setStrokes((cur) => [...cur, { color: ink, points }]);
                  setRedo([]);
                }}
              >
                {strokes.map((s, i) => (
                  <polyline key={i} points={s.points} stroke={s.color} />
                ))}
                {livePoints && <polyline points={livePoints} stroke={ink} />}
              </svg>
            </div>
          )}
        </div>
      </aside>
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
                  title={c.label}
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
            Clicking re-parents — the same edit as dragging the connector. */}
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
              {trigger ? clipText(trigger.clip) : 'Nothing — stands alone'}
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
                  Nothing — stands alone
                </button>
                {scripts.map(({ row, clip }) => (
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

        {/* The gesture itself; the pencil opens the vocabulary. */}
        <div className="prop-panel__section cam-namerow">
          <span className="ix-gesture">
            <span className="prop-panel__emoji">{it.emoji}</span>
            <span className="prop-panel__tag">{it.label}</span>
          </span>
          <IconButton size={24} variant="ghost" aria-label="Edit the gesture" onClick={() => setPage('edit')}>
            <PencilSimple size={16} />
          </IconButton>
        </div>

        <div className="prop-panel__section">
          <div className="prop-panel__fields">
            <TimeField
              label="Start"
              value={it.start}
              max={it.end - MIN_CLIP_SEC}
              onCommit={(v) => onRetime('start', v)}
            />
            <TimeField
              label="End"
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
