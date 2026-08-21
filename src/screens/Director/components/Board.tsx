import { useRef, useState } from 'react';
import { CHARS, PROJECT_TITLE, SCENES, sceneById, type Scene } from '../data';

/* Card grid geometry — cards are positioned absolutely from their slot index
   so reordering reflows with a pure transform transition (cheap FLIP). */
const CARD_W = 280;
const CARD_H = 226;
const GAP = 28;
const COLS = 3;

const slotXY = (i: number) => ({
  x: (i % COLS) * (CARD_W + GAP),
  y: Math.floor(i / COLS) * (CARD_H + GAP),
});

type DragState = {
  id: string;
  /** Pointer offset inside the card at grab time. */
  gx: number;
  gy: number;
  x: number;
  y: number;
  moved: boolean;
};

type BoardProps = {
  order: string[];
  onReorder: (order: string[]) => void;
  onOpen: (sceneId: string, el: HTMLElement) => void;
  registerCard: (id: string, el: HTMLDivElement | null) => void;
  onHoverCard: (id: string | null) => void;
  /** Faded + inert while a deeper altitude is on top. */
  dimmed: boolean;
  /** The card a page just unfolded from — kept invisible until we return. */
  hiddenId: string | null;
  playing: boolean;
  progress: number;
  playingSceneId: string;
  /** Pre-zoom stretch feedback from the wheel accumulator. */
  zoomHint: number;
};

export function Board({
  order,
  onReorder,
  onOpen,
  registerCard,
  onHoverCard,
  dimmed,
  hiddenId,
  playing,
  progress,
  playingSceneId,
  zoomHint,
}: BoardProps) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const startRef = useRef({ x: 0, y: 0 });

  const gridW = COLS * CARD_W + (COLS - 1) * GAP;
  const gridH = 2 * CARD_H + GAP;

  const onPointerDown = (scene: Scene, e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || dimmed) return;
    const grid = gridRef.current!.getBoundingClientRect();
    const idx = order.indexOf(scene.id);
    const slot = slotXY(idx);
    startRef.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({
      id: scene.id,
      gx: e.clientX - grid.left - slot.x,
      gy: e.clientY - grid.top - slot.y,
      x: slot.x,
      y: slot.y,
      moved: false,
    });
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const dist = Math.hypot(e.clientX - startRef.current.x, e.clientY - startRef.current.y);
    if (!drag.moved && dist < 5) return;
    const grid = gridRef.current!.getBoundingClientRect();
    const x = e.clientX - grid.left - drag.gx;
    const y = e.clientY - grid.top - drag.gy;
    setDrag({ ...drag, x, y, moved: true });

    // Nearest slot by card centre → live reorder, everyone else reflows.
    const cx = x + CARD_W / 2;
    const cy = y + CARD_H / 2;
    const col = Math.min(COLS - 1, Math.max(0, Math.round((cx - CARD_W / 2) / (CARD_W + GAP))));
    const row = Math.min(1, Math.max(0, Math.round((cy - CARD_H / 2) / (CARD_H + GAP))));
    const target = Math.min(order.length - 1, row * COLS + col);
    const from = order.indexOf(drag.id);
    if (target !== from) {
      const next = [...order];
      next.splice(from, 1);
      next.splice(target, 0, drag.id);
      onReorder(next);
    }
  };

  const onPointerUp = () => setDrag(null);

  return (
    <div className={`dir-board ${dimmed ? 'is-dim' : ''}`} aria-hidden={dimmed}>
      <header className="bd-header">
        <h1 className="bd-title">{PROJECT_TITLE}</h1>
        <p className="bd-sub">{SCENES.length} scenes · 3:49 · 3 cast</p>
      </header>

      <div
        className="bd-grid"
        ref={gridRef}
        style={{
          width: gridW,
          height: gridH,
          transform: zoomHint ? `scale(${1 + zoomHint})` : undefined,
        }}
      >
        {order.map((id) => {
          const scene = sceneById(id);
          const idx = order.indexOf(id);
          const isDrag = drag?.id === id;
          const pos = isDrag && drag.moved ? { x: drag.x, y: drag.y } : slotXY(idx);
          const isCurrent = playing && id === playingSceneId;
          return (
            <div
              key={id}
              className={`bd-slot ${isDrag && drag.moved ? 'is-drag' : ''} ${id === hiddenId ? 'is-hidden' : ''}`}
              style={{ width: CARD_W, transform: `translate(${pos.x}px, ${pos.y}px)` }}
              onPointerDown={(e) => onPointerDown(scene, e)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerEnter={() => onHoverCard(id)}
              onPointerLeave={() => onHoverCard(null)}
              onDoubleClick={(e) => onOpen(id, e.currentTarget)}
            >
            <div className="bd-card" ref={(el) => registerCard(id, el)}>
              <div className="bd-thumb">
                <span className="bd-monogram">{scene.title[0]}</span>
                {isCurrent && (
                  <span className="bd-live">
                    <i /> playing
                  </span>
                )}
              </div>
              <div className="bd-titlerow">
                <span className="bd-num">{scene.num}</span>
                <span className="bd-name">{scene.title}</span>
              </div>
              <p className="bd-summary">{scene.summary}</p>
              <div className="bd-foot">
                <span className="bd-cast">
                  {scene.cast.map((c) => (
                    <i key={c} style={{ background: CHARS[c].text }} title={CHARS[c].name} />
                  ))}
                </span>
                <span className="bd-dur">{scene.duration}</span>
              </div>

              {/* Seed of the annotation language at this altitude: a human,
                  hand-drawn circled take number. Amber is reserved for people. */}
              {scene.circledTake != null && (
                <span className="bd-takemark">
                  <svg viewBox="0 0 46 40" width="46" height="40">
                    <path
                      d="M23 4 C34 3, 43 9, 42 19 C41 30, 33 37, 22 36 C11 35, 3 29, 4 19 C5 10, 13 5, 24 5"
                      fill="none"
                      stroke="#E8A15C"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                    <path
                      d="M25 3 C35 4, 44 10, 43 20 C42 31, 32 38, 21 37"
                      fill="none"
                      stroke="#E8A15C"
                      strokeWidth="1"
                      strokeLinecap="round"
                      opacity="0.6"
                    />
                  </svg>
                  <b>{scene.circledTake}</b>
                </span>
              )}

              {isCurrent && (
                <span className="bd-progress" style={{ width: `${progress * 100}%` }} />
              )}
            </div>
            </div>
          );
        })}

        {/* Ghost slot — always the last position, not draggable. */}
        <div
          className="bd-slot"
          style={{ width: CARD_W, transform: `translate(${slotXY(order.length).x}px, ${slotXY(order.length).y}px)` }}
        >
          <div className="bd-card bd-card--ghost" style={{ height: CARD_H - 16 }}>
            <span>+ New scene</span>
          </div>
        </div>
      </div>
    </div>
  );
}
