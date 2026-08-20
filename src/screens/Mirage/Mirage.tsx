import { useCallback, useEffect, useRef, useState } from 'react';
import { Animator } from '../Animator/Animator';
import { Corkboard } from './components/Corkboard';
import { EditorHeader } from './components/EditorHeader';
import { HomePrompt } from './components/HomePrompt';
import {
  makeInsertedScene,
  PROJECT_TITLE,
  PROMPT_TEXT,
  SCENES,
  sceneById,
  type Scene,
  type ScenePatch,
} from './data';
import { useMaterialization } from './useMaterialization';
import { useZoomGesture, type ZoomFocus } from './useZoomGesture';
import { MORPH_MS, flightIn, flightOut, grabVideoFrame, type RectMap } from './levelFlight';
import './mirage.css';

/* ----------------------------------------------------------------------------
   The Mirage editor: one prompt screen, then one continuous zoom with two
   stops. Level 1 arranges scenes on the corkboard, Level 2 touches individual
   frames (the Animator timeline). Navigation IS the
   zoom — trackpad pinch / touch pinch / clicks all travel the same axis, and
   every scale transition is anchored to the gesture's focus point.
   ---------------------------------------------------------------------------- */

type Level = 1 | 2;
type Dir = 'in' | 'out';

/** Everything the shared-element flight must remember across the level swap:
 *  rects are captured from the OUTGOING level's DOM in `travel`, targets are
 *  measured on the incoming level once it has mounted. */
type MorphArgs =
  | { dir: 'in'; selectedId: string; sources: RectMap; cardRadius: string }
  | {
      dir: 'out';
      selectedId: string;
      preview: DOMRect;
      previewRadius: string;
      slots: RectMap;
      slotRadius: string;
      videoFrame: string | null;
    };

// Scene-insertion UX under comparison: 'reticle' (clicking a gap glides it
// under the crosshair, which morphs into the node) is the default; add
// ?insert=node to try 'unified' (the node also jumps to hovered gaps).
const INSERT_MODE: 'reticle' | 'unified' =
  new URLSearchParams(window.location.search).get('insert') === 'node' ? 'unified' : 'reticle';

