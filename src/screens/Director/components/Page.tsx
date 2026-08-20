import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  CHARS,
  DEFAULT_TAKE,
  PLAYBACK_SCENE_ID,
  SCENES,
  TAKES,
  VERBS,
  verbClass,
  type Scene,
  type SceneTiming,
  type ScriptLine,
  type WordToken,
} from '../data';
import { CoverageMargin, type LineRect } from './CoverageMargin';

/* ----------------------------------------------------------------------------
   The script page: a layered document. Typeset layer = machine output; the
   amber layer = human judgment. Enters by unfolding out of its board card
   (FLIP), leaves by folding back into it.
   ---------------------------------------------------------------------------- */

export type DiveContext = {
  lineIdx: number;
  word: string;
  cx: number;
  cy: number;
  rect: DOMRect;
};

export type PageApi = {
  /** Where wheel-zoom should dive if the user isn't hovering a word. */
  getZoomTarget: () => { el: HTMLElement; lineIdx: number; word: string } | null;
  canScroll: (dir: 1 | -1) => boolean;
};

type PageProps = {
  scene: Scene;
  origin: DOMRect | null;
  leaving: boolean;
  getCardRect: () => DOMRect | null;
  playing: boolean;
  time: number;
  timing: SceneTiming | null;
  onDiveWord: (ctx: DiveContext) => void;
  onTogglePlay: () => void;
  verbMarks: Record<string, string>;
  onApplyVerb: (lineId: string, verb: string) => void;
  currentTake: number;
  onPickTake: (id: number) => void;
  coverageEnds: Record<string, number>;
  onCoverageCommit: (strokeId: string, endLine: number) => void;
  peeks: { prev: Scene | null; next: Scene | null };
  registerApi: (api: PageApi | null) => void;
  /** Frame sits on top — mute the page chrome underneath. */
  covered: boolean;
};

type VerbDrag = { verb: string; x: number; y: number };
type VerbSettle = { lineId: string; phase: 'working' | 'dried' };

