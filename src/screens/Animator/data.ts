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

   The sample take is a morning-routine vlog with product placement in it, which
   is the case attention was designed for: the eye is supposed to land on the
   bottle, not on the presenter.
   ============================================================================ */

/** Sticky left column holding the lane icons / avatar portraits. */
export const RAIL = 42;

/* --- The raw take ----------------------------------------------------------
   Level 3 directs a WINDOW of the source footage, not the whole file.
   `SOURCE_IN` is where this take starts in the file, so timeline time `t` is
   source time `SOURCE_IN + t`. The placeholder take is the 8 storyboard
   thumbnails stacked into one 32s video (5 / 3 / 4 / 6 / 2.5 / 4.5 / 3 / 4s),
   so every annotation below is written against those cuts. */

export const SOURCE_VIDEO = '/assets/placeholder-take.webm';

/** How long each stacked thumbnail actually holds the screen — the take's
 *  real cuts. The filmstrip scrubber maps its equal-width thumbs through
 *  these, so its pin crosses a short scene fast and a long scene slowly, and
 *  the active thumb flips exactly when the picture does. */
export const TAKE_SEGMENT_DURATIONS = [5, 3, 4, 6, 2.5, 4.5, 3, 4];

/** Each segment's start time in the take, accumulated from the durations. */
export const TAKE_CUTS: number[] = TAKE_SEGMENT_DURATIONS.reduce<number[]>(
  (starts, _d, i) => [...starts, i === 0 ? 0 : starts[i - 1] + TAKE_SEGMENT_DURATIONS[i - 1]],
  [],
);
/** Where this take begins inside the source file, in seconds. */
export const SOURCE_IN = 0;
/** The take's length. Fixed by the footage — editing redistributes time inside
 *  it, it never changes the total. */
export const SCENE_DURATION = 32;
/** Shown in the standalone route's header; the Mirage flow passes its own. */
export const PROJECT_TITLE = 'I let AI plan my wedding';

/* --- Time base ------------------------------------------------------------- */

export const DEFAULT_PX_PER_SEC = 34.8; // the spacing the design was drawn at
export const MIN_PX_PER_SEC = 8;
export const MAX_PX_PER_SEC = 200;
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

export type Subject = {
  id: string;
  kind: SubjectKind;
  label: string;
  /** Percentages of the stage: left / top / width / height. */
  box: { x: number; y: number; w: number; h: number };
  /** The stretch of the take this subject is in frame for. */
  from: number;
  to: number;
  provenance: 'generated' | 'detected';
};

/* The take's beats, one per storyboard thumbnail:
     0–5     laundry closet — loading the washer
     5–8     living room — vacuuming by the dining table
     8–12    bathroom — hair goes up
     12–18   kitchen island — the plan, straight to camera
     18–20.5 kitchen counter — lemon and sparkling water (the product beat)
     20.5–32 sofa — the recap, straight to camera (three cuts, one room)     */