export function Mirage() {
  const [stage, setStage] = useState<'home' | 'editor'>('home');
  const [level, setLevel] = useState<Level>(1);
  const [lastDir, setLastDir] = useState<Dir>('in');
  const [travelCount, setTravelCount] = useState(0);
  const [sceneId, setSceneId] = useState(SCENES[0].id);
  const [scenes, setScenes] = useState<Scene[]>(SCENES);
  const [hint, setHint] = useState(0);
  // Level 3's chat panel — owned here so the fixed header's toggles reach it.
  const [chatOpen, setChatOpen] = useState(true);

  const mat = useMaterialization();

  const rootRef = useRef<HTMLDivElement | null>(null);
  const levelRef = useRef<Level>(level);
  levelRef.current = level;
  const lock = useRef(0);
  const cardEls = useRef<Record<string, HTMLDivElement | null>>({});
  const hoverCard = useRef<string | null>(null);
  // The corkboard's viewfinder reticle: the scene under it is the pinch-zoom
  // target, and its crosshair is the scale transition's anchor point.
  const reticleScene = useRef<string | null>(null);
  const reticleEl = useRef<HTMLElement | null>(null);
  // Mirrors for values `travel` must read synchronously (state lags a frame).
  const sceneIdRef = useRef(SCENES[0].id);
  const scenesRef = useRef(scenes);
  scenesRef.current = scenes;
  /** The in-flight shared-element morph, captured by `travel`, flown by the
   *  effect below once the incoming level has mounted. */
  const morphArgs = useRef<MorphArgs | null>(null);

  const locked = () => Date.now() < lock.current;

  /** The zoom viewport: the content stage below the fixed header. All scale
   *  transforms happen inside it, so the chrome never moves. */
  const stageRef = useRef<HTMLDivElement | null>(null);

  /** Anchor the next scale transition to the gesture/click focus point,
   *  expressed in the stage's own coordinates (the header sits outside the
   *  transformed tree and must not shift the pivot). */
  const setFocus = useCallback((focus: ZoomFocus) => {
    const stage = stageRef.current;
    if (!stage) return;
    const r = stage.getBoundingClientRect();
    stage.style.setProperty('--zoom-x', `${focus.x - r.left}px`);
    stage.style.setProperty('--zoom-y', `${focus.y - r.top}px`);
  }, []);

  const focusOf = (el: HTMLElement): ZoomFocus => {
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  };

  /** Level travel IS the shared-element flight: capture the outgoing level's
   *  shared rects here, swap the level, and let the effect below fly the
   *  clones once the incoming level has mounted. */
  const travel = useCallback(
    (next: Level, dir: Dir, focus?: ZoomFocus) => {
      if (locked() || next === levelRef.current) return;
      lock.current = Date.now() + MORPH_MS + 300;
      if (focus) setFocus(focus);
      setHint(0);
      setLastDir(dir);

      const stageEl = stageRef.current;
      const selectedId = sceneIdRef.current;
      morphArgs.current = null;
      if (stageEl) {
        if (dir === 'in') {
          // Every viewport-visible card thumbnail is a flight source.
          const sources: RectMap = new Map();
          let cardRadius = '12px';
          for (const s of scenesRef.current) {
            const thumb = cardEls.current[s.id]?.querySelector('.mir-card__thumb');
            if (!(thumb instanceof HTMLElement)) continue;
            const r = thumb.getBoundingClientRect();
            if (r.width > 0 && r.right > 0 && r.left < window.innerWidth) {
              sources.set(s.id, r);
              cardRadius = getComputedStyle(thumb).borderRadius || cardRadius;
            }
          }
          morphArgs.current = { dir, selectedId, sources, cardRadius };
        } else {
          // Leaving the canvas: the preview frame and every strip slot are the
          // sources — measured NOW, before Level 2 unmounts.
          const preview = stageEl.querySelector('.anim-preview');
          const slots: RectMap = new Map();
          let slotRadius = '4.77px';
          stageEl.querySelectorAll<HTMLElement>('.anim-strip [data-scene]').forEach((el) => {
            if (el.dataset.scene) slots.set(el.dataset.scene, el.getBoundingClientRect());
            slotRadius = getComputedStyle(el).borderRadius || slotRadius;
          });
          if (preview instanceof HTMLElement) {
            morphArgs.current = {
              dir,
              selectedId,
              preview: preview.getBoundingClientRect(),
              previewRadius: getComputedStyle(preview).borderRadius || '16px',
              slots,
              slotRadius,
              videoFrame: grabVideoFrame(stageEl),
            };
          }
        }
        // Hide the REAL shared elements while their clones fly (mirage.css).
        if (morphArgs.current) stageEl.dataset.morph = dir;
      }

      setTravelCount((n) => n + 1);
      setLevel(next);
    },
    [setFocus],
  );

  /* The flight itself: after the incoming level mounts, measure the landing
     rects, fly the clones, then reveal the real UI under a quick crossfade. */
  useEffect(() => {
    const args = morphArgs.current;
    if (!args) return;
    morphArgs.current = null;

    const finish = (overlay: HTMLElement | null) => {
      const stageEl = stageRef.current;
      if (stageEl) delete stageEl.dataset.morph;
      if (overlay) {
        overlay
          .animate([{ opacity: 1 }, { opacity: 0 }], {
            duration: 180,
            easing: 'ease-out',
            fill: 'forwards',
          })
          .finished.catch(() => undefined)
          .finally(() => overlay.remove());
      }
    };

    // Two frames so the incoming level has fully laid out before measuring.
    requestAnimationFrame(() =>
      requestAnimationFrame(async () => {
        const stageEl = stageRef.current;
        const order = scenesRef.current.map((s) => ({ id: s.id, thumb: s.thumb }));
        if (!stageEl) return finish(null);
        try {
          if (args.dir === 'in') {
            const preview = stageEl.querySelector('.anim-preview');
            const slots: RectMap = new Map();
            let slotRadius = '4.77px';
            stageEl.querySelectorAll<HTMLElement>('.anim-strip [data-scene]').forEach((el) => {
              if (el.dataset.scene) slots.set(el.dataset.scene, el.getBoundingClientRect());
              slotRadius = getComputedStyle(el).borderRadius || slotRadius;
            });
            if (!(preview instanceof HTMLElement) || slots.size === 0) return finish(null);
            const overlay = await flightIn({
              order,
              selectedId: args.selectedId,
              sources: args.sources,
              preview: preview.getBoundingClientRect(),
              slots,
              radii: {
                card: args.cardRadius,
                preview: getComputedStyle(preview).borderRadius || '16px',
                slot: slotRadius,
              },
            });
            finish(overlay);
          } else {
            const targets: RectMap = new Map();
            let cardRadius = '12px';
            for (const s of scenesRef.current) {
              const thumb = cardEls.current[s.id]?.querySelector('.mir-card__thumb');
              if (!(thumb instanceof HTMLElement)) continue;
              const r = thumb.getBoundingClientRect();
              if (r.width > 0 && r.right > 0 && r.left < window.innerWidth) {
                targets.set(s.id, r);
                cardRadius = getComputedStyle(thumb).borderRadius || cardRadius;
              }
            }
            const overlay = await flightOut({
              order,
              selectedId: args.selectedId,
              preview: args.preview,
              slots: args.slots,
              videoFrame: args.videoFrame,
              targets,
              radii: { card: cardRadius, preview: args.previewRadius, slot: args.slotRadius },
            });
            finish(overlay);
          }
        } catch {
          finish(null);
        }
      }),
    );
  }, [travelCount]);

  /* --- Level travel wired to gestures ---------------------------------------- */

  const zoomIn = useCallback(
    (focus?: ZoomFocus) => {
      if (level === 1) {
        // The reticle is the viewfinder: zooming in always expands into
        // whichever card sits under it, pivoting on the crosshair itself.
        const id = reticleScene.current ?? hoverCard.current ?? sceneId;
        sceneIdRef.current = id;
        setSceneId(id);
        const anchor = reticleEl.current
          ? focusOf(reticleEl.current)
          : (focus ?? (cardEls.current[id] ? focusOf(cardEls.current[id]!) : undefined));
        travel(2, 'in', anchor);
      }
    },
    [level, sceneId, travel],
  );

  const zoomOut = useCallback(
    (focus?: ZoomFocus) => {
      if (level === 2) travel(1, 'out', focus);
    },
    [level, travel],
  );

  useZoomGesture(rootRef, {
    onZoomIn: (f) => stage === 'editor' && zoomIn(f),
    onZoomOut: (f) => stage === 'editor' && zoomOut(f),
    onHint: (p, f) => {
      if (stage !== 'editor') return;
      // On the corkboard the reticle is the pivot; elsewhere the cursor is.
      if (level === 1 && reticleEl.current) setFocus(focusOf(reticleEl.current));
      else if (f) setFocus(f);
      // No hint past the ends of the zoom axis.
      if ((level === 2 && p > 0) || (level === 1 && p < 0)) p = 0;
      setHint(locked() ? 0 : p);
    },
  });

  useEffect(() => {
    if (stage !== 'editor') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') zoomOut();
      else if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        zoomIn();
      } else if ((e.metaKey || e.ctrlKey) && e.key === '-') {
        e.preventDefault();
        zoomOut();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stage, zoomIn, zoomOut]);

  /* --- Actions ----------------------------------------------------------------- */

  // "Create my video →": no loading screen — straight to the corkboard, where
  // scene cards materialize while the renders cook in the background.
  const createVideo = () => {
    setStage('editor');
    mat.begin();
  };

  const openScene = (id: string, el: HTMLElement) => {
    sceneIdRef.current = id;
    setSceneId(id);
    travel(2, 'in', focusOf(el));
  };

  const insertScene = (afterIndex: number, prompt?: string) => {
    const inserted = makeInsertedScene(`inserted-${Date.now()}`, prompt);
    setScenes((list) => {
      const next = [...list];
      next.splice(afterIndex + 1, 0, inserted);
      return next.map((s, i) => ({ ...s, num: i + 1 }));
    });
    mat.cook(inserted.id);
  };

  const editScene = (id: string, patch: ScenePatch, opts?: { recook?: boolean }) => {
    setScenes((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    // Generative edits (summary, duration, cast) send the scene back to the
    // renderer: the thumbnail re-blurs and sharpens when the new take lands.
    if (opts?.recook) mat.recook(id);
  };

  const reorderScene = (id: string, beforeId: string | null) => {
    setScenes((list) => {
      const moving = list.find((s) => s.id === id);
      if (!moving) return list;
      const rest = list.filter((s) => s.id !== id);
      let at: number;
      if (beforeId) {
        at = rest.findIndex((s) => s.id === beforeId);
        if (at < 0) at = rest.length;
      } else {
        // "After the last card": past every spawned scene, before any still
        // materializing at the tail.
        let lastSpawned = -1;
        rest.forEach((s, i) => {
          if (mat.spawnedIds.includes(s.id)) lastSpawned = i;
        });
        at = lastSpawned + 1;
      }
      rest.splice(at, 0, moving);
      return rest.map((s, i) => ({ ...s, num: i + 1 }));
    });
  };

  const jumpTo = (target: Level) => {
    if (target === level) return;
    if (target > level && level === 1) {
      const id = reticleScene.current ?? hoverCard.current ?? sceneId;
      sceneIdRef.current = id;
      setSceneId(id);
    }
    travel(target, target > level ? 'in' : 'out');
  };

  /* --- Render -------------------------------------------------------------------- */

  if (stage === 'home') {
    return (
      <div className="mir" ref={rootRef}>
        <HomePrompt onCreate={createVideo} />
      </div>
    );
  }

  const activeScene = scenes.find((s) => s.id === sceneId) ?? sceneById(sceneId);

  /** Context title per level — the meter keeps both mounted so a title can
   *  furl closed while the next one unfurls. */
  const headerLabels: [string, string] = [
    PROJECT_TITLE,
    `Scene ${activeScene.num}: ${activeScene.title}`,
  ];

  /** Only the content below the fixed header — this is what the zoom scales. */
  const renderContent = (l: Level) => {
    if (l === 2) {
      return (
        <Animator
          chromeless
          chatOpen={chatOpen}
          onToggleChat={() => setChatOpen((v) => !v)}
          strip={{
            scenes: scenes.map((s) => ({ id: s.id, thumb: s.thumb })),
            onExit: () => zoomOut(),
          }}
          chatContent={
            <div className="mir-chatlog">
              <p className="mir-chatlog__user">{PROMPT_TEXT}</p>
              <p className="mir-chatlog__assistant">
                I’m setting up a warm, handheld kitchen scene for Olivia and Blake, figuring out
                how to make the dialogue feel unscripted.
              </p>
              <p className="mir-chatlog__status">
                <span className="mir-chatlog__spinner" aria-hidden />
                <span className="mir-chatlog__status-text">Completing 2 actions</span>
                <span className="mir-chatlog__status-chevron" aria-hidden>
                  ›
                </span>
              </p>
            </div>
          }
        />
      );
    }
    return (
      <div className="mir-editor__canvas">
        <Corkboard
                scenes={scenes}
                spawnedIds={mat.spawnedIds}
                readyMap={mat.readyMap}
                insertMode={INSERT_MODE}
                initialCenterId={lastDir === 'out' ? sceneId : null}
                onOpenScene={openScene}
                onInsertScene={insertScene}
                onEditScene={editScene}
                onReorderScene={reorderScene}
                registerCard={(id, el) => {
                  cardEls.current[id] = el;
                }}
                onHoverCard={(id) => {
                  hoverCard.current = id;
                }}
                onReticleScene={(id) => {
                  reticleScene.current = id;
                }}
                registerReticle={(el) => {
                  reticleEl.current = el;
                }}
              />
      </div>
    );
  };

  return (
    <div className="mir" ref={rootRef}>
      {/* Fixed chrome: window frame + header live OUTSIDE the zoom viewport,
          so travel transforms never touch them — the depth meter's pill just
          glides while the canvas underneath scales. */}
      <div className="mir-editor">
        <div className="mir-editor__window">
          <EditorHeader
            level={level}
            labels={headerLabels}
            onJump={jumpTo}
            chatOpen={chatOpen}
            onToggleChat={() => setChatOpen((v) => !v)}
          />
          <div className="mir-stage" ref={stageRef}>
            <div
              key={`level-${level}-${travelCount}`}
              /* Level travel is the shared-element flight now — the old scale
                 entrance only plays on the editor's very first mount. */
              className={`mir-level ${travelCount === 0 ? 'mir-level--enter-in' : ''}`}
              style={hint ? { transform: `scale(${1 + hint * 0.035})` } : undefined}
            >
              {renderContent(level)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
