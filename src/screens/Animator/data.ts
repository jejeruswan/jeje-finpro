/* ============================================================================
   Level 3 — Frame Canvas. Scene model.

   Everything on this screen is anchored to TIME (seconds), never to pixels.
   One number — `pxPerSec`, owned by useTimeline — converts time to screen
   space, so the ruler, the playhead, every clip and every connector line are
   guaranteed to agree at any zoom level and any scroll position.

   The spine of the model is ATTENTION, and it is stored as MARKS, not blocks:
   a mark says "from this instant onward, the eye is on X" and that state holds
   until the next mark. Contiguity is therefore free — a gap between marks is
   not expressible — and there are no widths for edits to fight over. The runs
   the timeline draws between marks are derived, never stored.

   The sample take is a real 3-minute sister vlog (Evelyn and Emily getting
   ready to go vintage shopping in Evelyn's New York apartment). The script and
   interaction lanes below were annotated against the actual footage — the
   dialogue is a cleaned-up whisper transcript with real timestamps.
   ============================================================================ */

/** Sticky left column holding the lane icons / avatar portraits. */
export const RAIL = 42;

/* --- The raw take ----------------------------------------------------------
   Level 3 directs a WINDOW of the source footage, not the whole file.
   `SOURCE_IN` is where this take starts in the file, so timeline time `t` is
   source time `SOURCE_IN + t`. The take is the real 3:00 vlog, and the
   segment durations are its 12 scene lengths, read off the footage's actual
   cut points — every annotation below is written against those cuts. */

export const SOURCE_VIDEO = '/assets/video.mp4';

/** How long each scene actually holds the screen — the take's real cuts.
 *  The filmstrip scrubber maps its equal-width thumbs through these, so its
 *  pin crosses a short scene fast and a long scene slowly, and the active
 *  thumb flips exactly when the picture does. */
export const TAKE_SEGMENT_DURATIONS = [7, 3, 20, 7, 17, 10, 44, 13, 14, 22, 7, 16];

/** Each segment's start time in the take, accumulated from the durations. */
export const TAKE_CUTS: number[] = TAKE_SEGMENT_DURATIONS.reduce<number[]>(
  (starts, _d, i) => [...starts, i === 0 ? 0 : starts[i - 1] + TAKE_SEGMENT_DURATIONS[i - 1]],
  [],
);
/** Where this take begins inside the source file, in seconds. */
export const SOURCE_IN = 0;
/** The take's length. Fixed by the footage — editing redistributes time inside
 *  it, it never changes the total. */
export const SCENE_DURATION = 180;
/** Shown in the standalone route's header; the Mirage flow passes its own. */
export const PROJECT_TITLE = 'Vintage shopping with my sister';

/* --- Time base ------------------------------------------------------------- */

export const DEFAULT_PX_PER_SEC = 34.8; // the spacing the design was drawn at
/** Ruler label interval, chosen so labels never crowd at the current zoom. */
export function rulerStep(pxPerSec: number): number {
  for (const step of [1, 2, 5, 10, 15, 30, 60]) {
    if (step * pxPerSec >= 56) return step;
  }
  return 60;
}

/** Seconds → "M:SS", growing to "M:SS.CS" only when there is a fraction to
 *  show, so whole-second values stay as compact as the design's. */
export function formatClock(sec: number): string {
  const v = Math.max(0, Math.round(sec * 100) / 100);
  const m = Math.floor(v / 60);
  const s = Math.floor(v % 60);
  const cs = Math.round((v - Math.floor(v)) * 100);
  const base = `${m}:${String(s).padStart(2, '0')}`;
  return cs ? `${base}.${String(cs).padStart(2, '0')}` : base;
}