export function Page({
  scene,
  origin,
  leaving,
  getCardRect,
  playing,
  time,
  timing,
  onDiveWord,
  onTogglePlay,
  verbMarks,
  onApplyVerb,
  currentTake,
  onPickTake,
  coverageEnds,
  onCoverageCommit,
  peeks,
  registerApi,
  covered,
}: PageProps) {
  const articleRef = useRef<HTMLElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lineEls = useRef<(HTMLDivElement | null)[]>([]);
  const hoverWord = useRef<{ el: HTMLElement; lineIdx: number; word: string } | null>(null);
  const defaultWord = useRef<{ el: HTMLElement; lineIdx: number; word: string } | null>(null);

  const [rects, setRects] = useState<LineRect[]>([]);
  const [articleH, setArticleH] = useState(0);
  const [entering, setEntering] = useState(origin != null);
  const [dragVerb, setDragVerb] = useState<VerbDrag | null>(null);
  const [hoverLine, setHoverLine] = useState<number | null>(null);
  const [verbSettle, setVerbSettle] = useState<VerbSettle | null>(null);
  const [splayOpen, setSplayOpen] = useState(false);
  const [pulseLine, setPulseLine] = useState<string | null>(null);

  const dragRef = useRef<VerbDrag | null>(null);
  dragRef.current = dragVerb;

  const isPerf = scene.id === PLAYBACK_SCENE_ID && timing != null;
  const teleprompter = playing && isPerf;

  /* --- Measure dialogue blocks so coverage anchors to lines, not pixels ---- */
  useLayoutEffect(() => {
    const measure = () => {
      const a = articleRef.current;
      if (!a) return;
      setRects(
        scene.lines.map((_, i) => {
          const el = lineEls.current[i];
          return el ? { top: el.offsetTop, bottom: el.offsetTop + el.offsetHeight } : { top: 0, bottom: 0 };
        }),
      );
      setArticleH(a.scrollHeight);
    };
    measure();
    document.fonts?.ready.then(measure);
    const ro = new ResizeObserver(measure);
    if (articleRef.current) ro.observe(articleRef.current);
    return () => ro.disconnect();
  }, [scene]);

  /* --- FLIP in: unfold from the board card ---------------------------------- */
  useLayoutEffect(() => {
    const el = articleRef.current;
    if (!el || !origin) return;
    const r = el.getBoundingClientRect();
    el.style.transformOrigin = '0 0';
    el.style.transform = `translate(${origin.x - r.x}px, ${origin.y - r.y}px) scale(${origin.width / r.width}, ${origin.height / r.height})`;
    el.style.opacity = '0.45';
    // flush, then release into place
    void el.offsetHeight;
    requestAnimationFrame(() => {
      el.style.transition =
        'transform 620ms cubic-bezier(0.3, 1, 0.4, 1), opacity 340ms ease-out';
      el.style.transform = '';
      el.style.opacity = '';
    });
    const t = window.setTimeout(() => {
      el.style.transition = '';
      setEntering(false);
    }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --- Reverse morph: fold back into the card ------------------------------- */
  useEffect(() => {
    if (!leaving) return;
    const el = articleRef.current;
    const card = getCardRect();
    if (!el || !card) return;
    const r = el.getBoundingClientRect();
    el.style.transformOrigin = '0 0';
    el.style.transition = 'transform 500ms cubic-bezier(0.5, 0, 0.55, 1), opacity 320ms 150ms ease-in';
    el.style.transform = `translate(${card.x - r.x}px, ${card.y - r.y}px) scale(${card.width / r.width}, ${card.height / r.height})`;
    el.style.opacity = '0';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving]);

  /* --- Zoom API for the wheel accumulator ----------------------------------- */
  useEffect(() => {
    registerApi({
      getZoomTarget: () => hoverWord.current ?? defaultWord.current,
      canScroll: (dir) => {
        const s = scrollRef.current;
        if (!s) return false;
        if (s.scrollHeight <= s.clientHeight + 2) return false;
        return dir === 1
          ? s.scrollTop + s.clientHeight < s.scrollHeight - 2
          : s.scrollTop > 2;
      },
    });
    return () => registerApi(null);
  }, [registerApi]);

  /* --- Teleprompter: karaoke + gentle auto-scroll --------------------------- */
  const activeLine = teleprompter
    ? (timing!.times.find((t) => time >= t.start && time < t.end)?.line ?? null)
    : null;
  const lastScrolled = useRef<number | null>(null);
  useEffect(() => {
    if (activeLine == null || activeLine === lastScrolled.current) return;
    lastScrolled.current = activeLine;
    lineEls.current[activeLine]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeLine]);

  const wordState = (li: number, wi: number): '' | 'sung' | 'on' => {
    if (!teleprompter) return '';
    const wt = timing!.map.get(`${li}:${wi}`);
    if (!wt) return '';
    if (time >= wt.start && time < wt.end) return 'on';
    return time >= wt.end ? 'sung' : '';
  };

  /* --- Verb deck drag -------------------------------------------------------- */
  const hitLine = (x: number, y: number): number | null => {
    // Blocks can genuinely overlap (the interruption), so pick the candidate
    // whose vertical centre is nearest — matches the visual stacking.
    let best: number | null = null;
    let bestD = Infinity;
    for (let i = 0; i < scene.lines.length; i++) {
      const el = lineEls.current[i];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (y < r.top - 8 || y > r.bottom + 8 || x < r.left - 120 || x > r.right + 60) continue;
      const d = Math.abs(y - (r.top + r.bottom) / 2);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  };

  const startVerbDrag = (verb: string, e: React.PointerEvent) => {
    e.preventDefault();
    setDragVerb({ verb, x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    if (!dragVerb) return;
    const mv = (e: PointerEvent) => {
      setDragVerb((d) => (d ? { ...d, x: e.clientX, y: e.clientY } : null));
      setHoverLine(hitLine(e.clientX, e.clientY));
    };
    const up = (e: PointerEvent) => {
      const li = hitLine(e.clientX, e.clientY);
      const verb = dragRef.current?.verb;
      if (li != null && verb) {
        const lineId = scene.lines[li].id;
        onApplyVerb(lineId, verb);
        setVerbSettle({ lineId, phase: 'working' });
        window.setTimeout(() => setVerbSettle({ lineId, phase: 'dried' }), 1500);
        window.setTimeout(() => setVerbSettle(null), 2700);
      }
      setDragVerb(null);
      setHoverLine(null);
    };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', mv);
      window.removeEventListener('pointerup', up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragVerb != null]);

  /* --- Takes ----------------------------------------------------------------- */
  useEffect(() => {
    if (!splayOpen) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setSplayOpen(false);
      }
    };
    window.addEventListener('keydown', key, { capture: true });
    return () => window.removeEventListener('keydown', key, { capture: true });
  }, [splayOpen]);

  const pickTake = (id: number, lineId: string) => {
    onPickTake(id);
    setSplayOpen(false);
    setPulseLine(lineId);
    window.setTimeout(() => setPulseLine(null), 950);
  };

  /* --- Coverage (line-anchored, with live overrides) ------------------------- */
  const strokes = scene.coverage.map((s) => ({
    ...s,
    endLine: coverageEnds[s.id] ?? s.endLine,
  }));
  const isCovered = (li: number) => strokes.some((s) => s.startLine <= li && s.endLine >= li);

  /* --- Render helpers --------------------------------------------------------- */

  const renderWords = (line: ScriptLine, li: number) => {
    // Group consecutive slow words into one run so the pace tooltip reads once.
    const out: React.ReactNode[] = [];
    let run: React.ReactNode[] = [];
    const flushRun = (key: string) => {
      if (run.length === 0) return;
      out.push(
        <span key={key} className="pg-run-slow" data-tip="pace: slow">
          {run}
        </span>,
      );
      run = [];
    };
    line.words.forEach((tok, wi) => {
      const node = renderWord(line, li, tok, wi);
      if (tok.slow) {
        run.push(node, ' ');
      } else {
        flushRun(`run-${wi}`);
        out.push(node, ' ');
      }
    });
    flushRun('run-end');
    return out;
  };

  const renderWord = (line: ScriptLine, li: number, tok: WordToken, wi: number) => {
    const state = wordState(li, wi);
    const isDefault = line.id === 's2-l2' && tok.t === 'weeks.';
    return (
      <span key={wi} style={{ whiteSpace: 'nowrap' }}>
        {tok.beatBefore && (
          <span className="pg-beat" data-tip="(beat)">
            <i />
          </span>
        )}
        <span
          className={`pg-w ${state} ${tok.overlapped ? 'ovl' : ''}`}
          ref={(el) => {
            if (isDefault && el) defaultWord.current = { el, lineIdx: li, word: tok.t };
          }}
          onPointerEnter={(e) => {
            hoverWord.current = { el: e.currentTarget, lineIdx: li, word: tok.t };
          }}
          onPointerLeave={() => {
            hoverWord.current = null;
          }}
          onDoubleClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            onDiveWord({ lineIdx: li, word: tok.t, cx: r.x + r.width / 2, cy: r.y + r.height / 2, rect: r });
          }}
        >
          {tok.t}
        </span>
      </span>
    );
  };

  const currentTakeInfo = TAKES.find((t) => t.id === currentTake);

  return (
    <div className={`dir-pagewrap ${leaving ? 'is-leaving' : ''} ${covered ? 'is-covered' : ''}`}>
      {/* Breadcrumbs: neighbouring scenes peek blurred at the screen edges. */}
      {peeks.prev && <PeekCard scene={peeks.prev} side="l" />}
      {peeks.next && <PeekCard scene={peeks.next} side="r" />}

      <div className="pg-scroll" ref={scrollRef}>
        <article
          className={`pg-page ${entering ? 'is-entering' : ''} ${teleprompter ? 'is-playing' : ''}`}
          ref={articleRef}
        >
          {/* The performance, faint behind the type while it plays. */}
          <div className={`pg-ghostvideo ${teleprompter ? 'is-on' : ''}`} aria-hidden>
            <i className="pg-grain" />
          </div>

          <div className="pg-cols">
            {/* Left margin: who's on the page. */}
            <aside className="pg-castcol" style={{ ['--i' as string]: 0 }}>
              {scene.cast.map((c) => (
                <img key={c} src={CHARS[c].avatar} alt={CHARS[c].name} style={{ borderColor: CHARS[c].text }} />
              ))}
            </aside>

            <div className="pg-textcol">
              <header className="pg-slug pg-bloom" style={{ ['--i' as string]: 0 }}>
                <h1>{scene.slug}</h1>
                <div className="pg-meta">
                  <span>
                    SCENE {scene.num} OF {SCENES.length}
                  </span>
                  <span className="pg-meta-dot">·</span>
                  <span>{scene.duration}</span>
                  <span className="pg-meta-dot">·</span>
                  <span className="pg-meta-cast">
                    {scene.cast.map((c) => (
                      <b key={c} style={{ color: CHARS[c].text, background: CHARS[c].bg }}>
                        {CHARS[c].name.toLowerCase()}
                      </b>
                    ))}
                  </span>
                </div>
              </header>

              {scene.lines.map((line, li) => {
                const char = CHARS[line.who];
                const verb = verbMarks[line.id];
                const uncoveredNow = line.uncovered && !isCovered(li);
                const settle = verbSettle?.lineId === line.id ? verbSettle.phase : null;
                return (
                  <div
                    key={line.id}
                    ref={(el) => {
                      lineEls.current[li] = el;
                    }}
                    className={[
                      'pg-block',
                      'pg-bloom',
                      line.interrupt ? 'pg-block--interrupt' : '',
                      uncoveredNow ? 'pg-block--uncovered' : '',
                      hoverLine === li ? 'is-drop' : '',
                      pulseLine === line.id ? 'is-pulse' : '',
                      settle === 'working' ? 'is-working' : '',
                    ].join(' ')}
                    style={{ ['--i' as string]: li + 1, ['--char' as string]: char.text }}
                  >
                    {/* Left margin annotations — the human ink. */}
                    <div className="pg-marginleft">
                      {line.note && (
                        <span className="pg-blocknote">
                          <svg viewBox="0 0 26 10" width="26" height="10">
                            <path d="M1 6 C7 4.4, 13 5.6, 20 4.6 M16 1.8 L21 4.4 L15.6 7.6" fill="none" stroke="#E8A15C" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          {line.note}
                        </span>
                      )}
                      {line.rejected && <span className="pg-rejected">{line.rejected}</span>}
                      {verb && (
                        <span className={`pg-verbchip ${settle === 'working' ? 'is-working' : 'is-dried'}`}>
                          {verb}
                          {settle === 'dried' && <b className="pg-check">✓</b>}
                        </span>
                      )}
                    </div>

                    <div className="pg-name">{char.name}</div>
                    <p className={`pg-text ${line.urgent ? 'pg-text--urgent' : ''} ${verb ? verbClass(verb) : ''}`}>
                      {renderWords(line, li)}
                      {line.hasTakes && (
                        <button
                          type="button"
                          className={`pg-takeschip ${splayOpen ? 'is-open' : ''}`}
                          onClick={() => setSplayOpen((v) => !v)}
                        >
                          3 takes{currentTake !== DEFAULT_TAKE && currentTakeInfo ? ` · ${currentTakeInfo.label}` : ''}
                        </button>
                      )}
                    </p>
                    {line.ghost && <p className="pg-ghosttext">{line.ghost}</p>}
                    {uncoveredNow && <span className="pg-uncovered-note">uncovered</span>}

                    {/* Takes splay — compact, above the punchline. */}
                    {line.hasTakes && splayOpen && (
                      <div className="pg-splay">
                        {TAKES.map((t, i) => (
                          <button
                            type="button"
                            key={t.id}
                            className={`pg-take ${t.id === currentTake ? 'is-current' : ''}`}
                            style={{ ['--i' as string]: i }}
                            onClick={() => pickTake(t.id, line.id)}
                          >
                            <span className="pg-take-label">
                              {t.label} · take {t.id}
                              {t.id === currentTake ? ' (current)' : ''}
                            </span>
                            <span className="pg-wave">
                              {Array.from({ length: 16 }, (_, b) => (
                                <i
                                  key={b}
                                  style={{
                                    ['--h' as string]: `${5 + Math.abs(Math.sin(b * 1.7 + t.id * 3)) * 11}px`,
                                    ['--d' as string]: `${b * 70}ms`,
                                  }}
                                />
                              ))}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Right margin: the lined script. System-tracked (teal), but the
                endpoints are draggable — a human deciding glows amber. */}
            <div className="pg-covcol">
              {rects.length > 0 && (
                <CoverageMargin strokes={strokes} rects={rects} height={articleH} onCommit={onCoverageCommit} />
              )}
            </div>
          </div>
        </article>
      </div>

      {/* The verb deck — direction you drag, never type. */}
      <div className="pg-deck">
        {VERBS.map((v, i) => {
          const mid = (VERBS.length - 1) / 2;
          return (
            <button
              type="button"
              key={v}
              className={`pg-verb ${dragVerb?.verb === v ? 'is-source' : ''}`}
              style={{ ['--r' as string]: `${(i - mid) * 3}deg`, ['--ty' as string]: `${Math.abs(i - mid) * 4}px` }}
              onPointerDown={(e) => startVerbDrag(v, e)}
            >
              {v}
            </button>
          );
        })}
      </div>

      {dragVerb && (
        <span className="pg-verbghost" style={{ left: dragVerb.x, top: dragVerb.y }}>
          {dragVerb.verb}
        </span>
      )}

      <button type="button" className={`pg-action ${playing ? 'is-playing' : ''}`} onClick={onTogglePlay}>
        {playing ? '◼ Cut' : '⏵ Action'}
      </button>
    </div>
  );
}

function PeekCard({ scene, side }: { scene: Scene; side: 'l' | 'r' }) {
  return (
    <div className={`pg-peek pg-peek--${side}`} aria-hidden>
      <div className="bd-thumb">
        <span className="bd-monogram">{scene.title[0]}</span>
      </div>
      <div className="bd-titlerow">
        <span className="bd-num">{scene.num}</span>
        <span className="bd-name">{scene.title}</span>
      </div>
    </div>
  );
}
