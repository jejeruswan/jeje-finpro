import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ListBullets, PencilSimple, Plus, Trash, X } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'motion/react';
import { ViewfinderReticle } from '../../../assets/icons';
import {
  AVATARS,
  boardMeta,
  formatTimecode,
  PLAYBACK_SCENE_MS,
  sceneStarts,
  type AvatarId,
  type Scene,
  type ScenePatch,
} from '../data';
import { SceneCard } from './SceneCard';

/** How reordered/inserted cards glide to their new slots. */
const SLOT_TRANSITION = { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const };
/** A deleted card's death: shrink-fade in place (popped out of the layout
 *  flow, so the neighbors close ranks over it at the same time). */
const SLOT_EXIT = {
  opacity: 0,
  scale: 0.86,
  transition: { duration: 0.22, ease: [0.2, 0, 0, 1] as const },
};

/**
 * What sits under the viewfinder reticle: either a scene card (focus mode) or
 * a gap (insertion mode). Indices are into the *visible* (already-spawned)
 * card list; `afterVisible: -1` is the run-in before the first card, and
 * `afterVisible: length - 1` the run-out after the last.
 */
type ReticleState =
  | { mode: 'card'; id: string; index: number }
  | { mode: 'gap'; afterVisible: number };

/**
 * Level 1 — the corkboard (Raw 04/05/06/07). A single horizontally scrolling
 * row of scene cards over the dark canvas, with:
 *  - a fixed crosshair reticle at the canvas center: cards slide underneath
 *    it, the card under it carries the focus highlight, and when a gap lands
 *    under it the crosshair morphs into a (+) node that opens a prompt box to
 *    generate a scene at that exact sequence position
 *  - Space starts playback: the strip auto-scrolls so the playing card stays
 *    locked under the reticle
 *  - a "Scenes" pill that opens the jump-to drawer (Raw 06)
 *  - hover gaps between cards that grow a floating + insertion node (Raw 07)
 *  - a scrubber pill (the "3/8" readout): hovering expands a micro-strip of
 *    scene thumbnails, and clicking/dragging jumps the strip so that scene
 *    locks under the reticle
 * Cards materialize sequentially while the project generates; the row is live
 * and navigable the entire time.
 */
