import { useCallback, useEffect, useRef, useState } from 'react';
import { AltitudeDots, type Altitude } from './components/AltitudeDots';
import { Board } from './components/Board';
import { Frame, type Eyeline } from './components/Frame';
import { Page, type DiveContext, type PageApi } from './components/Page';
import {
  DEFAULT_TAKE,
  PLAYBACK_SCENE_ID,
  S2_TIMING,
  SCENES,
  sceneById,
  type CharId,
} from './data';
import { usePlaybackClock } from './usePlaybackClock';
import './director.css';

/* ----------------------------------------------------------------------------
   One continuous zoom, three discrete stops. BOARD arranges, PAGE directs,
   FRAME touches. Navigation is the zoom itself: wheel / pinch / cmd± /
   double-click down, Escape up. Transitions are morphs, never free-floating.
   ---------------------------------------------------------------------------- */

const WHEEL_THRESHOLD = 320;

type FrameCtx = DiveContext & { sceneId: string };

export function Director() {
  const [alt, setAlt] = useState<Altitude>('board');
  const [order, setOrder] = useState<string[]>(() => SCENES.map((s) => s.id));
  const [sceneId, setSceneId] = useState(PLAYBACK_SCENE_ID);
  const [pageOrigin, setPageOrigin] = useState<DOMRect | null>(null);
  const [pageLeaving, setPageLeaving] = useState(false);
  const [frameCtx, setFrameCtx] = useState<FrameCtx | null>(null);
  const [frameLeaving, setFrameLeaving] = useState(false);
  const [zoomHint, setZoomHint] = useState(0);

  /* Direction state — persists across altitude travel. */
  const [verbMarks, setVerbMarks] = useState<Record<string, string>>({});
  const [currentTake, setCurrentTake] = useState(DEFAULT_TAKE);
  const [coverageEnds, setCoverageEnds] = useState<Record<string, number>>({});
  const [eyelines, setEyelines] = useState<Record<CharId, Eyeline>>({
    jess: 'camera',
    kai: 'camera',
    midas: 'camera',
  });

  const clock = usePlaybackClock(S2_TIMING.total);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const lock = useRef(0);
  const cardEls = useRef<Record<string, HTMLDivElement | null>>({});
  const hoverCard = useRef<string | null>(null);
  const pageApi = useRef<PageApi | null>(null);
  const wheelAcc = useRef(0);
  const wheelTimer = useRef(0);

  const locked = () => Date.now() < lock.current;
  const takeLock = (ms: number) => {
    lock.current = Date.now() + ms;
  };

  /* --- Travel ----------------------------------------------------------------- */

  const goPage = useCallback((id: string, el: HTMLElement | null) => {
    if (locked()) return;
    takeLock(750);
    setSceneId(id);
    setPageOrigin(el ? el.getBoundingClientRect() : null);
    setAlt('page');
  }, []);

  const leavePage = useCallback(() => {
    if (locked()) return;
    takeLock(600);
    setPageLeaving(true);
    window.setTimeout(() => {
      setAlt('board');
      setPageLeaving(false);
      setPageOrigin(null);
    }, 540);
  }, []);

  const diveWord = useCallback(
    (ctx: DiveContext) => {
      if (locked()) return;
      takeLock(800);
      setFrameCtx({ ...ctx, sceneId });
      setAlt('frame');
    },
    [sceneId],
  );

  const leaveFrame = useCallback(() => {
    if (locked()) return;
    takeLock(700);
    setFrameLeaving(true);
    window.setTimeout(() => {
      setAlt('page');
      setFrameCtx(null);
      setFrameLeaving(false);
    }, 620);
  }, []);

  const zoomIn = useCallback(() => {
    if (alt === 'board') {
      const id = hoverCard.current ?? PLAYBACK_SCENE_ID;
      goPage(id, cardEls.current[id] ?? null);
    } else if (alt === 'page') {
      const target = pageApi.current?.getZoomTarget();
      if (!target) return;
      const r = target.el.getBoundingClientRect();
      diveWord({ lineIdx: target.lineIdx, word: target.word, cx: r.x + r.width / 2, cy: r.y + r.height / 2, rect: r });
    }
  }, [alt, goPage, diveWord]);

  const zoomOut = useCallback(() => {
    if (alt === 'frame') leaveFrame();
    else if (alt === 'page') leavePage();
  }, [alt, leaveFrame, leavePage]);

  const jumpTo = useCallback(
    (target: Altitude) => {
      const depth = { board: 0, page: 1, frame: 2 };
      if (target === alt || locked()) return;
      if (depth[target] < depth[alt]) {
        zoomOut();
        if (depth[alt] - depth[target] > 1) window.setTimeout(() => zoomOut(), 680);
      } else {
        zoomIn();
        if (depth[target] - depth[alt] > 1) window.setTimeout(() => zoomIn(), 780);
      }
    },
    [alt, zoomIn, zoomOut],
  );

  /* --- Wheel / pinch: the zoom is the navigation ------------------------------- */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onWheel = (e: WheelEvent) => {
      const pinch = e.ctrlKey;
      // On the page, a plain wheel scrolls the script if there is anywhere to
      // go; the altitude only changes once the page has nothing left to give.
      if (!pinch && alt === 'page' && pageApi.current?.canScroll(e.deltaY > 0 ? 1 : -1)) return;
      e.preventDefault();
      if (locked()) return;
      wheelAcc.current += -e.deltaY * (pinch ? 4 : 1);
      const hint = Math.max(-0.045, Math.min(0.045, wheelAcc.current / 9000));
      setZoomHint(hint);
      window.clearTimeout(wheelTimer.current);
      wheelTimer.current = window.setTimeout(() => {
        wheelAcc.current = 0;
        setZoomHint(0); // gently snap back — no free-floating in-between states
      }, 220);
      if (wheelAcc.current > WHEEL_THRESHOLD) {
        wheelAcc.current = 0;
        setZoomHint(0);
        zoomIn();
      } else if (wheelAcc.current < -WHEEL_THRESHOLD) {
        wheelAcc.current = 0;
        setZoomHint(0);
        zoomOut();
      }
    };
    root.addEventListener('wheel', onWheel, { passive: false });
    return () => root.removeEventListener('wheel', onWheel);
  }, [alt, zoomIn, zoomOut]);

  /* --- Keyboard ----------------------------------------------------------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        zoomOut();
      } else if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        zoomIn();
      } else if ((e.metaKey || e.ctrlKey) && e.key === '-') {
        e.preventDefault();
        zoomOut();
      } else if (e.key === ' ') {
        e.preventDefault();
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        clock.toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomIn, zoomOut, clock]);

  /* --- Derived ------------------------------------------------------------------- */

  const scene = sceneById(sceneId);
  const idx = order.indexOf(sceneId);
  const peeks = {
    prev: idx > 0 ? sceneById(order[idx - 1]) : null,
    next: idx < order.length - 1 ? sceneById(order[idx + 1]) : null,
  };

  /** A character's current direction: the last verb landed on one of their lines. */
  const verbFor = (c: CharId) => {
    const lines = [...scene.lines].reverse();
    const hit = lines.find((l) => l.who === c && verbMarks[l.id]);
    if (hit) return verbMarks[hit.id];
    return c === 'jess' ? 'to confide' : '—';
  };

  const registerApi = useCallback((api: PageApi | null) => {
    pageApi.current = api;
  }, []);

  return (
    <div className="dir" ref={rootRef}>
      <Board
        order={order}
        onReorder={setOrder}
        onOpen={goPage}
        registerCard={(id, el) => {
          cardEls.current[id] = el;
        }}
        onHoverCard={(id) => {
          hoverCard.current = id;
        }}
        dimmed={alt !== 'board' && !pageLeaving}
        hiddenId={alt !== 'board' || pageLeaving ? sceneId : null}
        playing={clock.playing}
        progress={clock.progress}
        playingSceneId={PLAYBACK_SCENE_ID}
        zoomHint={alt === 'board' ? zoomHint : 0}
      />

      {alt !== 'board' && (
        <Page
          key={sceneId}
          scene={scene}
          origin={pageOrigin}
          leaving={pageLeaving}
          getCardRect={() => cardEls.current[sceneId]?.getBoundingClientRect() ?? null}
          playing={clock.playing}
          time={clock.time}
          timing={sceneId === PLAYBACK_SCENE_ID ? S2_TIMING : null}
          onDiveWord={diveWord}
          onTogglePlay={clock.toggle}
          verbMarks={verbMarks}
          onApplyVerb={(lineId, verb) => setVerbMarks((m) => ({ ...m, [lineId]: verb }))}
          currentTake={currentTake}
          onPickTake={setCurrentTake}
          coverageEnds={coverageEnds}
          onCoverageCommit={(id, endLine) => setCoverageEnds((m) => ({ ...m, [id]: endLine }))}
          peeks={peeks}
          registerApi={registerApi}
          covered={alt === 'frame'}
        />
      )}

      {frameCtx && (
        <Frame
          ctx={frameCtx}
          scene={sceneById(frameCtx.sceneId)}
          leaving={frameLeaving}
          playing={clock.playing}
          progress={clock.progress}
          eyelines={eyelines}
          onEyeline={(c, e) => setEyelines((m) => ({ ...m, [c]: e }))}
          verbFor={verbFor}
        />
      )}

      <AltitudeDots current={alt} onJump={jumpTo} />
    </div>
  );
}
