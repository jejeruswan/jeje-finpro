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
   Level 3 directs a WINDOW of the source footage, not the whole file: the
   placeholder runs 13:14, and a scene is the first 32 seconds of it.
   `SOURCE_IN` is where this take starts in the file, so timeline time `t` is
   source time `SOURCE_IN + t`. */

export const SOURCE_VIDEO = '/assets/videoplaceholder.mp4';
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

/* The take's four beats:
     0–7   living room — vacuuming
     7–15  kitchen counter — lemon and sparkling water
     15–21 bedroom — opening up the curtains
     21–32 bedroom — making the bed                                          */

export const SUBJECTS: Subject[] = [
  // Beat 1 — living room
  { id: 'olivia-a', kind: 'person', label: 'Olivia', box: { x: 31, y: 8, w: 15, h: 83 }, from: 0, to: 7, provenance: 'detected' },
  { id: 'vacuum', kind: 'prop', label: 'Vacuum', box: { x: 22, y: 68, w: 15, h: 25 }, from: 0, to: 7, provenance: 'detected' },
  { id: 'sofa', kind: 'set', label: 'Sofa', box: { x: 61, y: 39, w: 32, h: 39 }, from: 0, to: 7, provenance: 'detected' },

  // Beat 2 — kitchen counter. The product beat.
  { id: 'olivia-b', kind: 'person', label: 'Olivia', box: { x: 33, y: 7, w: 36, h: 59 }, from: 7, to: 15, provenance: 'detected' },
  { id: 'perrier', kind: 'product', label: 'Maison Perrier', box: { x: 36, y: 42, w: 9, h: 40 }, from: 7, to: 15, provenance: 'detected' },
  { id: 'glass', kind: 'prop', label: 'Glass', box: { x: 53, y: 53, w: 8, h: 27 }, from: 7, to: 15, provenance: 'detected' },
  { id: 'lemon', kind: 'prop', label: 'Lemon', box: { x: 45, y: 65, w: 7, h: 12 }, from: 7, to: 15, provenance: 'detected' },
  { id: 'takeout', kind: 'product', label: 'Takeout trays', box: { x: 68, y: 64, w: 25, h: 18 }, from: 7, to: 15, provenance: 'detected' },

  // Beat 3 — bedroom, curtains
  { id: 'olivia-c', kind: 'person', label: 'Olivia', box: { x: 53, y: 10, w: 17, h: 76 }, from: 15, to: 21, provenance: 'detected' },
  { id: 'window', kind: 'light', label: 'Window light', box: { x: 2, y: 2, w: 29, h: 81 }, from: 15, to: 21, provenance: 'detected' },
  { id: 'lamp-c', kind: 'light', label: 'Floor lamp', box: { x: 46, y: 25, w: 9, h: 39 }, from: 15, to: 21, provenance: 'detected' },

  // Beat 4 — bedroom, making the bed
  { id: 'olivia-d', kind: 'person', label: 'Olivia', box: { x: 6, y: 28, w: 21, h: 55 }, from: 21, to: SCENE_DURATION, provenance: 'detected' },
  { id: 'bed', kind: 'set', label: 'Bed', box: { x: 20, y: 58, w: 66, h: 35 }, from: 21, to: SCENE_DURATION, provenance: 'detected' },
  { id: 'lamp-d', kind: 'light', label: 'Floor lamp', box: { x: 52, y: 25, w: 6, h: 39 }, from: 21, to: SCENE_DURATION, provenance: 'detected' },
  { id: 'artprint', kind: 'prop', label: 'Art print', box: { x: 37, y: 55, w: 9, h: 15 }, from: 21, to: SCENE_DURATION, provenance: 'detected' },
  { id: 'stool', kind: 'prop', label: 'Stool', box: { x: 46, y: 57, w: 8, h: 12 }, from: 21, to: SCENE_DURATION, provenance: 'detected' },
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

/** A drawn region of the frame: centre + radii, in stage percentages, so it
 *  rides the framing transform exactly like the object graph's boxes. Soft
 *  ellipse, deliberately unlike the objects' hard rectangles — solid means "a
 *  definite thing", soft means "a region", on canvas as on the line. */
export type AreaRegion = { cx: number; cy: number; rx: number; ry: number };

/** Auto-name a region from where it sits, so a fresh area never reads as the
 *  generic "Area". Overridable in the inspector. */
export function autoAreaName(r: AreaRegion): string {
  const col = r.cx < 34 ? 'left' : r.cx > 66 ? 'right' : 'centre';
  const row = r.cy < 34 ? 'Upper' : r.cy > 66 ? 'Lower' : 'Middle';
  return row === 'Middle' && col === 'centre' ? 'Centre' : `${row} ${col}`;
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
  { id: 'm1', t: 7, kind: 'object', subjectId: 'perrier' },
  { id: 'm2', t: 11, kind: 'area', areaLabel: 'Counter top', area: { cx: 55, cy: 66, rx: 30, ry: 22 } },
  { id: 'm3', t: 15, kind: 'none' },
  { id: 'm4', t: 21, kind: 'area', areaLabel: 'Bed corner', area: { cx: 40, cy: 72, rx: 32, ry: 18 } },
  { id: 'm5', t: 26, kind: 'object', subjectId: 'olivia-d' },
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

/* --- Shot styles (framing) -------------------------------------------------- */

/** Camera framing presets. A shot style is a virtual reframe of the one raw
 *  take, not a separate render — which is why the preview can apply it as a
 *  transform and why a shot boundary can move without anything re-rendering. */
export type ShotPreset = 'wide' | 'mid' | 'cu';

export const SHOT_PRESETS: { id: ShotPreset; label: string; zoom: number }[] = [
  { id: 'wide', label: 'Wide', zoom: 1 },
  { id: 'mid', label: 'Mid', zoom: 1.45 },
  { id: 'cu', label: 'CU', zoom: 2.1 },
];

/**
 * The framing a shot applies to the stage, as a CSS transform. Derived from the
 * SUBJECT rather than hand-tuned: a close-up on the bottle crops to the bottle,
 * so the clip's tag and the picture can't disagree. The translate is clamped to
 * what the scaled frame can still cover.
 */
export function framingFor(preset: ShotPreset, subject: Subject | undefined): string | undefined {
  const p = SHOT_PRESETS.find((x) => x.id === preset);
  if (!p) return undefined;
  if (p.zoom === 1 || !subject) return 'scale(1)';
  const limit = 50 - 50 / p.zoom;
  const clamp = (v: number) => Math.max(-limit, Math.min(limit, v));
  const dx = clamp(50 - (subject.box.x + subject.box.w / 2));
  const dy = clamp(50 - (subject.box.y + subject.box.h / 2));
  return `scale(${p.zoom}) translate(${dx}%, ${dy}%)`;
}

/** The cast. Olivia presents on camera; Blake is off camera, which is why he has
 *  script and reaction lanes but never appears in the object graph. */
export const SPEAKERS = ['Olivia', 'Blake'] as const;

/** The tag a shot carries once its preset or subject changes. */
export function presetLabel(preset: ShotPreset, subjectLabel: string): string {
  const p = SHOT_PRESETS.find((x) => x.id === preset) ?? SHOT_PRESETS[0];
  return `${p.label} - ${subjectLabel}`;
}

/** Shortest shot a trim will let you squeeze a clip down to. */
export const MIN_SHOT_SEC = 0.5;

export type Shot = {
  id: string;
  label: string;
  preset: ShotPreset;
  start: number;
  end: number;
  /** What this framing is on. Drives both the clip's tag and the actual crop. */
  subjectId: string;
};

export const SHOTS: Shot[] = [
  { id: 's1', label: 'Wide - Living room', preset: 'wide', start: 0, end: 7, subjectId: 'olivia-a' },
  { id: 's2', label: 'CU - Maison Perrier', preset: 'cu', start: 7, end: 11, subjectId: 'perrier' },
  { id: 's3', label: 'Mid - Glass', preset: 'mid', start: 11, end: 15, subjectId: 'glass' },
  { id: 's4', label: 'Wide - Bedroom', preset: 'wide', start: 15, end: 21, subjectId: 'window' },
  { id: 's5', label: 'Mid - Bed', preset: 'mid', start: 21, end: 26, subjectId: 'bed' },
  { id: 's6', label: 'Wide - Bedroom', preset: 'wide', start: 26, end: SCENE_DURATION, subjectId: 'olivia-d' },
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
  { emoji: '🙂', label: ':slightly-smiling' },
  { emoji: '🫶', label: ':heart-hands' },
  { emoji: '😂', label: ':joy' },
  { emoji: '🎉', label: ':party-popper' },
  { emoji: '🙌', label: ':raised-hands' },
  { emoji: '📞', label: ':telephone' },
  { emoji: '🤩', label: ':star-struck' },
  { emoji: '👀', label: ':eyes' },
  { emoji: '👉', label: ':point-right' },
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
        end: 6.5,
        words: speak('Starting the morning with a full reset of the apartment', 0.5, 6.5),
      },
      {
        id: 'ol-2',
        start: 7.5,
        end: 14,
        words: speak('Lemon, ice, and a whole bottle of Maison Perrier', 7.5, 14),
      },
      {
        id: 'ol-3',
        start: 15.5,
        end: 20.5,
        words: speak('The light in here at this hour is unreal', 15.5, 20.5),
      },
      {
        id: 'ol-4',
        start: 22,
        end: 31,
        words: speak('Bed made, laundry going, and it is not even nine', 22, 31),
      },
    ],
    interactions: [
      { id: 'ol-i1', emoji: '🙂', label: ':slightly-smiling', start: 2, end: 4, triggerId: 'ol-1' },
      // She points at the bottle — the gesture serving the product beat.
      { id: 'ol-i2', emoji: '👉', label: ':point-right', start: 8.5, end: 10.5, triggerId: 'ol-2' },
      { id: 'ol-i3', emoji: '🤩', label: ':star-struck', start: 17, end: 19, triggerId: 'ol-3' },
    ],
  },
  {
    id: 'blake',
    name: 'Blake',
    avatar: '/assets/avatar-blake-chip.jpg',
    color: 'pink',
    offCamera: true,
    scripts: [
      { id: 'bl-0', start: 12.5, end: 13.5, label: 'mmm' },
      {
        id: 'bl-1',
        start: 24,
        end: 27.5,
        words: speak('You missed a corner', 24, 27.5),
      },
    ],
    interactions: [
      // Blake reacts while Olivia is the one talking — the relationship the
      // connector lines exist to record.
      { id: 'bl-i1', emoji: '👀', label: ':eyes', start: 9, end: 11, triggerId: 'ol-2' },
      { id: 'bl-i2', emoji: '😂', label: ':joy', start: 25, end: 27, triggerId: 'ol-4' },
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