export const SUBJECTS: Subject[] = [
  // Beat 1 — laundry closet
  { id: 'olivia-a', kind: 'person', label: 'Olivia', box: { x: 42, y: 16, w: 26, h: 78 }, from: 0, to: 5, provenance: 'detected' },
  { id: 'washer', kind: 'prop', label: 'Washer dryer', box: { x: 58, y: 6, w: 32, h: 86 }, from: 0, to: 5, provenance: 'detected' },
  { id: 'basket', kind: 'prop', label: 'Laundry basket', box: { x: 2, y: 56, w: 34, h: 42 }, from: 0, to: 5, provenance: 'detected' },

  // Beat 2 — living room
  { id: 'olivia-b', kind: 'person', label: 'Olivia', box: { x: 38, y: 10, w: 20, h: 72 }, from: 5, to: 8, provenance: 'detected' },
  { id: 'vacuum', kind: 'prop', label: 'Vacuum', box: { x: 33, y: 58, w: 14, h: 34 }, from: 5, to: 8, provenance: 'detected' },
  { id: 'table', kind: 'set', label: 'Dining table', box: { x: 52, y: 40, w: 34, h: 48 }, from: 5, to: 8, provenance: 'detected' },
  { id: 'flowers', kind: 'prop', label: 'Flower vase', box: { x: 60, y: 18, w: 15, h: 32 }, from: 5, to: 8, provenance: 'detected' },
  { id: 'fan', kind: 'prop', label: 'Fan', box: { x: 5, y: 30, w: 13, h: 50 }, from: 5, to: 8, provenance: 'detected' },

  // Beat 3 — bathroom
  { id: 'olivia-c', kind: 'person', label: 'Olivia', box: { x: 27, y: 8, w: 36, h: 90 }, from: 8, to: 12, provenance: 'detected' },
  { id: 'towels', kind: 'prop', label: 'Towels', box: { x: 60, y: 62, w: 28, h: 32 }, from: 8, to: 12, provenance: 'detected' },

  // Beat 4 — kitchen island, to camera
  { id: 'olivia-d', kind: 'person', label: 'Olivia', box: { x: 16, y: 2, w: 52, h: 96 }, from: 12, to: 18, provenance: 'detected' },
  { id: 'island', kind: 'set', label: 'Kitchen island', box: { x: 66, y: 40, w: 33, h: 28 }, from: 12, to: 18, provenance: 'detected' },
  { id: 'pendants', kind: 'light', label: 'Pendant lights', box: { x: 70, y: 6, w: 22, h: 20 }, from: 12, to: 18, provenance: 'detected' },

  // Beat 5 — kitchen counter. The product beat.
  { id: 'olivia-e', kind: 'person', label: 'Olivia', box: { x: 33, y: 0, w: 38, h: 74 }, from: 18, to: 20.5, provenance: 'detected' },
  { id: 'perrier', kind: 'product', label: 'Maison Perrier', box: { x: 9, y: 44, w: 13, h: 52 }, from: 18, to: 20.5, provenance: 'detected' },
  { id: 'glass', kind: 'prop', label: 'Glass', box: { x: 50, y: 55, w: 13, h: 36 }, from: 18, to: 20.5, provenance: 'detected' },
  { id: 'lemon', kind: 'prop', label: 'Lemon', box: { x: 2, y: 76, w: 10, h: 16 }, from: 18, to: 20.5, provenance: 'detected' },
  { id: 'takeout', kind: 'product', label: 'Takeout trays', box: { x: 67, y: 62, w: 28, h: 34 }, from: 18, to: 20.5, provenance: 'detected' },
  { id: 'kettle', kind: 'prop', label: 'Kettle', box: { x: 7, y: 20, w: 14, h: 22 }, from: 18, to: 20.5, provenance: 'detected' },

  // Beats 6–8 — the sofa. Three cuts of the same setup, so one set of subjects.
  { id: 'olivia-f', kind: 'person', label: 'Olivia', box: { x: 28, y: 0, w: 46, h: 100 }, from: 20.5, to: SCENE_DURATION, provenance: 'detected' },
  { id: 'plant', kind: 'prop', label: 'Eucalyptus plant', box: { x: 2, y: 8, w: 26, h: 44 }, from: 20.5, to: SCENE_DURATION, provenance: 'detected' },
  { id: 'window', kind: 'light', label: 'Window light', box: { x: 10, y: 0, w: 18, h: 62 }, from: 20.5, to: SCENE_DURATION, provenance: 'detected' },
  { id: 'sofa', kind: 'set', label: 'Sofa', box: { x: 0, y: 56, w: 100, h: 44 }, from: 20.5, to: SCENE_DURATION, provenance: 'detected' },
  { id: 'doorway', kind: 'set', label: 'Doorway', box: { x: 74, y: 12, w: 20, h: 76 }, from: 20.5, to: SCENE_DURATION, provenance: 'detected' },
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

/** There is always a mark at t = 0, so every instant has a state in force. */
export const ATTENTION_MARKS: AttentionMark[] = [
  { id: 'm0', t: 0, kind: 'object', subjectId: 'olivia-a' },
  { id: 'm1', t: 3, kind: 'area', areaLabel: 'Basket corner', area: { x: 2, y: 54, w: 36, h: 44 } },
  { id: 'm2', t: 5, kind: 'object', subjectId: 'olivia-b' },
  { id: 'm3', t: 8, kind: 'none' },
  { id: 'm4', t: 12, kind: 'object', subjectId: 'olivia-d' },
  { id: 'm5', t: 18, kind: 'object', subjectId: 'perrier' },
  { id: 'm6', t: 20.5, kind: 'object', subjectId: 'olivia-f' },
  { id: 'm7', t: 28, kind: 'area', areaLabel: 'Sofa corner', area: { x: 0, y: 52, w: 44, h: 46 } },
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

/** The cast. Olivia presents on camera; Blake is off camera, which is why he has
 *  script and reaction lanes but never appears in the object graph. */
export const SPEAKERS = ['Olivia', 'Blake'] as const;

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

export const SHOTS: Shot[] = [
  { id: 's1', rig: 'handheld', preset: 'wide', anchor: 'environment', stability: 35, start: 0, end: 5, subjectId: 'olivia-a' },
  { id: 's2', rig: 'handheld', preset: 'wide', anchor: 'face', stability: 40, start: 5, end: 8, subjectId: 'olivia-b' },
  { id: 's3', rig: 'static', preset: 'medium', anchor: 'face', stability: 75, start: 8, end: 12, subjectId: 'olivia-c' },
  { id: 's4', rig: 'static', preset: 'wide', anchor: 'environment', stability: 85, start: 12, end: 18, subjectId: 'olivia-d' },
  { id: 's5', rig: 'handheld', preset: 'cu', anchor: 'object', stability: 42, start: 18, end: 20.5, subjectId: 'perrier' },
  { id: 's6', rig: 'selfie', preset: 'wide', anchor: 'face', stability: 50, start: 20.5, end: SCENE_DURATION, subjectId: 'olivia-f' },
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
  start: number;
  end: number;
  triggerId?: string;
};

export const EMOJI_CHOICES: { emoji: string; label: string }[] = [
  { emoji: '😂', label: ':joy' },
  { emoji: '🫶', label: ':heart-hands' },
  { emoji: '😛', label: ':tongue-out' },
  { emoji: '🤳', label: ':selfie' },
  { emoji: '😭', label: ':loudly-crying' },
  { emoji: '😔', label: ':pensive' },
  { emoji: '💪', label: ':flex' },
  { emoji: '🥺', label: ':pleading' },
  { emoji: '🤷', label: ':shrug' },
  { emoji: '🧍', label: ':standing' },
  { emoji: '🫵', label: ':point-at-you' },
  { emoji: '😱', label: ':scream' },
  { emoji: '🙅', label: ':no-good' },
  { emoji: '🚶', label: ':walking' },
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

export const AVATAR_ROWS: AvatarRow[] = [
  {
    id: 'olivia',
    name: 'Olivia',
    avatar: '/assets/avatar-olivia-chip.jpg',
    color: 'purple',
    scripts: [
      {
        id: 'ol-1',
        start: 0.5,
        end: 4.5,
        words: speak('Laundry in first because this pile is out of control', 0.5, 4.5),
      },
      {
        id: 'ol-2',
        start: 5.3,
        end: 7.7,
        words: speak('Quick vacuum before the sun hits the floor', 5.3, 7.7),
      },
      {
        id: 'ol-3',
        start: 8.5,
        end: 11.5,
        words: speak('Hair up means we are actually doing this', 8.5, 11.5),
      },
      {
        id: 'ol-4',
        start: 12.5,
        end: 17.5,
        words: speak('Okay so here is the plan for the whole morning', 12.5, 17.5),
      },
      {
        id: 'ol-5',
        start: 18.2,
        end: 20.3,
        words: speak('Lemon, ice, Maison Perrier', 18.2, 20.3),
      },
      {
        id: 'ol-6',
        start: 21.5,
        end: 31,
        words: speak('And now I finally get to sit down and tell you everything', 21.5, 31),
      },
    ],
    interactions: [
      { id: 'ol-i1', emoji: '🙂', label: ':slightly-smiling', start: 1.5, end: 3.5, triggerId: 'ol-1' },
      // She points at the bottle — the gesture serving the product beat.
      { id: 'ol-i2', emoji: '👉', label: ':point-right', start: 18.4, end: 20.2, triggerId: 'ol-5' },
      { id: 'ol-i3', emoji: '🤩', label: ':star-struck', start: 22.5, end: 24.5, triggerId: 'ol-6' },
    ],
  },
  {
    id: 'blake',
    name: 'Blake',
    avatar: '/assets/avatar-blake-chip.jpg',
    color: 'pink',
    offCamera: true,
    scripts: [
      { id: 'bl-0', start: 10, end: 11, label: 'mmm' },
      {
        id: 'bl-1',
        start: 25.5,
        end: 28.5,
        words: speak('Wait, tell them the best part', 25.5, 28.5),
      },
    ],
    interactions: [
      // Blake reacts while Olivia is the one talking — the relationship the
      // connector lines exist to record.
      { id: 'bl-i1', emoji: '👀', label: ':eyes', start: 18.6, end: 20.4, triggerId: 'ol-5' },
      { id: 'bl-i2', emoji: '😂', label: ':joy', start: 22, end: 24, triggerId: 'ol-6' },
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