export function Corkboard({
  scenes,
  videoCast,
  onAddAvatar,
  spawnedIds,
  readyMap,
  insertMode = 'reticle',
  initialCenterId = null,
  onOpenScene,
  onInsertScene,
  onEditScene,
  onDeleteScene,
  onReorderScene,
  registerCard,
  onHoverCard,
  onReticleScene,
  registerReticle,
}: {
  scenes: Scene[];
  /** The video's cast — the avatars scenes can pull from (see Mirage). */
  videoCast: AvatarId[];
  /** Add a library avatar to the video's cast (the meta row's +). */
  onAddAvatar: (id: AvatarId) => void;
  spawnedIds: string[];
  readyMap: Record<string, boolean>;
  /**
   * How scene insertion works:
   *  - 'reticle': the viewfinder is the single editing locus — clicking a gap
   *    glides it under the reticle, where the crosshair morphs into the node.
   *  - 'unified': one node, two summons — the node also jumps to a hovered gap.
   */
  insertMode?: 'reticle' | 'unified';
  /** Mount with this scene already under the reticle — set when arriving back
   *  from the frame canvas, so the zoom-out lands on the scene it left. */
  initialCenterId?: string | null;
  onOpenScene: (id: string, el: HTMLElement) => void;
  /** Insert a BLANK scene after this index and return its id — the new card
   *  opens directly in its edit posture (see startInsert). */
  onInsertScene: (afterIndex: number) => string;
  /** Apply an edit to a scene; `recook` marks its render stale. */
  onEditScene: (id: string, patch: ScenePatch, opts?: { recook?: boolean }) => void;
  /** Remove a scene from the sequence (the trash under a hovered card). */
  onDeleteScene: (id: string) => void;
  /** Move a scene before `beforeId` (null = after the last visible card). */
  onReorderScene: (id: string, beforeId: string | null) => void;
  registerCard: (id: string, el: HTMLDivElement | null) => void;
  onHoverCard: (id: string | null) => void;
  /** Reports which scene sits under the reticle — the pinch-zoom target. */
  onReticleScene: (id: string | null) => void;
  /** Hands the reticle element up so zoom transitions can anchor to it. */
  registerReticle: (el: HTMLElement | null) => void;
}) {
  const unified = insertMode === 'unified';
  const boardRef = useRef<HTMLDivElement | null>(null);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const cardEls = useRef<Record<string, HTMLDivElement | null>>({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [reticle, setReticle] = useState<ReticleState>({ mode: 'card', id: scenes[0].id, index: 0 });
  // "One node, two summons": a single insertion node serves both entry paths.
  // It sits in the gap under the reticle by default and jumps to whichever gap
  // the cursor hovers (hover wins); it is never shown twice.
  const [hoverGap, setHoverGap] = useState<number | null>(null);
  /** A just-inserted, never-committed scene: it mounts straight into the edit
   *  posture (the card IS the prompt box), and backing out deletes it. The ref
   *  mirrors the state so commit/discard — which fire back to back in one
   *  event — read the current value, not a stale closure. */
  const [draftId, setDraftId] = useState<string | null>(null);
  const draftIdRef = useRef<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playIdx, setPlayIdx] = useState(0);
  // Playbar: collapsed to the bare index until hovered; `hoverThumb` is the
  // filmstrip thumb the pointer is over once expanded. Opening waits out a
  // short hover-intent dwell (a graze never expands it) and closing lingers
  // briefly (slipping off the edge doesn't snap it shut).
  const [scrubOpen, setScrubOpen] = useState(false);
  const [hoverThumb, setHoverThumb] = useState<number | null>(null);
  const scrubbing = useRef(false);
  const scrubTimers = useRef({ open: 0, close: 0 });

  const scrubEnter = () => {
    window.clearTimeout(scrubTimers.current.close);
    window.clearTimeout(scrubTimers.current.open);
    scrubTimers.current.open = window.setTimeout(() => setScrubOpen(true), 150);
  };
  const scrubLeave = () => {
    window.clearTimeout(scrubTimers.current.open);
    if (scrubbing.current) return; // mid-drag keeps it open
    scrubTimers.current.close = window.setTimeout(() => {
      setScrubOpen(false);
      setHoverThumb(null);
    }, 280);
  };
  useEffect(() => {
    const timers = scrubTimers.current;
    return () => {
      window.clearTimeout(timers.open);
      window.clearTimeout(timers.close);
    };
  }, []);

  // The crosshair IS the cursor while inside the cards area (the native
  // cursor is hidden there) and snaps home to the canvas center on exit.
  // `mousePos` doubles as the reticle's measuring point, so selection follows
  // the cursor too.
  const [free, setFree] = useState(false);
  const freeRef = useRef(false);
  const mousePos = useRef<{ x: number; y: number } | null>(null);
  const reticleEl = useRef<HTMLButtonElement | null>(null);

  /** Hand the pointer back to the OS cursor; the crosshair eases home. */
  const releaseFollow = useCallback(() => {
    mousePos.current = null;
    const ret = reticleEl.current;
    if (ret) {
      ret.classList.remove('mir-reticle--free');
      ret.style.left = '';
      ret.style.top = '';
    }
    freeRef.current = false;
    setFree(false);
  }, []);

  // Which edges have cards scrolled out of view (drives the overflow fades).
  const [edges, setEdges] = useState({ left: false, right: false });

  // Hover intent for the (+) morph: the reticle must DWELL over a gap before
  // the crosshair morphs — sweeping across gaps mid-gesture never triggers it.
  // Scrolling stamps `lastScroll`, which the dwell timer treats as a lockout.
  const [morphArmed, setMorphArmed] = useState(false);
  const lastScroll = useRef(0);

  // Render-synced mirror: while an overlay (prompt box / drawer) is open the
  // pointer belongs to it, so cursor-following pauses.
  const overlayRef = useRef(false);
  overlayRef.current = drawerOpen;

  const visible = scenes.filter((s) => spawnedIds.includes(s.id));
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const reticleRef = useRef(reticle);
  reticleRef.current = reticle;
  const playingRef = useRef(playing);
  playingRef.current = playing;
  /** True while the last strip movement came from the user's wheel — the only
   *  scrolls the magnet below is allowed to finish. */
  const wheelScrolled = useRef(false);

  // Derived timing: every badge / drawer time / meta readout recomputes from
  // the durations, so retiming or reordering one scene ripples everywhere.
  const starts = sceneStarts(scenes);
  const startById = new Map(scenes.map((s, i) => [s.id, starts[i]]));

  // The video's cast face-pile — everyone in the video, addable via the +.
  const castPile = videoCast.map((id) => ({ id, chip: AVATARS[id].chip }));
  const libraryLeft = (Object.keys(AVATARS) as AvatarId[]).filter(
    (id) => !videoCast.includes(id),
  );
  const [castMenuOpen, setCastMenuOpen] = useState(false);
  useEffect(() => {
    if (!castMenuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (e.target instanceof Element && e.target.closest('.mir-board__meta')) return;
      setCastMenuOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [castMenuOpen]);

  // Which card is in its in-place edit posture (one at a time).
  const [editingId, setEditingId] = useState<string | null>(null);

  /* --- Drag-to-reorder ---------------------------------------------------------
     Hold a card ~200ms to lift it; it then follows the pointer while a drop
     line marks the insertion boundary. Releasing commits the reorder and the
     motion layout slots FLIP everyone to their new positions. Wiggling before
     the hold elapses cancels (it was a click); the reticle's scroll-lockout is
     stamped throughout, so the crosshair never morphs mid-drag. */
  const dragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    lifted: boolean;
    hold: number;
    el: HTMLElement;
    pointerId: number;
  } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const draggingIdRef = useRef<string | null>(null);
  draggingIdRef.current = draggingId;
  const [dropX, setDropX] = useState<number | null>(null);
  const dropBefore = useRef<string | null | undefined>(undefined);
  const suppressClick = useRef(false);

  const beginDrag = (e: React.PointerEvent<HTMLDivElement>, id: string) => {
    if (editingId || e.button !== 0) return;
    const el = e.currentTarget;
    const pointerId = e.pointerId;
    const hold = window.setTimeout(() => {
      const d = dragRef.current;
      if (!d || d.id !== id) return;
      d.lifted = true;
      el.setPointerCapture(pointerId);
      setDraggingId(id);
    }, 200);
    dragRef.current = { id, startX: e.clientX, startY: e.clientY, lifted: false, hold, el, pointerId };
  };

  const moveDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    if (!d.lifted) {
      // Movement before the hold elapses reads as a click/scroll, not a drag.
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 8) {
        window.clearTimeout(d.hold);
        dragRef.current = null;
      }
      return;
    }
    lastScroll.current = Date.now();
    const dx = e.clientX - d.startX;
    const dy = Math.max(-14, Math.min(14, e.clientY - d.startY));
    d.el.style.transform = `translate(${dx}px, ${dy}px)`;

    const row = rowRef.current;
    if (!row) return;
    const rr = row.getBoundingClientRect();
    // Edge auto-scroll so far-away positions stay reachable.
    if (e.clientX < rr.left + 110) row.scrollLeft -= 14;
    else if (e.clientX > rr.right - 110) row.scrollLeft += 14;

    // Insertion point: how many OTHER cards sit left of the pointer.
    const others = visibleRef.current.filter((s) => s.id !== d.id);
    let idx = 0;
    for (const s of others) {
      const el = cardEls.current[s.id];
      if (el && e.clientX > el.getBoundingClientRect().left + el.offsetWidth / 2) idx++;
    }
    dropBefore.current = others[idx]?.id ?? null;
    const anchor = idx === 0 ? cardEls.current[others[0]?.id ?? ''] : cardEls.current[others[idx - 1].id];
    if (anchor) {
      const ar = anchor.getBoundingClientRect();
      const boundary = idx === 0 ? ar.left - 9 : ar.right + 9;
      setDropX(boundary - rr.left + row.scrollLeft);
    }
  };

  const endDrag = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    window.clearTimeout(d.hold);
    if (!d.lifted) return;
    d.el.style.transform = '';
    setDraggingId(null);
    setDropX(null);
    // The click that follows this pointerup must not zoom into the card.
    suppressClick.current = true;
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 0);
    if (dropBefore.current !== undefined) onReorderScene(d.id, dropBefore.current);
    dropBefore.current = undefined;
  };

  /* --- Centering --------------------------------------------------------------- */

  const centerOnVisible = useCallback((i: number, behavior: ScrollBehavior = 'smooth') => {
    const row = rowRef.current;
    const el = cardEls.current[visibleRef.current[i]?.id ?? ''];
    if (!row || !el) return;
    // A programmatic glide, not a wheel coast — the magnet must not chase it.
    wheelScrolled.current = false;
    // Rect delta rather than offsetLeft: the cards wrapper is a positioned
    // ancestor, so offsetLeft is measured from IT and drops the row's run-in.
    const rowRect = row.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const delta = r.left + r.width / 2 - (rowRect.left + rowRect.width / 2);
    row.scrollTo({ left: row.scrollLeft + delta, behavior });
  }, []);

  /* --- Reticle tracking --------------------------------------------------------
     Resolve what sits under the board's center from live card geometry (so the
     hover-expanding gaps and mid-flight materializations stay accounted for),
     throttled to one measurement per frame. */
  const measure = useCallback(() => {
    const row = rowRef.current;
    const list = visibleRef.current;
    if (!row || list.length === 0) return;
    const rowRect = row.getBoundingClientRect();
    // The reticle's measuring point: the cursor while it roams the cards
    // area, the canvas center otherwise.
    const centerX = mousePos.current?.x ?? rowRect.left + rowRect.width / 2;

    // Overflow fades: left shows once cards are scrolled out on the left,
    // right shows while more cards wait off the right edge.
    const maxScroll = row.scrollWidth - row.clientWidth;
    const l = row.scrollLeft > 4;
    const r = row.scrollLeft < maxScroll - 4;
    setEdges((cur) => (cur.left === l && cur.right === r ? cur : { left: l, right: r }));

    // The raw gaps are only 18px wide — too small a landing zone to scroll
    // into deliberately. Counting the outer sliver of each card as "gap" too
    // widens insertion mode to a comfortable ~46px without moving anything.
    const EDGE = 14;
    let next: ReticleState | null = null;
    for (let i = 0; i < list.length; i++) {
      const el = cardEls.current[list[i].id];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (centerX < r.left + EDGE) {
        // Center fell short of this card's body: the gap after the previous
        // one — or, past the first card's leading edge, the run-in before the
        // whole sequence (insert at position 1).
        next =
          i === 0
            ? centerX < r.left - EDGE
              ? { mode: 'gap', afterVisible: -1 }
              : { mode: 'card', id: list[0].id, index: 0 }
            : { mode: 'gap', afterVisible: i - 1 };
        break;
      }
      if (centerX <= r.right - EDGE) {
        next = { mode: 'card', id: list[i].id, index: i };
        break;
      }
    }
    // Past the last card's trailing edge: the run-out after the sequence.
    if (!next) next = { mode: 'gap', afterVisible: list.length - 1 };

    const cur = reticleRef.current;
    const same =
      cur.mode === next.mode &&
      (next.mode === 'card'
        ? (cur as { id?: string }).id === next.id
        : (cur as { afterVisible?: number }).afterVisible === next.afterVisible);
    if (!same) {
      setReticle(next);
      onReticleScene(
        next.mode === 'card'
          ? next.id
          : (list[Math.max(0, next.afterVisible)]?.id ?? null),
      );
    }
  }, [onReticleScene]);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    let raf = 0;
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        measure();
      });
    };
    // While the cursor roams the cards area the crosshair replaces it,
    // tracking 1:1 (styled straight onto the element — no re-render per
    // mousemove); on exit the OS cursor returns and the crosshair eases home.
    // Tracking lives on the BOARD, gated by the row's band: the morphed node
    // sits under the cursor and would steal a row-level pointerleave, which
    // flickers — board-level moves keep bubbling through it.
    const board = boardRef.current;
    const release = () => {
      releaseFollow();
      schedule();
    };
    const onPointerMove = (e: PointerEvent) => {
      // An open overlay (prompt box / drawer scrim) owns the pointer.
      if (overlayRef.current) {
        if (freeRef.current) release();
        return;
      }
      const r = row.getBoundingClientRect();
      const inside =
        e.clientY >= r.top && e.clientY <= r.bottom && e.clientX >= r.left && e.clientX <= r.right;
      if (!inside) {
        if (freeRef.current) release();
        return;
      }
      mousePos.current = { x: e.clientX, y: e.clientY };
      const ret = reticleEl.current;
      if (board && ret) {
        if (!freeRef.current) {
          // The class lands synchronously so the very first placement is
          // instant — with the native cursor hidden there must never be a
          // cursorless beat while the crosshair flies over.
          ret.classList.add('mir-reticle--free');
        }
        const b = board.getBoundingClientRect();
        ret.style.left = `${e.clientX - b.left}px`;
        ret.style.top = `${e.clientY - b.top}px`;
      }
      if (!freeRef.current) {
        freeRef.current = true;
        setFree(true);
      }
      schedule();
    };

    /* The magnet: a wheel coast that dies with a gap under the crosshair gets
       finished — the nearest card glides the last few px under the reticle.
       Wheel-origin only, and only while the crosshair is home (cursor outside
       the band): the deliberate gap-rest paths — hovering a gap with the
       cursor, clicking a gap to glide it in — are untouched, so insertion
       mode still works exactly as designed. Fires at 300ms of quiet, before
       the morph dwell (~340ms post-scroll) can arm and flash the (+). */
    let magnetT = 0;
    const magnet = () => {
      if (!wheelScrolled.current || freeRef.current || overlayRef.current) return;
      if (editingIdRef.current || draggingIdRef.current || playingRef.current) return;
      const cur = reticleRef.current;
      if (cur.mode !== 'gap') return;
      const list = visibleRef.current;
      const rowRect = row.getBoundingClientRect();
      const center = rowRect.left + rowRect.width / 2;
      let best = -1;
      let bestD = Infinity;
      for (const i of [cur.afterVisible, cur.afterVisible + 1]) {
        const el = cardEls.current[list[i]?.id ?? ''];
        if (!el) continue;
        const r = el.getBoundingClientRect();
        const d = Math.abs(r.left + r.width / 2 - center);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      if (best >= 0) centerOnVisible(best);
    };

    // Scroll lockout: stamp activity so the dwell timer below refuses to arm
    // the morph while the strip is (or just was) in motion.
    const onScroll = () => {
      lastScroll.current = Date.now();
      schedule();
      window.clearTimeout(magnetT);
      magnetT = window.setTimeout(magnet, 300);
    };

    schedule();
    row.addEventListener('scroll', onScroll, { passive: true });
    board?.addEventListener('pointermove', onPointerMove, { passive: true });
    board?.addEventListener('pointerleave', release);
    // Gap widths settle via transitions (no scroll event), so re-measure then.
    row.addEventListener('transitionend', schedule);
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(magnetT);
      row.removeEventListener('scroll', onScroll);
      board?.removeEventListener('pointermove', onPointerMove);
      board?.removeEventListener('pointerleave', release);
      row.removeEventListener('transitionend', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [measure, releaseFollow, centerOnVisible]);

  // New cards landing (materialization / insertion) reshapes the strip.
  useEffect(() => {
    const t = window.setTimeout(measure, 60);
    return () => window.clearTimeout(t);
  }, [visible.length, measure]);

  // A plain vertical wheel anywhere over the board drives the strip
  // horizontally — the corkboard's only scroll axis. Ctrl-wheel stays
  // untouched: that's the pinch-zoom axis, handled at the flow root.
  const editingIdRef = useRef<string | null>(null);
  editingIdRef.current = editingId;
  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return;
      // While a card is in its edit posture, the wheel belongs to IT — the
      // form face scrolls vertically instead of the strip sliding away.
      if (editingIdRef.current) return;
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return; // already horizontal
      e.preventDefault();
      wheelScrolled.current = true;
      rowRef.current?.scrollBy({ left: e.deltaY });
    };
    board.addEventListener('wheel', onWheel, { passive: false });
    return () => board.removeEventListener('wheel', onWheel);
  }, []);

  // Arriving back from the frame canvas: land with the scene we left already
  // centered under the reticle, before first paint.
  useLayoutEffect(() => {
    if (!initialCenterId) return;
    const i = visibleRef.current.findIndex((s) => s.id === initialCenterId);
    if (i >= 0) centerOnVisible(i, 'auto');
    // mount-only: the id is a landing instruction, not live state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --- Playback: the reticle is the playhead ---------------------------------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      e.preventDefault();
      setPlaying((was) => {
        if (!was) {
          const cur = reticleRef.current;
          setPlayIdx(cur.mode === 'card' ? cur.index : Math.max(0, cur.afterVisible));
        }
        return !was;
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!playing) return;
    centerOnVisible(playIdx);
    const t = window.setTimeout(() => {
      if (playIdx >= visibleRef.current.length - 1) setPlaying(false);
      else setPlayIdx((i) => i + 1);
    }, PLAYBACK_SCENE_MS);
    return () => window.clearTimeout(t);
  }, [playing, playIdx, centerOnVisible]);

  /* --- Scrub pill ----------------------------------------------------------------- */

  const stripRef = useRef<HTMLDivElement | null>(null);

  /* A click (or drag) in the strip selects its thumb IMMEDIATELY — the cyan
     stroke jumps to it right away rather than trailing the reticle through the
     smooth scroll. `scrubSel` holds that selection and overrides the
     reticle-derived index until the board arrives, then hands back. */
  const [scrubSel, setScrubSel] = useState<number | null>(null);

  const selectAndCenter = useCallback(
    (i: number, behavior: ScrollBehavior) => {
      setScrubSel(i);
      centerOnVisible(i, behavior);
    },
    [centerOnVisible],
  );

  const scrubTo = (clientX: number, behavior: ScrollBehavior) => {
    const strip = stripRef.current;
    const list = visibleRef.current;
    if (!strip || list.length === 0) return;
    const r = strip.getBoundingClientRect();
    const frac = Math.min(0.999, Math.max(0, (clientX - r.left) / r.width));
    selectAndCenter(Math.floor(frac * list.length), behavior);
  };

  const activeVisIdx =
    reticle.mode === 'card'
      ? reticle.index
      : Math.min(visible.length - 1, Math.max(0, reticle.afterVisible));

  /* Release the override once the reticle catches up with the selection (the
     centering scroll has settled on the picked card). */
  useEffect(() => {
    if (scrubSel != null && !scrubbing.current && activeVisIdx === scrubSel) setScrubSel(null);
  }, [scrubSel, activeVisIdx]);

  /* The index the stroke + label actually show. */
  const scrubIdx = scrubSel ?? activeVisIdx;

  /* Dwell timer: entering a gap starts a ~180ms countdown before the morph
     arms; leaving (or landing in a different gap) cancels it. If the strip is
     still settling from a scroll, the attempt re-queues until it has been
     quiet long enough — so sweeping past gaps never flickers the node. */
  const gapKey = reticle.mode === 'gap' ? reticle.afterVisible : null;
  useEffect(() => {
    const MORPH_DWELL_MS = 180;
    const SCROLL_SETTLE_MS = 160;
    if (gapKey == null) {
      setMorphArmed(false);
      return;
    }
    setMorphArmed(false);
    let t = 0;
    const attempt = () => {
      const sinceScroll = Date.now() - lastScroll.current;
      if (sinceScroll < SCROLL_SETTLE_MS) {
        t = window.setTimeout(attempt, SCROLL_SETTLE_MS - sinceScroll + MORPH_DWELL_MS);
        return;
      }
      setMorphArmed(true);
    };
    t = window.setTimeout(attempt, MORPH_DWELL_MS);
    return () => window.clearTimeout(t);
  }, [gapKey]);
  const reticleGapIndex = reticle.mode === 'gap' ? reticle.afterVisible : null;
  const insertAfterScene = (visIdx: number) => scenes.indexOf(visible[visIdx]);

  // The crosshair morphs only once the dwell timer has armed it — and never
  // while a card is being edited or dragged, or the drawer owns the pointer.
  // Reticle-only mode: any gap under it qualifies. Unified mode: only while
  // no OTHER gap is hovered — a hovered gap summons the node to itself.
  const reticleMorphs =
    morphArmed &&
    !editingId &&
    !draggingId &&
    !drawerOpen &&
    reticleGapIndex != null &&
    (!unified || hoverGap == null || hoverGap === reticleGapIndex);
  const nodeGap =
    unified && hoverGap != null && hoverGap !== reticleGapIndex ? hoverGap : null;

  /** Reticle-only mode: clicking a gap glides it under the crosshair. */
  const glideGapToReticle = (gapEl: HTMLElement) => {
    const row = rowRef.current;
    if (!row) return;
    // Deliberate travel INTO a gap — the magnet must let it rest there.
    wheelScrolled.current = false;
    row.scrollTo({
      left: gapEl.offsetLeft + gapEl.offsetWidth / 2 - row.clientWidth / 2,
      behavior: 'smooth',
    });
  };

  /** Insert here: a blank card lands in the gap, already in its edit posture —
   *  the form is the prompt box. The host returns the new scene's id. */
  const startInsert = (visIdx: number) => {
    // One editor at a time: while a card (draft or not) is open, the unified
    // gap nodes must not spawn a second draft under it.
    if (editingIdRef.current) return;
    // The form takes the pointer: OS cursor back, crosshair heads home.
    releaseFollow();
    const id = onInsertScene(insertAfterScene(visIdx));
    draftIdRef.current = id;
    setDraftId(id);
    setEditingId(id);
  };

  /* Once the fresh card has mounted, glide it under the reticle. */
  useEffect(() => {
    if (!draftId) return;
    const raf = requestAnimationFrame(() => {
      const i = visibleRef.current.findIndex((s) => s.id === draftId);
      if (i >= 0) centerOnVisible(i);
    });
    return () => cancelAnimationFrame(raf);
  }, [draftId, centerOnVisible]);

  return (
    <div
      className={`mir-board ${editingId ? 'mir-board--editing' : ''} ${
        draggingId ? 'mir-board--dragging' : ''
      } ${initialCenterId ? 'mir-board--return' : ''} ${playing ? 'mir-board--playing' : ''}`}
      ref={boardRef}
    >
      {/* Collection meta (L104/L107): count · runtime · the video's cast
          face-pile, centered above the strip — with a + to bring more library
          avatars into the video (they then become addable to scenes). */}
      <div className="mir-board__meta">
        <span className="mir-board__meta-text">{boardMeta(scenes)} · </span>
        <span className="mir-board__meta-pile">
          {castPile.map((m) => (
            <img key={m.id} src={m.chip} alt="" />
          ))}
          {/* The + is the pile's last "member": a dashed ghost circle stacked
              onto the faces — the next avatar goes here. */}
          <span className="mir-board__meta-addwrap">
          <button
            type="button"
            className="mir-cast mir-cast--plus mir-board__meta-add"
            aria-label="Add an avatar to this video"
            aria-expanded={castMenuOpen}
            disabled={libraryLeft.length === 0}
            onClick={() => setCastMenuOpen((v) => !v)}
          >
            <Plus size={13} weight="bold" />
          </button>
          <AnimatePresence>
            {castMenuOpen && (
              <motion.div
                key="video-cast"
                className="mir-cast-menu mir-board__meta-menu"
                exit={{
                  opacity: 0,
                  y: -2,
                  scale: 0.98,
                  transition: { duration: 0.12, ease: 'easeOut' },
                }}
              >
                {libraryLeft.map((id) => (
                  <button
                    type="button"
                    className="mir-cast-menu__row"
                    key={id}
                    onClick={() => {
                      onAddAvatar(id);
                      setCastMenuOpen(false);
                    }}
                  >
                    <img className="mir-cast-menu__chip" src={AVATARS[id].chip} alt="" />
                    {AVATARS[id].name}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          </span>
        </span>
      </div>

      {/* Scene-list trigger (Figma "Style pill"): morphs into the icon-only
          ✕ square while the drawer is open. Sits above the scrolling track. */}
      <button
        type="button"
        className={`mir-scenes-pill ${drawerOpen ? 'mir-scenes-pill--open' : ''}`}
        aria-expanded={drawerOpen}
        aria-label={drawerOpen ? 'Close scene list' : 'Open scene list'}
        onClick={() => {
          // The drawer takes the pointer: crosshair home, OS cursor back.
          releaseFollow();
          setDrawerOpen((v) => !v);
        }}
      >
        <span className="mir-scenes-pill__icon" key={drawerOpen ? 'x' : 'list'}>
          {drawerOpen ? <X size={24} /> : <ListBullets size={24} />}
        </span>
        <span className="mir-scenes-pill__text">Scenes</span>
      </button>

      <div className="mir-board__row" ref={rowRef}>
        <div className="mir-board__cards">
          {dropX != null && <span className="mir-dropline" style={{ left: dropX }} aria-hidden />}
          {/* Each slot owns its card AND its trailing gap, so a deleted scene
              takes its gap along as it shrinks away (popLayout lets the
              neighbors glide closed while the exit plays in place). */}
          <AnimatePresence mode="popLayout" initial={false}>
            {visible.map((s, i) => (
              <motion.div
                key={s.id}
                /* position, not full layout: a spawning neighbor grows this
                   slot (its trailing gap appears), and a size-animating FLIP
                   renders that as a scale — visibly squashing the card for a
                   few frames. Position glides; size snaps. */
                layout="position"
                transition={SLOT_TRANSITION}
                exit={SLOT_EXIT}
                className="mir-slot"
              >
                <div
                  className={`mir-slot__drag ${
                    draggingId === s.id ? 'mir-slot__drag--lifted' : ''
                  }`}
                  onPointerDown={(e) => beginDrag(e, s.id)}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                >
                  <SceneCard
                    scene={s}
                    videoCast={videoCast}
                    cooking={!readyMap[s.id]}
                    playing={playing && i === playIdx}
                    editing={editingId === s.id}
                    fresh={draftId === s.id}
                    startSec={startById.get(s.id) ?? 0}
                    onOpen={(el) => {
                      if (!suppressClick.current && editingId !== s.id) onOpenScene(s.id, el);
                    }}
                    onEndEdit={() => {
                      setEditingId(null);
                      // Backing out of a never-committed insert removes it —
                      // the ✓ path clears the ref (in onEdit) before this runs.
                      if (draftIdRef.current === s.id) {
                        draftIdRef.current = null;
                        setDraftId(null);
                        onDeleteScene(s.id);
                      }
                    }}
                    onEdit={(patch, opts) => {
                      if (draftIdRef.current === s.id) {
                        draftIdRef.current = null;
                        setDraftId(null);
                      }
                      onEditScene(s.id, patch, opts);
                    }}
                    registerEl={(el) => {
                      cardEls.current[s.id] = el;
                      registerCard(s.id, el);
                    }}
                  />
                  {/* Hover actions (718-136736): pencil + trash floating just
                      under the card. Pointer events stop here so a press can
                      never read as the start of a hold-drag reorder. */}
                  {editingId !== s.id && (
                    <div className="mir-card-actions">
                      <button
                        type="button"
                        className="mir-card-actions__btn"
                        aria-label={`Edit ${s.title}`}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(s.id);
                        }}
                      >
                        <PencilSimple size={16} />
                      </button>
                      <button
                        type="button"
                        className="mir-card-actions__btn mir-card-actions__btn--danger"
                        aria-label={`Delete ${s.title}`}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteScene(s.id);
                        }}
                      >
                        <Trash size={16} />
                      </button>
                    </div>
                  )}
                </div>
                {i < visible.length - 1 && (
                <div
                  className={`mir-gap ${unified ? '' : 'mir-gap--glide'}`}
                  onMouseEnter={() => {
                    onHoverCard(s.id);
                    setHoverGap(i);
                  }}
                  onMouseLeave={() => {
                    onHoverCard(null);
                    setHoverGap((cur) => (cur === i ? null : cur));
                  }}
                  onClick={(e) => {
                    // Reticle-only mode: the gap is a travel target, not an
                    // editor — clicking glides it under the crosshair, which
                    // morphs into the insertion node there.
                    if (!unified) {
                      e.stopPropagation();
                      glideGapToReticle(e.currentTarget);
                    }
                  }}
                >
                  {unified && (
                    /* The single insertion node, summoned here by hover. When
                       this gap is the one under the reticle, the crosshair
                       itself morphs instead — never two nodes at once. */
                    <button
                      type="button"
                      className={`mir-gap__add ${nodeGap === i ? 'mir-gap__add--active' : ''}`}
                      aria-label="Add a scene here"
                      tabIndex={nodeGap === i ? 0 : -1}
                      onClick={(e) => {
                        e.stopPropagation();
                        startInsert(i);
                      }}
                    >
                      <Plus size={20} weight="bold" />
                    </button>
                  )}
                </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
      <div
        className={`mir-board__fade mir-board__fade--left ${edges.left ? 'mir-board__fade--on' : ''}`}
        aria-hidden
      />
      <div
        className={`mir-board__fade mir-board__fade--right ${edges.right ? 'mir-board__fade--on' : ''}`}
        aria-hidden
      />

      {/* --- Viewfinder reticle: crosshair over a card, (+) over a gap -------- */}
      <button
        type="button"
        className={`mir-reticle ${reticleMorphs ? 'mir-reticle--gap' : ''} ${
          free ? 'mir-reticle--free' : ''
        }`}
        ref={(el) => {
          reticleEl.current = el;
          registerReticle(el);
        }}
        aria-label={
          reticleMorphs && reticleGapIndex != null
            ? `Insert a scene at position ${reticleGapIndex + 2}`
            : undefined
        }
        aria-hidden={!reticleMorphs || undefined}
        tabIndex={reticleMorphs ? 0 : -1}
        onClick={() => {
          if (reticleMorphs && reticleGapIndex != null) startInsert(reticleGapIndex);
        }}
      >
        <ViewfinderReticle size={22} className="mir-reticle__cross" />
        <Plus size={20} weight="bold" className="mir-reticle__plus" />
      </button>

      {/* --- Sequence navigator (Raw-20/21 playbar, consolidated) --------------
          The active index, plus the filmstrip mini-map on hover. Idle: just
          the quiet index. Hovering the pill expands the filmstrip; hovering a
          thumb previews its index in text/tertiary and grays out the other
          thumbs. Click/drag jumps the strip so that scene locks under the
          reticle. */}
      <div
        className={`mir-scrub ${scrubOpen ? 'mir-scrub--open' : ''}`}
        onMouseEnter={scrubEnter}
        onMouseLeave={scrubLeave}
      >
        <span
          className={`mir-scrub__label ${hoverThumb != null ? 'mir-scrub__label--preview' : ''}`}
        >
          {(hoverThumb ?? scrubIdx) + 1}/{scenes.length}
        </span>
        <div
          className="mir-scrub__strip"
          ref={stripRef}
          onMouseLeave={() => setHoverThumb(null)}
          onPointerDown={(e) => {
            scrubbing.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            // Pressing a thumb selects THAT thumb; only presses in the gaps
            // between them fall back to fraction-across-the-strip math.
            if (hoverThumb != null) selectAndCenter(hoverThumb, 'smooth');
            else scrubTo(e.clientX, 'smooth');
          }}
          onPointerMove={(e) => {
            if (scrubbing.current) scrubTo(e.clientX, 'auto');
          }}
          onPointerUp={() => {
            scrubbing.current = false;
          }}
        >
          {visible.map((s, i) => (
            <button
              type="button"
              key={s.id}
              aria-label={`Jump to scene ${i + 1} — ${s.title}`}
              className={`mir-scrub__thumb ${i === scrubIdx ? 'mir-scrub__thumb--active' : ''} ${
                hoverThumb != null && hoverThumb !== i ? 'mir-scrub__thumb--dim' : ''
              }`}
              onMouseEnter={() => setHoverThumb(i)}
            >
              <img src={s.thumb} alt="" draggable={false} />
            </button>
          ))}
          {scenes.length > visible.length && (
            <span className="mir-scrub__pending">+{scenes.length - visible.length}</span>
          )}
        </div>
      </div>

      {drawerOpen && <div className="mir-drawer-scrim" onClick={() => setDrawerOpen(false)} />}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            key="drawer"
            className="mir-drawer"
            /* Backs out the way it slid in; y carries the CSS centering offset
               because motion's inline transform replaces the stylesheet's. */
            exit={{ opacity: 0, x: -20, y: '-52%', transition: { duration: 0.16, ease: 'easeOut' } }}
          >
            <div className="mir-drawer__list">
              {visible.map((s, i) => (
                <button
                  type="button"
                  className="mir-drawer__row"
                  key={s.id}
                  onClick={() => {
                    setDrawerOpen(false);
                    centerOnVisible(i);
                  }}
                >
                  <span className="mir-drawer__time">{formatTimecode(startById.get(s.id) ?? 0)}</span>
                  <span className="mir-drawer__title">{s.title}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