/** Always-centiseconds variant for the ruler's current-time pill. */
export function formatTimecode(sec: number): string {
  const v = Math.max(0, sec);
  const m = Math.floor(v / 60);
  const s = Math.floor(v % 60);
  const cs = Math.floor((v * 100) % 100);
  return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

/** "M:SS(.CS)" or a bare seconds count → seconds. `null` when unparseable, so
 *  callers can reject the edit and keep the previous value. */
export function parseClock(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  const m = /^(?:(\d+):)?([0-5]?\d)(?:\.(\d{1,2}))?$/.exec(t);
  if (!m) return null;
  const mins = m[1] ? Number(m[1]) : 0;
  const secs = Number(m[2]);
  const cs = m[3] ? Number(m[3].padEnd(2, '0')) : 0;
  return mins * 60 + secs + cs / 100;
}

/* --- The object graph ------------------------------------------------------
   Every addressable thing in the frame. Generated footage hands the graph over
   with the render; user footage gets it from detection — which can be wrong,
   hence `provenance`. Subjects are TIME-SCOPED: the take cuts between rooms, so
   each subject declares the window it is actually on screen for. Boxes are
   percentages of the stage, so they ride the framing transform. */

export type SubjectKind = 'person' | 'product' | 'prop' | 'light' | 'set';

export type BoxKey = { t: number; x: number; y: number; w: number; h: number };

export type Subject = {
  id: string;
  kind: SubjectKind;
  label: string;
  /** Percentages of the stage: left / top / width / height. The RESTING box —
   *  also the framing anchor, so crops stay steady while the HUD box moves. */
  box: { x: number; y: number; w: number; h: number };
  /** Keyframed motion: the box at time t interpolates linearly between these
   *  (see boxAt). Position AND size — a subject walking into close-up grows,
   *  one squeezed against the frame edge narrows. Sparse on purpose: keys only
   *  where the footage actually moves. */
  track?: BoxKey[];
  /** The stretch of the take this subject is in frame for. */
  from: number;
  to: number;
  provenance: 'generated' | 'detected';
};

/** The subject's box at time t: its keyframe track when it has one (clamped
 *  at both ends, linear between keys), its resting box otherwise. */
export const boxAt = (
  s: Pick<Subject, 'box' | 'track'>,
  t: number,
): { x: number; y: number; w: number; h: number } => {
  const k = s.track;
  if (!k || k.length === 0) return s.box;
  if (t <= k[0].t) return k[0];
  const last = k[k.length - 1];
  if (t >= last.t) return last;
  let i = 1;
  while (k[i].t < t) i++;
  const a = k[i - 1];
  const b = k[i];
  const f = (t - a.t) / (b.t - a.t);
  const L = (p: number, q: number) => p + (q - p) * f;
  return { x: L(a.x, b.x), y: L(a.y, b.y), w: L(a.w, b.w), h: L(a.h, b.h) };
};

/* The take's beats, read off the footage's 12 real cuts:
     0–7      apartment wide — Evelyn presents the plan by the sofa
     7–10     hallway walk-and-talk, wall art behind
     10–30    hallway — Emily wanders in behind, phone in hand
     30–37    full-length mirror — both sisters in the reflection
     37–54    sunglasses try-on, close
     54–64    Emily's walk-and-talk, Evelyn in the background
     64–108   the long gallery-wall hang — both sisters, sunnies and phone
     108–121  Emily holds the phone up — mirror selfie on its screen
     121–135  both at the wall, sunglasses worn
     135–157  the Lego art wall pan, arched mirror below
     157–164  piling into the car — back seat, driver up front
     164–180  Evelyn's back-seat selfie sign-off                              */

export const SUBJECTS: Subject[] = [
  // Beat 1 (0–7) — apartment wide
  { id: 'closet-a', kind: 'set', label: 'Closet doors', box: { x: 0, y: 0, w: 32, h: 100 }, from: 0, to: 6.2, provenance: 'detected',
    track: [
      { t: 0.5, x: 0, y: 0, w: 32, h: 100 }, { t: 2, x: 0, y: 0, w: 42, h: 100 },
      { t: 3.5, x: 0, y: 0, w: 30, h: 100 }, { t: 5, x: 0, y: 0, w: 32, h: 100 },
      { t: 6, x: 0, y: 0, w: 20, h: 100 },
    ] },
  { id: 'sofa-a', kind: 'set', label: 'Sofa', box: { x: 64, y: 66, w: 36, h: 34 }, from: 0, to: 7, provenance: 'detected',
    track: [
      { t: 0.5, x: 62, y: 66, w: 38, h: 34 }, { t: 3.5, x: 64, y: 66, w: 36, h: 34 },
      { t: 5, x: 62, y: 64, w: 38, h: 36 }, { t: 6.5, x: 76, y: 55, w: 24, h: 40 },
    ] },
  { id: 'ladder-a', kind: 'set', label: 'Ladder shelf', box: { x: 84, y: 27, w: 13, h: 52 }, from: 0, to: 6.2, provenance: 'detected',
    track: [{ t: 0.5, x: 82, y: 26, w: 14, h: 52 }, { t: 2, x: 86, y: 28, w: 12, h: 52 }, { t: 5, x: 82, y: 26, w: 13, h: 54 }] },
  { id: 'console-a', kind: 'set', label: 'Console table', box: { x: 62, y: 53, w: 22, h: 26 }, from: 0, to: 6.3, provenance: 'detected',
    track: [{ t: 0.5, x: 60, y: 52, w: 22, h: 26 }, { t: 2, x: 64, y: 54, w: 22, h: 26 }, { t: 5, x: 60, y: 52, w: 22, h: 28 }] },
  { id: 'evelyn-a', kind: 'person', label: 'Evelyn', box: { x: 32, y: 4, w: 30, h: 94 }, from: 0, to: 7, provenance: 'detected',
    track: [
      { t: 0.5, x: 32, y: 4, w: 26, h: 92 }, { t: 2, x: 36, y: 4, w: 26, h: 92 },
      { t: 3.5, x: 30, y: 4, w: 36, h: 96 }, { t: 5, x: 28, y: 4, w: 34, h: 96 },
      { t: 6.5, x: 20, y: 6, w: 40, h: 94 },
    ] },
  { id: 'chainbag-a', kind: 'product', label: 'Chain bag', box: { x: 48, y: 32, w: 10, h: 28 }, from: 0, to: 7, provenance: 'detected',
    track: [{ t: 0.5, x: 48, y: 34, w: 8, h: 26 }, { t: 3.5, x: 52, y: 30, w: 8, h: 24 }, { t: 6.5, x: 44, y: 40, w: 12, h: 34 }] },

  // Beat 2 (7–10) — hallway walk-and-talk
  { id: 'art-a', kind: 'set', label: 'Wall art', box: { x: 12, y: 2, w: 24, h: 44 }, from: 7, to: 10, provenance: 'detected',
    track: [{ t: 7.5, x: 20, y: 0, w: 18, h: 40 }, { t: 8.5, x: 8, y: 4, w: 26, h: 46 }, { t: 9.5, x: 4, y: 2, w: 24, h: 42 }] },
  { id: 'evelyn-b', kind: 'person', label: 'Evelyn', box: { x: 34, y: 8, w: 44, h: 92 }, from: 7, to: 10, provenance: 'detected',
    track: [{ t: 7.5, x: 44, y: 6, w: 42, h: 94 }, { t: 8.5, x: 28, y: 8, w: 44, h: 92 }, { t: 9.5, x: 30, y: 10, w: 45, h: 90 }] },
  { id: 'chainbag-b', kind: 'product', label: 'Chain bag', box: { x: 52, y: 55, w: 10, h: 45 }, from: 7, to: 10, provenance: 'detected' },

  // Beat 3 (10–30) — Emily wanders in behind
  { id: 'art-b', kind: 'set', label: 'Wall art', box: { x: 8, y: 0, w: 24, h: 44 }, from: 10, to: 30, provenance: 'detected',
    track: [
      { t: 10.5, x: 2, y: 2, w: 24, h: 44 }, { t: 13, x: 14, y: 2, w: 20, h: 38 },
      { t: 16, x: 12, y: 0, w: 22, h: 44 }, { t: 19, x: 12, y: 0, w: 22, h: 42 },
      { t: 22, x: 0, y: 2, w: 22, h: 43 }, { t: 25, x: 4, y: 0, w: 22, h: 44 },
      { t: 28, x: 10, y: 0, w: 22, h: 46 }, { t: 29.5, x: 8, y: 2, w: 22, h: 44 },
    ] },
  { id: 'evelyn-c', kind: 'person', label: 'Evelyn', box: { x: 24, y: 4, w: 44, h: 96 }, from: 10, to: 30, provenance: 'detected',
    track: [
      { t: 10, x: 0, y: 0, w: 56, h: 100 }, { t: 11.5, x: 8, y: 2, w: 50, h: 98 },
      { t: 13, x: 24, y: 6, w: 42, h: 94 }, { t: 16, x: 30, y: 4, w: 40, h: 96 },
      { t: 19, x: 26, y: 4, w: 42, h: 96 }, { t: 22, x: 12, y: 2, w: 46, h: 98 },
      { t: 25, x: 10, y: 2, w: 46, h: 98 }, { t: 28, x: 8, y: 2, w: 44, h: 98 },
      { t: 29.5, x: 10, y: 2, w: 50, h: 98 },
    ] },
  { id: 'emily-a', kind: 'person', label: 'Emily', box: { x: 70, y: 20, w: 30, h: 80 }, from: 9.3, to: 30, provenance: 'detected',
    track: [
      { t: 9.5, x: 88, y: 42, w: 12, h: 58 }, { t: 10.5, x: 86, y: 40, w: 14, h: 60 },
      { t: 13, x: 82, y: 50, w: 18, h: 50 }, { t: 16, x: 72, y: 24, w: 28, h: 76 },
      { t: 19, x: 76, y: 20, w: 24, h: 80 }, { t: 22, x: 56, y: 10, w: 34, h: 90 },
      { t: 25, x: 54, y: 12, w: 38, h: 88 }, { t: 28, x: 60, y: 12, w: 38, h: 88 },
      { t: 29.5, x: 52, y: 14, w: 36, h: 86 },
    ] },
  { id: 'emphone-a', kind: 'product', label: "Emily's phone", box: { x: 90, y: 76, w: 10, h: 20 }, from: 15, to: 22, provenance: 'detected' },
  { id: 'chainbag-e', kind: 'product', label: 'Chain bag', box: { x: 46, y: 32, w: 10, h: 50 }, from: 10, to: 30, provenance: 'detected',
    track: [
      { t: 12, x: 46, y: 32, w: 10, h: 50 }, { t: 19, x: 46, y: 32, w: 10, h: 50 },
      { t: 22, x: 76, y: 58, w: 15, h: 42 }, { t: 29, x: 72, y: 55, w: 16, h: 45 },
    ] },

  // Beat 4 (30–37) — the full-length mirror
  { id: 'mirror-a', kind: 'prop', label: 'Mirror', box: { x: 24, y: 0, w: 50, h: 100 }, from: 30, to: 35.2, provenance: 'detected',
    track: [{ t: 30.5, x: 30, y: 0, w: 58, h: 100 }, { t: 33, x: 18, y: 0, w: 44, h: 100 }] },
  { id: 'pedestal-a', kind: 'set', label: 'Pedestal', box: { x: 73, y: 53, w: 27, h: 47 }, from: 30, to: 35.2, provenance: 'detected',
    track: [{ t: 30.5, x: 88, y: 60, w: 12, h: 40 }, { t: 33, x: 62, y: 52, w: 38, h: 48 }] },
  { id: 'evelyn-d', kind: 'person', label: 'Evelyn', box: { x: 37, y: 8, w: 18, h: 92 }, from: 30, to: 37, provenance: 'detected',
    track: [{ t: 30.5, x: 56, y: 4, w: 20, h: 96 }, { t: 33, x: 36, y: 8, w: 20, h: 92 }, { t: 35.5, x: 28, y: 0, w: 72, h: 100 }] },
  { id: 'emily-b', kind: 'person', label: 'Emily', box: { x: 21, y: 8, w: 15, h: 92 }, from: 30, to: 35.2, provenance: 'detected',
    track: [{ t: 30.5, x: 34, y: 8, w: 22, h: 92 }, { t: 33, x: 20, y: 8, w: 16, h: 92 }] },
  { id: 'vlogcam-a', kind: 'product', label: 'Vlog camera', box: { x: 48, y: 19, w: 5, h: 17 }, from: 30, to: 35.2, provenance: 'detected',
    track: [{ t: 30.5, x: 62, y: 12, w: 8, h: 18 }, { t: 33, x: 46, y: 18, w: 6, h: 14 }] },
  { id: 'emphone-b', kind: 'product', label: "Emily's phone", box: { x: 34, y: 36, w: 7, h: 15 }, from: 30, to: 35.2, provenance: 'detected',
    track: [{ t: 30.5, x: 40, y: 38, w: 6, h: 14 }, { t: 33, x: 28, y: 34, w: 6, h: 13 }] },
  { id: 'chainbag-i', kind: 'product', label: 'Chain bag', box: { x: 56, y: 28, w: 8, h: 24 }, from: 30, to: 37, provenance: 'detected' },

  // Beat 5 (37–54) — sunglasses try-on
  { id: 'art-c', kind: 'set', label: 'Wall art', box: { x: 62, y: 2, w: 22, h: 38 }, from: 37, to: 54, provenance: 'detected',
    track: [
      { t: 41, x: 78, y: 18, w: 16, h: 40 }, { t: 45, x: 62, y: 2, w: 22, h: 38 },
      { t: 49, x: 40, y: 0, w: 16, h: 38 }, { t: 53, x: 2, y: 0, w: 12, h: 36 },
    ] },
  { id: 'evelyn-e', kind: 'person', label: 'Evelyn', box: { x: 30, y: 0, w: 55, h: 100 }, from: 37, to: 51.5, provenance: 'detected',
    track: [
      { t: 37.5, x: 34, y: 0, w: 66, h: 100 }, { t: 41, x: 30, y: 0, w: 62, h: 100 },
      { t: 45, x: 12, y: 0, w: 66, h: 100 }, { t: 49, x: 40, y: 0, w: 38, h: 100 },
      { t: 51.3, x: 50, y: 10, w: 40, h: 90 },
    ] },
  { id: 'emily-c', kind: 'person', label: 'Emily', box: { x: 75, y: 45, w: 25, h: 55 }, from: 40.5, to: 54, provenance: 'detected',
    track: [
      { t: 41, x: 88, y: 55, w: 12, h: 45 }, { t: 45, x: 78, y: 78, w: 22, h: 22 },
      { t: 49, x: 64, y: 42, w: 24, h: 58 }, { t: 53, x: 62, y: 30, w: 24, h: 70 },
    ] },
  { id: 'sunnies-a', kind: 'product', label: 'Sunglasses', box: { x: 30, y: 18, w: 24, h: 28 }, from: 44, to: 51.5, provenance: 'detected',
    track: [{ t: 45, x: 8, y: 10, w: 32, h: 42 }, { t: 49, x: 52, y: 26, w: 14, h: 12 }] },
  { id: 'chainbag-c', kind: 'product', label: 'Chain bag', box: { x: 61, y: 71, w: 10, h: 29 }, from: 37, to: 51.5, provenance: 'detected' },
  { id: 'emphone-c1', kind: 'product', label: "Emily's phone", box: { x: 76, y: 80, w: 12, h: 18 }, from: 48, to: 54, provenance: 'detected' },

  // Beat 6 (54–64) — Emily's walk-and-talk, Evelyn drifts back in
  { id: 'art-d', kind: 'set', label: 'Wall art', box: { x: 30, y: 0, w: 17, h: 32 }, from: 54, to: 64, provenance: 'detected',
    track: [
      { t: 54.5, x: 22, y: 2, w: 18, h: 34 }, { t: 57, x: 32, y: 0, w: 17, h: 29 },
      { t: 60, x: 42, y: 0, w: 16, h: 30 }, { t: 63, x: 8, y: 4, w: 16, h: 36 },
    ] },
  { id: 'emily-d', kind: 'person', label: 'Emily', box: { x: 20, y: 6, w: 45, h: 94 }, from: 54, to: 64, provenance: 'detected',
    track: [
      { t: 54.5, x: 10, y: 8, w: 42, h: 92 }, { t: 57, x: 20, y: 4, w: 50, h: 96 },
      { t: 58, x: 30, y: 4, w: 60, h: 96 }, { t: 60, x: 22, y: 4, w: 56, h: 96 },
      { t: 63, x: 4, y: 12, w: 32, h: 88 },
    ] },
  { id: 'evelyn-f', kind: 'person', label: 'Evelyn', box: { x: 60, y: 15, w: 25, h: 70 }, from: 57.5, to: 64, provenance: 'detected',
    track: [
      { t: 58, x: 86, y: 18, w: 13, h: 60 }, { t: 59.5, x: 55, y: 22, w: 14, h: 55 },
      { t: 60, x: 58, y: 10, w: 16, h: 55 }, { t: 63, x: 40, y: 4, w: 52, h: 96 },
    ] },
  { id: 'chainbag-d', kind: 'product', label: 'Chain bag', box: { x: 50, y: 40, w: 10, h: 45 }, from: 54, to: 64, provenance: 'detected' },
  { id: 'emphone-c2', kind: 'product', label: "Emily's phone", box: { x: 20, y: 70, w: 14, h: 25 }, from: 54, to: 64, provenance: 'detected',
    track: [{ t: 54.5, x: 36, y: 82, w: 16, h: 18 }, { t: 63, x: 4, y: 58, w: 16, h: 32 }] },
  { id: 'sunnies-d', kind: 'product', label: 'Sunglasses', box: { x: 56, y: 20, w: 14, h: 12 }, from: 57.5, to: 64, provenance: 'detected',
    track: [{ t: 60, x: 60, y: 14, w: 12, h: 10 }, { t: 63, x: 52, y: 22, w: 20, h: 20 }] },

  // Beat 7 (64–108) — the long gallery-wall hang
  { id: 'art-e', kind: 'set', label: 'Wall art', box: { x: 14, y: 2, w: 22, h: 40 }, from: 64, to: 108, provenance: 'detected',
    track: [
      { t: 64.5, x: 11, y: 2, w: 24, h: 42 }, { t: 80, x: 16, y: 2, w: 24, h: 40 },
      { t: 96, x: 16, y: 2, w: 20, h: 38 }, { t: 107.5, x: 12, y: 2, w: 20, h: 38 },
    ] },
  { id: 'evelyn-g', kind: 'person', label: 'Evelyn', box: { x: 26, y: 0, w: 46, h: 100 }, from: 64, to: 108, provenance: 'detected',
    track: [
      { t: 64.5, x: 46, y: 0, w: 44, h: 100 }, { t: 66.5, x: 30, y: 0, w: 66, h: 100 },
      { t: 69, x: 24, y: 0, w: 46, h: 100 }, { t: 74, x: 40, y: 2, w: 46, h: 98 },
      { t: 76, x: 30, y: 0, w: 48, h: 100 }, { t: 80, x: 28, y: 0, w: 46, h: 100 },
      { t: 84, x: 22, y: 0, w: 44, h: 100 }, { t: 88, x: 28, y: 0, w: 44, h: 100 },
      { t: 92, x: 24, y: 0, w: 46, h: 100 }, { t: 96, x: 12, y: 0, w: 50, h: 100 },
      { t: 100, x: 22, y: 0, w: 44, h: 100 }, { t: 104, x: 12, y: 0, w: 50, h: 100 },
      { t: 107.5, x: 8, y: 0, w: 52, h: 100 },
    ] },
  { id: 'emily-e', kind: 'person', label: 'Emily', box: { x: 6, y: 10, w: 40, h: 90 }, from: 64, to: 67, provenance: 'detected',
    track: [{ t: 64.5, x: 8, y: 10, w: 38, h: 90 }, { t: 65, x: 4, y: 10, w: 42, h: 90 }, { t: 66.5, x: 0, y: 15, w: 12, h: 85 }] },
  { id: 'emily-e2', kind: 'person', label: 'Emily', box: { x: 68, y: 12, w: 32, h: 88 }, from: 75.5, to: 108, provenance: 'detected',
    track: [
      { t: 76, x: 74, y: 8, w: 26, h: 92 }, { t: 80, x: 74, y: 10, w: 26, h: 90 },
      { t: 84, x: 62, y: 14, w: 38, h: 86 }, { t: 88, x: 74, y: 10, w: 26, h: 90 },
      { t: 92, x: 76, y: 12, w: 24, h: 88 }, { t: 96, x: 62, y: 16, w: 38, h: 84 },
      { t: 100, x: 70, y: 10, w: 30, h: 90 }, { t: 104, x: 62, y: 8, w: 38, h: 92 },
      { t: 107.5, x: 58, y: 12, w: 38, h: 88 },
    ] },
  { id: 'sunnies-b', kind: 'product', label: 'Sunglasses', box: { x: 38, y: 8, w: 18, h: 15 }, from: 64, to: 108, provenance: 'detected',
    track: [
      { t: 64.5, x: 50, y: 14, w: 22, h: 22 }, { t: 68, x: 72, y: 12, w: 18, h: 14 },
      { t: 72, x: 36, y: 16, w: 20, h: 14 }, { t: 76, x: 40, y: 20, w: 20, h: 14 },
      { t: 84, x: 26, y: 20, w: 18, h: 13 }, { t: 88, x: 30, y: 22, w: 16, h: 12 },
      { t: 92, x: 42, y: 0, w: 16, h: 12 },
      { t: 96, x: 26, y: 0, w: 16, h: 10 }, { t: 100, x: 36, y: 0, w: 16, h: 10 },
      { t: 104, x: 24, y: 0, w: 18, h: 12 }, { t: 107.5, x: 22, y: 8, w: 18, h: 14 },
    ] },
  { id: 'emphone-c', kind: 'product', label: "Emily's phone", box: { x: 70, y: 40, w: 15, h: 40 }, from: 75.5, to: 108, provenance: 'detected',
    track: [
      { t: 76, x: 76, y: 8, w: 14, h: 40 }, { t: 80, x: 32, y: 78, w: 12, h: 22 },
      { t: 84, x: 54, y: 58, w: 16, h: 42 }, { t: 88, x: 58, y: 58, w: 14, h: 42 },
      { t: 92, x: 84, y: 54, w: 14, h: 46 }, { t: 100, x: 72, y: 58, w: 12, h: 42 },
      { t: 104, x: 80, y: 18, w: 18, h: 46 }, { t: 107.5, x: 60, y: 44, w: 18, h: 46 },
    ] },
  { id: 'chainbag-f', kind: 'product', label: 'Chain bag', box: { x: 52, y: 38, w: 10, h: 52 }, from: 64, to: 108, provenance: 'detected' },

  // Beat 8 (108–121) — the phone-mirror selfie
  { id: 'emily-f', kind: 'person', label: 'Emily', box: { x: 20, y: 4, w: 40, h: 96 }, from: 108, to: 121, provenance: 'detected',
    track: [
      { t: 109, x: 76, y: 12, w: 24, h: 88 }, { t: 111, x: 20, y: 0, w: 40, h: 100 },
      { t: 113, x: 0, y: 0, w: 46, h: 100 }, { t: 117, x: 0, y: 0, w: 40, h: 100 },
      { t: 119, x: 40, y: 10, w: 40, h: 90 }, { t: 120, x: 74, y: 18, w: 26, h: 82 },
    ] },
  { id: 'emphone-d', kind: 'product', label: "Emily's phone", box: { x: 50, y: 10, w: 40, h: 88 }, from: 108, to: 121, provenance: 'detected',
    track: [
      { t: 109, x: 80, y: 40, w: 14, h: 50 }, { t: 111, x: 60, y: 10, w: 38, h: 90 },
      { t: 113, x: 64, y: 2, w: 36, h: 98 }, { t: 117, x: 28, y: 0, w: 50, h: 100 },
      { t: 119, x: 60, y: 30, w: 30, h: 65 }, { t: 120, x: 80, y: 44, w: 14, h: 42 },
    ] },
  { id: 'evelyn-h1', kind: 'person', label: 'Evelyn', box: { x: 40, y: 10, w: 30, h: 90 }, from: 108, to: 114.5, provenance: 'detected',
    track: [{ t: 109, x: 32, y: 0, w: 46, h: 100 }, { t: 113, x: 46, y: 14, w: 16, h: 50 }] },
  { id: 'evelyn-h2', kind: 'person', label: 'Evelyn', box: { x: 10, y: 10, w: 20, h: 90 }, from: 114.5, to: 121, provenance: 'detected',
    track: [{ t: 117, x: 0, y: 10, w: 8, h: 90 }, { t: 120, x: 36, y: 10, w: 38, h: 90 }] },
  { id: 'sunnies-e', kind: 'product', label: 'Sunglasses', box: { x: 44, y: 4, w: 14, h: 12 }, from: 108, to: 112.5, provenance: 'detected' },
  { id: 'sunnies-e2', kind: 'product', label: 'Sunglasses', box: { x: 40, y: 28, w: 14, h: 18 }, from: 119, to: 121, provenance: 'detected' },

  // Beat 9 (121–135) + the walk into beat 10 (Evelyn holds frame to ~142.5)
  { id: 'art-f', kind: 'set', label: 'Wall art', box: { x: 16, y: 1, w: 20, h: 36 }, from: 121, to: 139, provenance: 'detected' },
  { id: 'evelyn-h', kind: 'person', label: 'Evelyn', box: { x: 28, y: 4, w: 40, h: 96 }, from: 121, to: 142.5, provenance: 'detected',
    track: [
      { t: 122, x: 30, y: 15, w: 42, h: 85 }, { t: 126, x: 26, y: 4, w: 36, h: 96 },
      { t: 130, x: 24, y: 10, w: 42, h: 90 }, { t: 134, x: 24, y: 0, w: 38, h: 100 },
      { t: 136, x: 30, y: 0, w: 44, h: 100 }, { t: 138.5, x: 30, y: 0, w: 36, h: 100 },
      { t: 141, x: 24, y: 0, w: 54, h: 100 },
    ] },
  { id: 'emily-g', kind: 'person', label: 'Emily', box: { x: 74, y: 18, w: 26, h: 82 }, from: 121, to: 139.5, provenance: 'detected',
    track: [
      { t: 122, x: 74, y: 20, w: 26, h: 80 }, { t: 126, x: 60, y: 18, w: 36, h: 82 },
      { t: 130, x: 74, y: 14, w: 26, h: 86 }, { t: 134, x: 84, y: 20, w: 16, h: 80 },
      { t: 136, x: 82, y: 18, w: 18, h: 82 }, { t: 138.5, x: 72, y: 18, w: 28, h: 82 },
    ] },
  { id: 'sunnies-c', kind: 'product', label: 'Sunglasses', box: { x: 40, y: 15, w: 15, h: 13 }, from: 121, to: 142.5, provenance: 'detected',
    track: [
      { t: 122, x: 40, y: 20, w: 16, h: 14 }, { t: 130, x: 36, y: 15, w: 14, h: 13 },
      { t: 136, x: 40, y: 12, w: 16, h: 12 }, { t: 141, x: 36, y: 4, w: 26, h: 20 },
    ] },
  { id: 'emphone-e', kind: 'product', label: "Emily's phone", box: { x: 74, y: 45, w: 14, h: 40 }, from: 121, to: 139.5, provenance: 'detected',
    track: [
      { t: 122, x: 80, y: 48, w: 14, h: 42 }, { t: 126, x: 58, y: 54, w: 14, h: 40 },
      { t: 130, x: 78, y: 28, w: 16, h: 46 }, { t: 134, x: 76, y: 68, w: 14, h: 32 },
      { t: 136, x: 84, y: 60, w: 14, h: 40 },
    ] },
  { id: 'chainbag-g', kind: 'product', label: 'Chain bag', box: { x: 42, y: 40, w: 12, h: 50 }, from: 121, to: 142.5, provenance: 'detected',
    track: [{ t: 126, x: 38, y: 80, w: 14, h: 20 }, { t: 130, x: 42, y: 40, w: 12, h: 50 }] },

  // Beat 10 (135–157) — the Lego art wall pan (pieces enter ~143)
  { id: 'lips-a', kind: 'prop', label: 'Lego lips', box: { x: 8, y: 0, w: 30, h: 45 }, from: 143, to: 153.5, provenance: 'detected',
    track: [
      { t: 144, x: 30, y: 0, w: 28, h: 52 }, { t: 147, x: 0, y: 0, w: 30, h: 38 },
      { t: 149, x: 0, y: 0, w: 24, h: 30 }, { t: 152, x: 0, y: 0, w: 44, h: 42 },
    ] },
  { id: 'floral-a', kind: 'prop', label: 'Lego florals', box: { x: 40, y: 12, w: 33, h: 75 }, from: 143, to: 153.5, provenance: 'detected',
    track: [
      { t: 144, x: 66, y: 22, w: 34, h: 73 }, { t: 147, x: 26, y: 8, w: 36, h: 77 },
      { t: 149, x: 42, y: 5, w: 32, h: 70 }, { t: 152, x: 46, y: 15, w: 30, h: 73 },
    ] },
  { id: 'marilyn-a', kind: 'prop', label: 'Lego Marilyn', box: { x: 75, y: 2, w: 25, h: 50 }, from: 145.5, to: 153.5, provenance: 'detected',
    track: [{ t: 147, x: 70, y: 2, w: 30, h: 50 }, { t: 148, x: 61, y: 3, w: 26, h: 52 }, { t: 149, x: 76, y: 5, w: 24, h: 53 }, { t: 152, x: 78, y: 0, w: 22, h: 48 }] },
  { id: 'starry-a', kind: 'prop', label: 'Lego Starry Night', box: { x: 79, y: 58, w: 21, h: 42 }, from: 148, to: 153.5, provenance: 'detected',
    track: [{ t: 148, x: 64, y: 58, w: 24, h: 40 }, { t: 149, x: 78, y: 62, w: 22, h: 38 }, { t: 152, x: 80, y: 55, w: 20, h: 45 }] },
  { id: 'mirror-b', kind: 'prop', label: 'Mirror', box: { x: 10, y: 52, w: 32, h: 48 }, from: 143, to: 153.5, provenance: 'detected',
    track: [
      { t: 144, x: 32, y: 62, w: 34, h: 38 }, { t: 147, x: 0, y: 55, w: 22, h: 45 },
      { t: 149, x: 0, y: 48, w: 36, h: 52 }, { t: 152, x: 28, y: 55, w: 34, h: 45 },
    ] },
  { id: 'emily-h', kind: 'person', label: 'Emily', box: { x: 20, y: 64, w: 13, h: 36 }, from: 143.5, to: 153.5, provenance: 'detected',
    track: [
      { t: 144, x: 38, y: 70, w: 12, h: 30 }, { t: 147, x: 0, y: 68, w: 10, h: 32 },
      { t: 149, x: 4, y: 60, w: 16, h: 40 }, { t: 152, x: 34, y: 62, w: 12, h: 38 },
    ] },
  { id: 'evelyn-j', kind: 'person', label: 'Evelyn', box: { x: 40, y: 62, w: 9, h: 36 }, from: 149.5, to: 153.5, provenance: 'detected',
    track: [{ t: 149.5, x: 24, y: 62, w: 10, h: 33 }, { t: 152, x: 54, y: 62, w: 8, h: 38 }] },

  // Beat 10's coda (~154–157) — back on the sisters
  { id: 'evelyn-k', kind: 'person', label: 'Evelyn', box: { x: 32, y: 0, w: 54, h: 100 }, from: 153.5, to: 157, provenance: 'detected' },
  { id: 'emily-i2', kind: 'person', label: 'Emily', box: { x: 0, y: 50, w: 22, h: 50 }, from: 153.5, to: 157, provenance: 'detected' },
  { id: 'vlogcam-b', kind: 'product', label: 'Vlog camera', box: { x: 52, y: 55, w: 12, h: 40 }, from: 153.5, to: 157, provenance: 'detected' },
  { id: 'emphone-f', kind: 'product', label: "Emily's phone", box: { x: 4, y: 54, w: 10, h: 36 }, from: 153.5, to: 157, provenance: 'detected' },

  // Beat 11 (157–164) — sidewalk POV, then piling into the car
  { id: 'backseat-a', kind: 'set', label: 'Back seat', box: { x: 0, y: 0, w: 100, h: 100 }, from: 160.5, to: 164, provenance: 'detected' },
  { id: 'driver-a', kind: 'person', label: 'Driver', box: { x: 74, y: 2, w: 22, h: 46 }, from: 160.5, to: 164, provenance: 'detected' },
  { id: 'emily-i', kind: 'person', label: 'Emily', box: { x: 0, y: 25, w: 38, h: 75 }, from: 160.5, to: 164, provenance: 'detected',
    track: [{ t: 161.5, x: 0, y: 42, w: 32, h: 58 }, { t: 163.5, x: 0, y: 12, w: 44, h: 88 }] },

  // Beat 12 (164–180) — the back-seat sign-off
  { id: 'backseat-b', kind: 'set', label: 'Back seat', box: { x: 0, y: 35, w: 100, h: 65 }, from: 164, to: 180, provenance: 'detected' },
  { id: 'carwindow-a', kind: 'set', label: 'Car window', box: { x: 66, y: 0, w: 34, h: 55 }, from: 164, to: 180, provenance: 'detected',
    track: [{ t: 165, x: 72, y: 0, w: 28, h: 60 }, { t: 170, x: 66, y: 0, w: 34, h: 52 }, { t: 175, x: 70, y: 0, w: 30, h: 50 }] },
  { id: 'evelyn-i', kind: 'person', label: 'Evelyn', box: { x: 14, y: 0, w: 60, h: 100 }, from: 164, to: 180, provenance: 'detected',
    track: [
      { t: 165, x: 12, y: 0, w: 60, h: 100 }, { t: 170, x: 8, y: 0, w: 58, h: 100 },
      { t: 175, x: 18, y: 0, w: 56, h: 100 }, { t: 179, x: 22, y: 0, w: 56, h: 100 },
    ] },
];

export const subjectById = (id: string): Subject =>
  SUBJECTS.find((s) => s.id === id) ?? SUBJECTS[0];

/** Everything in frame at a given moment — the HUD's contents, and the only
 *  legal object targets for a mark placed at that moment. */
export const subjectsAt = (t: number): Subject[] =>
  SUBJECTS.filter((s) => t >= s.from && t < s.to);

/** Subjects available anywhere inside a window, for the inspectors' pickers. */
export const subjectsIn = (from: number, to: number): Subject[] =>
  SUBJECTS.filter((s) => s.from < to && s.to > from);

/* --- Attention: marks on a line --------------------------------------------
   Each mark STARTS the state it names, and that state holds until the next
   mark. Three kinds, one glyph each:

     ● object — the eye is on a subject from the graph
     ✼ area   — the eye is on a region of the frame (no detection needed)
     ○ none   — no preference; the run after it greys out

   No open/close pairs: every marker means one thing wherever it sits, and every
   transition — object→none, area→object, none→area — is exactly one mark. */

export type AttentionKind = 'object' | 'area' | 'none';

/** A drawn region of the frame: a rectangle in stage percentages, so it rides
 *  the framing transform exactly like the object graph's boxes. */
export type AreaRegion = { x: number; y: number; w: number; h: number };

/** The model names a fresh region from where it sits ("middle bottom"), per
 *  the design. Overridable in the inspector. */
export function autoAreaName(r: AreaRegion): string {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const col = cx < 34 ? 'left' : cx > 66 ? 'right' : 'middle';
  const row = cy < 34 ? 'top' : cy > 66 ? 'bottom' : 'middle';
  return col === 'middle' && row === 'middle' ? 'middle' : `${col} ${row}`;
}

export type AttentionMark = {
  id: string;
  /** When this state takes over, in seconds. */
  t: number;
  kind: AttentionKind;
  /** kind === 'object': which subject holds the eye. */
  subjectId?: string;
  /** kind === 'area': a free label for the drawn region. */
  areaLabel?: string;
  /** kind === 'area': the drawn region itself. */
  area?: AreaRegion;
};

/** Closest two marks may sit — keeps glyphs clickable at any zoom. */
export const MIN_MARK_GAP = 0.25;

/** There is always a mark at t = 0, so every instant has a state in force.
 *  Placeholder intent for the vlog take — rough passes to revisit, not a real
 *  authored route yet. */
export const ATTENTION_MARKS: AttentionMark[] = [
  { id: 'm0', t: 0, kind: 'object', subjectId: 'evelyn-a' },
  { id: 'm1', t: 14, kind: 'area', areaLabel: 'Wall art', area: { x: 4, y: 6, w: 34, h: 42 } },
  { id: 'm2', t: 31, kind: 'none' },
  { id: 'm3', t: 47, kind: 'area', areaLabel: 'Sunglasses', area: { x: 34, y: 24, w: 30, h: 34 } },
  { id: 'm4', t: 76, kind: 'none' },
  { id: 'm5', t: 113, kind: 'area', areaLabel: 'Phone screen', area: { x: 56, y: 30, w: 26, h: 40 } },
  { id: 'm6', t: 142, kind: 'area', areaLabel: 'Lego wall', area: { x: 16, y: 4, w: 66, h: 44 } },
  { id: 'm7', t: 166, kind: 'none' },
];

/** A derived stretch between two marks. `mark` is the mark that starts it. */
export type AttentionRun = {
  mark: AttentionMark;
  start: number;
  end: number;
};

export function marksToRuns(marks: AttentionMark[], duration: number): AttentionRun[] {
  const sorted = [...marks].sort((a, b) => a.t - b.t);
  return sorted.map((mark, i) => ({
    mark,
    start: mark.t,
    end: i < sorted.length - 1 ? sorted[i + 1].t : duration,
  }));
}

/** The mark in force at time `t`. */
export function attentionAt(marks: AttentionMark[], t: number): AttentionMark {
  const sorted = [...marks].sort((a, b) => a.t - b.t);
  let live = sorted[0];
  for (const m of sorted) {
    if (m.t <= t) live = m;
    else break;
  }
  return live;
}

/** Display label for a mark's target. */
export function markLabel(mark: AttentionMark): string {
  if (mark.kind === 'object') return subjectById(mark.subjectId ?? '').label;
  if (mark.kind === 'area') return mark.areaLabel ?? 'Area';
  return 'None';
}

/* --- Camera state (rig · framing · anchor · stability) ----------------------
   A camera state is a virtual reframe of the one raw take, not a separate
   render — which is why the preview can apply it as a transform and why a
   state boundary can move without anything re-rendering. Four properties,
   per the design's Edit Camera State panel:
     rig       — how the camera is held (flavour; names the clip)
     framing   — how tight the crop is (drives the zoom)
     anchor    — what the crop centres on (face / object / environment)
     stability — 0–100, how steady the rig is (flavour; names the clip) */

export type CameraRig = 'selfie' | 'handheld' | 'static' | 'drone' | 'pov';

export const CAMERA_RIGS: { id: CameraRig; label: string }[] = [
  { id: 'selfie', label: 'Selfie' },
  { id: 'handheld', label: 'Handheld' },
  { id: 'static', label: 'Static' },
  { id: 'drone', label: 'Drone' },
  { id: 'pov', label: 'POV' },
];

export type ShotPreset = 'wide' | 'medium' | 'cu' | 'xcu';

export const SHOT_PRESETS: { id: ShotPreset; label: string; zoom: number }[] = [
  { id: 'wide', label: 'Wide', zoom: 1 },
  { id: 'medium', label: 'Medium', zoom: 1.45 },
  { id: 'cu', label: 'Close up', zoom: 2.1 },
  { id: 'xcu', label: 'Extreme close up', zoom: 2.8 },
];

/** What the crop centres on. `face` finds the person in frame, `object` uses
 *  the state's own subject, `environment` keeps the frame's centre. */
export type CameraAnchor = 'face' | 'object' | 'environment';

export const CAMERA_ANCHORS: { id: CameraAnchor; label: string }[] = [
  { id: 'face', label: 'Face Track' },
  { id: 'object', label: 'Object' },
  { id: 'environment', label: 'Environment' },
];

/** A shot's framing as numbers: zoom + translate (in full-frame %). */
export type Framing = { z: number; dx: number; dy: number };

/**
 * The framing a shot applies to the stage. Derived from the SUBJECT rather
 * than hand-tuned: a close-up on the bottle crops to the bottle, so the clip's
 * tag and the picture can't disagree. The translate is clamped to what the
 * scaled frame can still cover.
 */
export function framingParams(preset: ShotPreset, subject: Subject | undefined): Framing {
  const p = SHOT_PRESETS.find((x) => x.id === preset);
  if (!p || p.zoom === 1 || !subject) return { z: 1, dx: 0, dy: 0 };
  const limit = 50 - 50 / p.zoom;
  const clamp = (v: number) => Math.max(-limit, Math.min(limit, v));
  return {
    z: p.zoom,
    dx: clamp(50 - (subject.box.x + subject.box.w / 2)),
    dy: clamp(50 - (subject.box.y + subject.box.h / 2)),
  };
}

/** The framing as a CSS transform — applied to the VIDEO only. */
export function framingFor(preset: ShotPreset, subject: Subject | undefined): string {
  const f = framingParams(preset, subject);
  return f.z === 1 ? 'scale(1)' : `scale(${f.z}) translate(${f.dx}%, ${f.dy}%)`;
}

/**
 * Where a full-frame rect lands ON SCREEN under a framing. The HUD maps its
 * geometry through this instead of riding the video's CSS transform, so boxes
 * track their subjects through any crop while strokes, chips and corner
 * handles keep their true size — labelling is chrome, and chrome never zooms.
 */
export function mapRegion(f: Framing, r: AreaRegion): AreaRegion {
  return {
    x: 50 + (r.x + f.dx - 50) * f.z,
    y: 50 + (r.y + f.dy - 50) * f.z,
    w: r.w * f.z,
    h: r.h * f.z,
  };
}

/**
 * Intersect a screen-space rect with the frame. A box may cover the whole
 * frame or, under a crop, spill past its edges — the drawn selection must
 * never exceed the picture. `null` when the crop pushes it (almost) fully
 * out of view, so callers can skip drawing it at all.
 */
export function clipRegion(r: AreaRegion): AreaRegion | null {
  const x1 = Math.max(0, r.x);
  const y1 = Math.max(0, r.y);
  const x2 = Math.min(100, r.x + r.w);
  const y2 = Math.min(100, r.y + r.h);
  if (x2 - x1 < 2 || y2 - y1 < 2) return null;
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/** The cast. Evelyn hosts and holds the camera most of the take; Emily is her
 *  sister — on camera too, and the voice teasing from behind the lens when
 *  she isn't. */
export const SPEAKERS = ['Evelyn', 'Emily'] as const;

/** Shortest shot a trim will let you squeeze a clip down to. */
export const MIN_SHOT_SEC = 0.5;

export type Shot = {
  id: string;
  rig: CameraRig;
  preset: ShotPreset;
  anchor: CameraAnchor;
  /** 0–100, how steady the rig is. */
  stability: number;
  start: number;
  end: number;
  /** The `object` anchor's target; `face` finds the person on its own. */
  subjectId: string;
};

/** The state's derived name — "Selfie - Wide - Face Track - 42". Both the
 *  panel's summary row and the timeline clip wear it, so they can't disagree. */
export function cameraStateName(shot: Shot): string {
  const rig = CAMERA_RIGS.find((r) => r.id === shot.rig) ?? CAMERA_RIGS[0];
  const framing = SHOT_PRESETS.find((p) => p.id === shot.preset) ?? SHOT_PRESETS[0];
  const anchor = CAMERA_ANCHORS.find((a) => a.id === shot.anchor) ?? CAMERA_ANCHORS[0];
  return `${rig.label} - ${framing.label} - ${anchor.label} - ${Math.round(shot.stability)}`;
}

/** The subject the crop should centre on, per the state's anchor. */
export function framingSubject(shot: Shot): Subject | undefined {
  if (shot.anchor === 'environment') return undefined;
  if (shot.anchor === 'face') {
    return (
      subjectsIn(shot.start, shot.end).find((s) => s.kind === 'person') ??
      subjectById(shot.subjectId)
    );
  }
  return subjectById(shot.subjectId);
}

/* Camera states read off the real take (rough pass — the whole video is one
   handheld gimbal camera, so the states describe how it's being held moment to
   moment, not separate renders). Every preset is WIDE by Jesslyn's call: the
   footage plays as shot, no virtual reframe/zoom on the stage — the rig,
   anchor and stability fields stay as descriptive annotation only:
     0–7      Emily films Evelyn's welcome shrug across the living room
     7–10     both goof at the lens by the window
     10–30    Evelyn talks to camera at arm's length down the hallway
     30–37    the full-length mirror check (camera filming the reflection)
     37–54    sunglasses try-on, arm's-length again
     54–64    camera turns onto Emily for her wishlist
     64–108   the long hangout: glasses debate + group-chat news
     108–121  camera-roll reactions, held close between the two of them
     121–135  posing round, camera drifting around Evelyn
     135–157  walk-out + the pan up the Lego art wall
     157–164  camera dropped to the sidewalk, then into the car
     164–180  backseat ride, propped facing Evelyn                        */
export const SHOTS: Shot[] = [
  { id: 's1', rig: 'handheld', preset: 'wide', anchor: 'face', stability: 38, start: 0, end: 7, subjectId: 'evelyn-a' },
  { id: 's2', rig: 'handheld', preset: 'wide', anchor: 'face', stability: 30, start: 7, end: 10, subjectId: 'evelyn-b' },
  { id: 's3', rig: 'selfie', preset: 'wide', anchor: 'face', stability: 48, start: 10, end: 30, subjectId: 'evelyn-c' },
  { id: 's4', rig: 'handheld', preset: 'wide', anchor: 'environment', stability: 42, start: 30, end: 37, subjectId: 'mirror-a' },
  { id: 's5', rig: 'selfie', preset: 'wide', anchor: 'face', stability: 50, start: 37, end: 54, subjectId: 'evelyn-e' },
  { id: 's6', rig: 'handheld', preset: 'wide', anchor: 'face', stability: 44, start: 54, end: 64, subjectId: 'emily-d' },
  { id: 's7', rig: 'selfie', preset: 'wide', anchor: 'face', stability: 46, start: 64, end: 108, subjectId: 'evelyn-g' },
  { id: 's8', rig: 'selfie', preset: 'wide', anchor: 'face', stability: 36, start: 108, end: 121, subjectId: 'emily-f' },
  { id: 's9', rig: 'handheld', preset: 'wide', anchor: 'face', stability: 40, start: 121, end: 135, subjectId: 'evelyn-h' },
  { id: 's10', rig: 'handheld', preset: 'wide', anchor: 'environment', stability: 28, start: 135, end: 157, subjectId: 'marilyn-a' },
  { id: 's11', rig: 'pov', preset: 'wide', anchor: 'environment', stability: 18, start: 157, end: 164, subjectId: 'backseat-a' },
  { id: 's12', rig: 'selfie', preset: 'wide', anchor: 'face', stability: 55, start: 164, end: SCENE_DURATION, subjectId: 'evelyn-i' },
];

/* --- Script ------------------------------------------------------------------ */

/** One spoken word with its own window, so the playback highlight lands on the
 *  word actually being said instead of being guessed from pixel offsets. */
export type Word = { t: string; start: number; end: number };

/** Distribute a line's words across its window, weighting each by length so
 *  longer words hold longer. Stands in for real per-word speech timings. */
export function speak(text: string, start: number, end: number): Word[] {
  const parts = text.split(/\s+/).filter(Boolean);
  const total = parts.reduce((n, w) => n + w.length + 1, 0);
  let t = start;
  return parts.map((w) => {
    const d = ((w.length + 1) / total) * (end - start);
    const word = { t: w, start: t, end: t + d };
    t += d;
    return word;
  });
}

/** The window a fresh line should hold, in seconds: wide enough that its word
 *  badges fit at the design zoom (chip metrics from .anim-word), never under a
 *  second — pressing Enter is what sizes the clip. */
export function scriptWindow(text: string): number {
  const parts = text.split(/\s+/).filter(Boolean);
  if (!parts.length) return 1;
  const chips = parts.reduce((n, w) => n + w.length * 6.8 + 10, 0);
  const px = chips + (parts.length - 1) * 2 + 16; // + gaps + body padding
  return Math.max(1, px / DEFAULT_PX_PER_SEC);
}

export type ScriptClip = {
  id: string;
  start: number;
  end: number;
  /** The spoken line, per word. Short marker clips carry `label` instead. */
  words?: Word[];
  label?: string;
};

/** The whole line as one string, for the inspector's text field. */
export const clipText = (c: ScriptClip): string =>
  c.label ?? (c.words ?? []).map((w) => w.t).join(' ');

/* --- Interactions (gesture) --------------------------------------------------- */

/** A reaction performed by one member of the cast. `triggerId` names the script
 *  clip whose delivery it reacts to — the actor and the speaker are often
 *  different people, which is exactly what the connector lines draw. */
export type Interaction = {
  id: string;
  emoji: string;
  label: string;
  /** A free note on how the gesture should read — the user's own words. */
  description?: string;
  start: number;
  end: number;
  triggerId?: string;
};

/** Named for what each emoji means IN THIS TAKE — the same glyph can read
 *  several ways, so the label pins the one the footage shows. */
export const EMOJI_CHOICES: { emoji: string; label: string }[] = [
  { emoji: '😂', label: ':cracking-up' },
  { emoji: '🤷', label: ':welcome-shrug' },
  { emoji: '😎', label: ':sunglasses-on' },
  { emoji: '👏', label: ':clapping' },
  { emoji: '😘', label: ':blow-kiss' },
  { emoji: '💁', label: ':hair-flip' },
  { emoji: '📱', label: ':phone-scroll' },
  { emoji: '💅', label: ':touch-up' },
  { emoji: '😔', label: ':pouty-face' },
  { emoji: '🤳', label: ':mirror-selfie' },
  { emoji: '👀', label: ':side-eye' },
  { emoji: '🫵', label: ':point-at-it' },
  { emoji: '👗', label: ':show-outfit' },
  { emoji: '😊', label: ':smiling' },
  { emoji: '🚶', label: ':walk-away' },
];

/** Shortest window an interaction can hold. */
export const MIN_CLIP_SEC = 0.25;

export type AvatarColor = 'purple' | 'pink' | 'green';

export type AvatarRow = {
  id: string;
  name: string;
  avatar: string;
  color: AvatarColor;
  /** Off-camera cast: present in the script and reaction lanes, absent from the
   *  object graph, because there is nothing of them in frame to point at. */
  offCamera?: boolean;
  scripts: ScriptClip[];
  interactions: Interaction[];
};

/* The dialogue below is the take's real transcript (whisper small.en over the
   footage's audio, timestamps preserved, obvious mishears cleaned up), split
   between the sisters by who is talking on screen at each moment. */
export const AVATAR_ROWS: AvatarRow[] = [
  {
    id: 'evelyn',
    name: 'Evelyn',
    avatar: '/assets/evelyn.jpg',
    color: 'purple',
    scripts: [
      { id: 'ev-1', start: 7.5, end: 11.3, words: speak('Welcome to my vlog in New York City', 7.5, 11.3) },
      {
        id: 'ev-2',
        start: 11.4,
        end: 17,
        words: speak('My sister is over in my apartment, obviously, because we are in my apartment, and we are going to be—', 11.4, 17),
      },
      { id: 'ev-3', start: 18, end: 20.9, words: speak('We are going to go vintage shopping', 18, 20.9) },
      {
        id: 'ev-4',
        start: 24.5,
        end: 30.3,
        words: speak('It was raining just like ten minutes ago and it stopped, so I think that is the sign', 24.5, 30.3),
      },
      {
        id: 'ev-5',
        start: 30.3,
        end: 35,
        words: speak('I still kind of wish I wore different pants actually, but this will do', 30.3, 35),
      },
      {
        id: 'ev-6',
        start: 35,
        end: 42.2,
        words: speak('We are just gonna be out for this vintage shop, and yeah, I will see if I get anything', 35, 42.2),
      },
      {
        id: 'ev-7',
        start: 42.2,
        end: 48.4,
        words: speak('I do not really know if I want anything to be honest, but we shall see', 42.2, 48.4),
      },
      { id: 'ev-8', start: 48.4, end: 53.7, words: speak('Oh my god, I do not even have my phone', 48.4, 53.7) },
      {
        id: 'ev-9',
        start: 60.8,
        end: 71.8,
        words: speak('I kind of want to get these glasses tightened a little bit on the side, but I love how big it is because it makes my face look small', 60.8, 71.8),
      },
      {
        id: 'ev-10',
        start: 74.7,
        end: 87.4,
        words: speak('Right now we are in a group chat with our show producer — as you guys know, we are hosting a show live in New York City, and we are having weekly meetings and planning what to do', 74.7, 87.4),
      },
      {
        id: 'ev-11',
        start: 87.4,
        end: 93,
        words: speak('I feel like we have not really talked about the behind the scenes about it, but we are going to be doing something really exciting', 87.4, 93),
      },
      {
        id: 'ev-12',
        start: 93,
        end: 98.4,
        words: speak('We are not just gonna be sitting and talking on stage, we are gonna make it like really, really interactive', 93, 98.4),
      },
      {
        id: 'ev-13',
        start: 102.4,
        end: 108.5,
        words: speak('So that I think is going to be so fun guys, I am really excited', 102.4, 108.5),
      },
      {
        id: 'ev-14',
        start: 112,
        end: 118.5,
        words: speak('Of course in her picture she looks good, and this is me making the ugliest face in the back', 112, 118.5),
      },
      { id: 'ev-15', start: 119.6, end: 122.5, words: speak('No, I think you did it on purpose', 119.6, 122.5) },
      {
        id: 'ev-16',
        start: 122.5,
        end: 132.4,
        words: speak('Comment down below if I should change up, like, the frames here — I am starting to get sick of it. What do you think, should I do something different?', 122.5, 132.4),
      },
      {
        id: 'ev-17',
        start: 132.4,
        end: 141.9,
        words: speak('Should I just, like, get rid of it and have a white background?', 132.4, 141.9),
      },
      {
        id: 'ev-18',
        start: 141.9,
        end: 150.7,
        words: speak('And also my Lego collection up here — I am also starting to get sick of this, so I kind of want to get rid of it', 141.9, 150.7),
      },
      { id: 'ev-19', start: 150.7, end: 153, words: speak('I do not know, maybe do something different', 150.7, 153) },
      {
        id: 'ev-20',
        start: 157.5,
        end: 162,
        words: speak('Immediately, immediately regretting my outfit', 157.5, 162),
      },
      { id: 'ev-21', start: 162, end: 164.4, words: speak('It is so hot right now', 162, 164.4) },
      { id: 'ev-22', start: 165.5, end: 166.3, label: 'yeah' },
      {
        id: 'ev-23',
        start: 166.3,
        end: 171.2,
        words: speak('It is ninety degrees outside and I am wearing long sleeve, both top and bottom', 166.3, 171.2),
      },
      { id: 'ev-24', start: 174.9, end: 176.4, words: speak('I do not know', 174.9, 176.4) },
      {
        id: 'ev-25',
        start: 176.5,
        end: 180,
        words: speak('You know what guys, we will be back — we will be back home so I can change', 176.5, 180),
      },
    ],
    interactions: [
      // Gestures, not reactions (no trigger): the opening clap, then the big
      // arms-out welcome shrug right after it.
      { id: 'ev-i0', emoji: '👏', label: ':clapping', start: 2.18, end: 3.3 },
      { id: 'ev-i1', emoji: '🤷', label: ':welcome-shrug', start: 3.34, end: 6.5 },
      // She cracks up at her own "we're in my apartment, obviously" bit — the
      // SAME window as Emily's laugh below, so the two connectors share one x
      // and read as a single chained line: script → Evelyn → Emily.
      { id: 'ev-i7', emoji: '😂', label: ':cracking-up', start: 15.84, end: 17.5, triggerId: 'ev-2' },
      { id: 'ev-i8', emoji: '👗', label: ':show-outfit', start: 30.47, end: 34.9 },
      { id: 'ev-i9', emoji: '💁', label: ':tidy-hair', start: 36.32, end: 38.5 },
      { id: 'ev-i2', emoji: '😎', label: ':sunglasses-on', start: 45, end: 48.33 },
      { id: 'ev-i10', emoji: '🚶', label: ':walk-away', start: 51.84, end: 54 },
      { id: 'ev-i11', emoji: '😊', label: ':smiling', start: 73.4, end: 75.4 },
      { id: 'ev-i3', emoji: '💁', label: ':hair-flip', start: 108.5, end: 111.5 },
      { id: 'ev-i4', emoji: '🫵', label: ':point-at-it', start: 133, end: 136.5, triggerId: 'ev-16' },
      // The mirror-selfie kiss that earns Emily's "what are you doing?"
      { id: 'ev-i5', emoji: '😘', label: ':blow-kiss', start: 152, end: 155 },
      { id: 'ev-i6', emoji: '😔', label: ':pouty-face', start: 174.9, end: 176.5 },
    ],
  },
  {
    id: 'emily',
    name: 'Emily',
    avatar: '/assets/emily.jpg',
    color: 'pink',
    scripts: [
      {
        id: 'em-1',
        start: 4.35,
        end: 7.4,
        words: speak('Why do you act like you have never vlogged before in your life?', 4.35, 7.4),
      },
      { id: 'em-2', start: 17, end: 18, words: speak('We are going vintage shopping!', 17, 18) },
      {
        id: 'em-3',
        start: 20.9,
        end: 24.5,
        words: speak('I am so excited — I want a Fendi bag so bad, you guys', 20.9, 24.5),
      },
      {
        id: 'em-4',
        start: 53.7,
        end: 60.8,
        words: speak('So excited. I really hope there is a bag for me, and if not maybe some sunglasses, because I really want some cool sunnies', 53.7, 60.8),
      },
      { id: 'em-5', start: 71.8, end: 74.7, words: speak('It is such a huge—', 71.8, 74.7) },
      {
        id: 'em-6',
        start: 98.4,
        end: 102.4,
        words: speak('It is going to be like a YouTube video, IRL, yeah', 98.4, 102.4),
      },
      { id: 'em-7', start: 118.5, end: 119.6, label: 'like, definitely!' },
      { id: 'em-8', start: 153, end: 154.6, words: speak('What are you doing??', 153, 154.6) },
      { id: 'em-9', start: 164.4, end: 165.4, label: 'it is?' },
      { id: 'em-10', start: 171.9, end: 174.9, words: speak('Why did you do that?', 171.9, 174.9) },
    ],
    interactions: [
      // She loses it at Evelyn's "we're in my apartment, obviously".
      { id: 'em-i7', emoji: '😂', label: ':cracking-up', start: 15.84, end: 17.5, triggerId: 'ev-2' },
      { id: 'em-i2', emoji: '💅', label: ':touch-up', start: 25, end: 29 },
      { id: 'em-i8', emoji: '📱', label: ':phone-scroll', start: 30.37, end: 34.92 },
      { id: 'em-i9', emoji: '📱', label: ':phone-scroll', start: 48.52, end: 53 },
      // Holds the mirror photo up to the lens while Evelyn complains about it.
      { id: 'em-i4', emoji: '🤳', label: ':show-the-photo', start: 111.5, end: 118.5, triggerId: 'ev-14' },
      { id: 'em-i5', emoji: '😂', label: ':cracking-up', start: 118.5, end: 122, triggerId: 'ev-14' },
      { id: 'em-i6', emoji: '👀', label: ':side-eye', start: 166.5, end: 171, triggerId: 'ev-23' },
    ],
  },
];

/* --- Selection ------------------------------------------------------------
   One selected object at a time, across every lane. An attention selection
   points at a MARK — selecting a run selects the mark that starts it. */

export type TimelineSelection =
  | { kind: 'attention'; id: string }
  | { kind: 'shot'; id: string }
  | { kind: 'script'; id: string }
  | { kind: 'interaction'; id: string };

/* --- Lane geometry --------------------------------------------------------
   Every lane is 52px tall and every clip 36px, centred. The connector lines
   are derived from these numbers at render time rather than hardcoded, so a
   clip that moves takes its line with it. */

export const LANE_H = 52;
export const CLIP_H = 36;
/** Lane index → y offset from the top of the track stack. */
export const laneTop = (index: number): number => index * LANE_H;

/* --- Presence: a subject's on-screen life -----------------------------------
   The subject lens's single track. Entities GROUP the time-scoped subject
   instances above (six Olivias are one person), and their presence runs are
   hand-authored demo data standing in for detection: a run is a stretch where
   the entity is actually in frame. Unlike shots, runs are NOT contiguous —
   the gaps are the point (absence is a real state) — so a bead trims freely
   against its own run instead of rolling a neighbour. */

export type PresenceRun = { id: string; start: number; end: number };

export type PresenceEntity = {
  id: string;
  label: string;
  kind: SubjectKind;
  /** The subject instances that carry this entity's boxes, beat by beat. */
  memberIds: string[];
  runs: PresenceRun[];
};

export const MIN_PRESENCE_SEC = 0.25;

/** The take's full component roster — every entity the lens can open, each
 *  grouping its beat-scoped instances above. Ordered background → foreground:
 *  the HUD renders boxes in this order, so big set pieces sit UNDER people,
 *  and hand-held products stay on top where the cursor can always reach them.
 *  Runs are hand-authored from the footage; every run wears beads on both
 *  ends. Gaps are real absences (Emily ducks behind the camera twice). */
export const PRESENCE_ENTITIES: PresenceEntity[] = [
  // Set pieces (largest boxes — lowest hover priority)
  { id: 'closet', label: 'Closet doors', kind: 'set', memberIds: ['closet-a'], runs: [{ id: 'p-closet-1', start: 0, end: 6.2 }] },
  { id: 'sofa', label: 'Sofa', kind: 'set', memberIds: ['sofa-a'], runs: [{ id: 'p-sofa-1', start: 0, end: 7 }] },
  { id: 'ladder', label: 'Ladder shelf', kind: 'set', memberIds: ['ladder-a'], runs: [{ id: 'p-ladder-1', start: 0, end: 6.2 }] },
  { id: 'console', label: 'Console table', kind: 'set', memberIds: ['console-a'], runs: [{ id: 'p-console-1', start: 0, end: 6.3 }] },
  { id: 'backseat', label: 'Back seat', kind: 'set', memberIds: ['backseat-a', 'backseat-b'], runs: [{ id: 'p-backseat-1', start: 160.5, end: SCENE_DURATION }] },
  { id: 'carwindow', label: 'Car window', kind: 'set', memberIds: ['carwindow-a'], runs: [{ id: 'p-carwindow-1', start: 164, end: SCENE_DURATION }] },
  { id: 'pedestal', label: 'Pedestal', kind: 'set', memberIds: ['pedestal-a'], runs: [{ id: 'p-pedestal-1', start: 30, end: 35.2 }] },
  {
    id: 'art', label: 'Wall art', kind: 'set',
    memberIds: ['art-a', 'art-b', 'art-c', 'art-d', 'art-e', 'art-f'],
    runs: [
      { id: 'p-art-1', start: 7, end: 30 },
      { id: 'p-art-2', start: 37, end: 108 },
      { id: 'p-art-3', start: 121, end: 139 },
    ],
  },
  {
    id: 'mirror', label: 'Mirror', kind: 'prop',
    memberIds: ['mirror-a', 'mirror-b'],
    runs: [
      { id: 'p-mirror-1', start: 30, end: 35.2 },
      { id: 'p-mirror-2', start: 143, end: 153.5 },
    ],
  },
  // The Lego wall, piece by piece — all gone when the camera swings back
  { id: 'lips', label: 'Lego lips', kind: 'prop', memberIds: ['lips-a'], runs: [{ id: 'p-lips-1', start: 143, end: 153.5 }] },
  { id: 'floral', label: 'Lego florals', kind: 'prop', memberIds: ['floral-a'], runs: [{ id: 'p-floral-1', start: 143, end: 153.5 }] },
  { id: 'marilyn', label: 'Lego Marilyn', kind: 'prop', memberIds: ['marilyn-a'], runs: [{ id: 'p-marilyn-1', start: 145.5, end: 153.5 }] },
  { id: 'starry', label: 'Lego Starry Night', kind: 'prop', memberIds: ['starry-a'], runs: [{ id: 'p-starry-1', start: 148, end: 153.5 }] },
  // People
  { id: 'driver', label: 'Driver', kind: 'person', memberIds: ['driver-a'], runs: [{ id: 'p-driver-1', start: 160.5, end: 163 }] },
  {
    id: 'emily', label: 'Emily', kind: 'person',
    memberIds: ['emily-a', 'emily-b', 'emily-c', 'emily-d', 'emily-e', 'emily-e2', 'emily-f', 'emily-g', 'emily-h', 'emily-i2', 'emily-i'],
    runs: [
      { id: 'p-emily-1', start: 9.3, end: 35.2 },
      { id: 'p-emily-2', start: 40.5, end: 67 },
      { id: 'p-emily-3', start: 75.5, end: 139.5 },
      { id: 'p-emily-4', start: 143.5, end: 157 },
      { id: 'p-emily-5', start: 160.5, end: 164 },
    ],
  },
  {
    id: 'evelyn', label: 'Evelyn', kind: 'person',
    memberIds: ['evelyn-a', 'evelyn-b', 'evelyn-c', 'evelyn-d', 'evelyn-e', 'evelyn-f', 'evelyn-g', 'evelyn-h1', 'evelyn-h2', 'evelyn-h', 'evelyn-j', 'evelyn-k', 'evelyn-i'],
    runs: [
      { id: 'p-evelyn-1', start: 0, end: 51.5 },
      { id: 'p-evelyn-2', start: 57.5, end: 142.5 },
      { id: 'p-evelyn-3', start: 149.5, end: 157 },
      { id: 'p-evelyn-4', start: 164, end: SCENE_DURATION },
    ],
  },
  // Hand-held products (smallest boxes — top of the hover stack)
  {
    id: 'chainbag', label: 'Chain bag', kind: 'product',
    memberIds: ['chainbag-a', 'chainbag-b', 'chainbag-e', 'chainbag-i', 'chainbag-c', 'chainbag-d', 'chainbag-f', 'chainbag-g'],
    runs: [
      { id: 'p-chainbag-1', start: 0, end: 51.5 },
      { id: 'p-chainbag-2', start: 54, end: 142.5 },
    ],
  },
  { id: 'vlogcam', label: 'Vlog camera', kind: 'product', memberIds: ['vlogcam-a', 'vlogcam-b'], runs: [{ id: 'p-vlogcam-1', start: 30, end: 35.2 }, { id: 'p-vlogcam-2', start: 153.5, end: 157 }] },
  {
    id: 'emphone', label: "Emily's phone", kind: 'product',
    memberIds: ['emphone-a', 'emphone-b', 'emphone-c1', 'emphone-c2', 'emphone-c', 'emphone-d', 'emphone-e', 'emphone-f'],
    runs: [
      { id: 'p-emphone-1', start: 15, end: 22 },
      { id: 'p-emphone-2', start: 30, end: 35.2 },
      { id: 'p-emphone-3', start: 48, end: 67 },
      { id: 'p-emphone-4', start: 75.5, end: 139.5 },
      { id: 'p-emphone-5', start: 153.5, end: 157 },
    ],
  },
  {
    id: 'sunnies', label: 'Sunglasses', kind: 'product',
    memberIds: ['sunnies-a', 'sunnies-d', 'sunnies-b', 'sunnies-e', 'sunnies-e2', 'sunnies-c'],
    runs: [
      { id: 'p-sunnies-1', start: 44, end: 51.5 },
      { id: 'p-sunnies-2', start: 57.5, end: 142.5 },
    ],
  },
];
