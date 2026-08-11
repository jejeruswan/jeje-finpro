// Sample data for the Animator prototype. Kept separate so the layout is
// data-driven and easy to extend / swap for real content later.
//
// Coordinates are pulled straight from the Figma "Animator" base frame
// (file mN4cVt7MXQjJ1y5pOgGu4E). The tracks use a fixed left "rail" for the
// sticky camera-shot icon + avatar column; every x below is measured from the
// start of the track content (i.e. AFTER the rail), unless noted as
// "track-space" (rail included), which the playhead + node lines use.

/** Sticky left column that holds the camera-shot icon / avatars. */
export const RAIL = 42;

/* --- Layer 1: camera-shot styles (scene bar) ------------------------------ */

/**
 * A "focus" cut inside a shot — whose eyeline the camera picks up, when, and
 * for how long. Each one also draws a keyframe marker on the shot's clip.
 * `time` and `duration` are seconds; `time` is absolute on the timeline, not
 * relative to the shot, so the marker maths stays trivial when a shot is
 * retimed underneath it.
 */
export type Focus = { id: string; target: string; time: number; duration: number };

/** Camera framing presets offered by the Shot Style inspector. */
export type ShotPreset = 'wide' | 'cu' | 'ots';

/**
 * The framing each preset applies to the preview. `zoom` / `x` / `y` drive a
 * CSS transform on the preview image — enough to read as a reframe in the
 * prototype, standing in for a real camera. `named` presets append the speaker
 * to the clip tag ("CU - Jess"); a wide shot has no subject, so it does not.
 */
export const SHOT_PRESETS: {
  id: ShotPreset;
  label: string;
  named: boolean;
  zoom: number;
  x: number;
  y: number;
}[] = [
  { id: 'wide', label: 'Wide', named: false, zoom: 1, x: 0, y: 0 },
  { id: 'cu', label: 'CU', named: true, zoom: 1.85, x: 2, y: -13 },
  { id: 'ots', label: 'OTS', named: true, zoom: 1.4, x: -15, y: -5 },
];

/** The tag a shot carries once its preset or speaker changes. */
export function presetLabel(preset: ShotPreset, speaker: string): string {
  const p = SHOT_PRESETS.find((x) => x.id === preset) ?? SHOT_PRESETS[0];
  return p.named ? `${p.label} - ${speaker}` : p.label;
}

/** Everyone the camera can hold eye contact with. */
export const SPEAKERS = ['Jess', 'Kai', 'Midas'] as const;
/** Focus targets add the camera itself — "Jess → camera" is the default cut. */
export const FOCUS_TARGETS = ['camera', ...SPEAKERS] as const;

/** Shortest shot the inspector will let you squeeze a clip down to. */
export const MIN_SHOT_SEC = 0.25;

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

/** A camera-shot clip on the first (top) track. `start`/`end` are seconds and
 *  drive both the clip's width on the rail and the floating "Shot Style"
 *  inspector shown when the clip is selected. */
export type Scene = {
  id: string;
  label: string;
  preset: ShotPreset;
  start: number;
  end: number;
  /** Whose eyeline the camera holds for the shot ("Jess → camera"). */
  speaker: string;
  focuses: Focus[];
};

export const SCENES: Scene[] = [
  { id: 's1', label: 'Wide', preset: 'wide', start: 0, end: 7, speaker: 'Jess', focuses: [] },
  {
    id: 's2',
    label: 'CU - Jess',
    preset: 'cu',
    start: 7,
    end: 12,
    speaker: 'Jess',
    focuses: [
      { id: 's2-f1', target: 'camera', time: 7, duration: 3 },
      { id: 's2-f2', target: 'Kai', time: 10, duration: 2 },
    ],
  },
  { id: 's3', label: 'CU - Kai', preset: 'cu', start: 12, end: 16, speaker: 'Kai', focuses: [] },
  { id: 's4', label: 'CU - Midas', preset: 'cu', start: 16, end: 20, speaker: 'Midas', focuses: [] },
  { id: 's5', label: 'OTS - Midas', preset: 'ots', start: 20, end: 24, speaker: 'Midas', focuses: [] },
  { id: 's6', label: 'CU - Midas', preset: 'cu', start: 24, end: 28, speaker: 'Midas', focuses: [] },
];

/* --- Layers 2-4: avatars, each with a script + interaction sub-lane -------- */
// Distinct placeholder lines so each speaker reads differently in the timeline.
export const CAPTION_WORDS = ['Hi', 'everyone', 'today', 'is', 'such', 'a', 'wonderful', 'day'];
export const KAI_WORDS = ['Thanks', 'for', 'joining', 'us', 'on', 'this', 'project!'];
export const MIDAS_WORDS = ["Let's", 'dive', 'right', 'into', 'the', 'key', 'updates.'];

export type AvatarColor = 'purple' | 'pink' | 'green';

/** A reaction that fires while a script clip is playing. Listed in the floating
 *  "Script" inspector; `color` tints the speaker chip to that avatar's track
 *  colour, so a reaction from another speaker stays attributable. */
export type ScriptInteraction = {
  id: string;
  time: string;
  speaker: string;
  color: AvatarColor;
  action: string;
};

/** A caption / script chip on the script sub-lane. `start`/`end`/`interactions`
 *  drive the floating "Script" inspector shown when the chip is selected. */
export type ScriptChip = {
  id: string;
  left: number;
  width?: number;
  words?: string[];
  label?: string;
  start: string;
  end: string;
  interactions: ScriptInteraction[];
};

/** An emoji reaction on the interaction sub-lane. `center` is the chip's
 *  horizontal center in content-space (rail excluded) so the node connector
 *  lines can line up exactly with it. `label` (the emoji's shortcode), `start`
 *  and `end` drive the floating "Interaction" inspector shown when the chip —
 *  or the connector line running into it — is selected. Times follow the
 *  design's rule: a five-second window ending at the chip's own position. */
export type Interaction = {
  id: string;
  center: number;
  emoji: string;
  label: string;
  start: string;
  end: string;
};

export type AvatarRow = {
  id: string;
  name: string;
  avatar: string;
  color: AvatarColor;
  scripts: ScriptChip[];
  interactions: Interaction[];
};

export const AVATAR_ROWS: AvatarRow[] = [
  {
    id: 'jess',
    name: 'Jess',
    avatar: '/assets/avatar-jess.jpg',
    color: 'purple',
    scripts: [
      {
        id: 'jess-s1',
        left: 10,
        width: 343,
        words: CAPTION_WORDS,
        start: '0:00',
        end: '0:10',
        interactions: [],
      },
    ],
    interactions: [
      { id: 'jess-i1', center: 155, emoji: '🙂', label: ':slightly-smiling', start: '0:00', end: '0:04' },
      // The reaction the Figma frame shows selected — its inspector values are
      // taken straight from that design.
      { id: 'jess-i2', center: 410, emoji: '🫶', label: ':heart-hands', start: '0:07', end: '0:12' },
      { id: 'jess-i3', center: 515, emoji: '😂', label: ':joy', start: '0:10', end: '0:15' },
    ],
  },
  {
    id: 'kai',
    name: 'Kai',
    avatar: '/assets/avatar-kai.jpg',
    color: 'pink',
    scripts: [
      {
        id: 'kai-s0',
        left: 38,
        width: 50,
        label: 'Fire',
        start: '0:01',
        end: '0:02',
        interactions: [],
      },
      {
        // The clip the Figma frame shows selected — its inspector values are
        // taken straight from that design.
        id: 'kai-s1',
        left: 377,
        width: 343,
        words: KAI_WORDS,
        start: '0:09',
        end: '0:20',
        interactions: [
          { id: 'kai-s1-x1', time: '0:10', speaker: 'Jess', color: 'purple', action: 'nods' },
          { id: 'kai-s1-x2', time: '0:15', speaker: 'Jess', color: 'purple', action: 'laughs' },
          { id: 'kai-s1-x3', time: '0:15', speaker: 'Midas', color: 'green', action: 'laughs' },
        ],
      },
    ],
    interactions: [
      { id: 'kai-i1', center: 885, emoji: '🎉', label: ':party-popper', start: '0:20', end: '0:25' },
      { id: 'kai-i2', center: 990, emoji: '🙌', label: ':raised-hands', start: '0:23', end: '0:28' },
    ],
  },
  {
    id: 'midas',
    name: 'Midas',
    avatar: '/assets/avatar-jess.jpg',
    color: 'green',
    scripts: [
      {
        id: 'midas-s1',
        left: 758,
        width: 343,
        words: MIDAS_WORDS,
        start: '0:21',
        end: '0:31',
        interactions: [],
      },
    ],
    interactions: [
      { id: 'midas-i1', center: 199, emoji: '📞', label: ':telephone', start: '0:01', end: '0:06' },
      { id: 'midas-i2', center: 624, emoji: '🤩', label: ':star-struck', start: '0:13', end: '0:18' },
    ],
  },
];

/* --- Selection ------------------------------------------------------------ */

/**
 * The one selected timeline clip. Selection is exclusive across every track, so
 * picking a script clip replaces a selected camera shot (and vice versa), which
 * is what swaps the floating inspector between the "Shot Style" and "Script"
 * panels. Lives here rather than in the screen so the tracks and the canvas can
 * share the type without importing each other.
 */
export type TimelineSelection =
  | { kind: 'scene'; id: string }
  | { kind: 'script'; id: string }
  | { kind: 'interaction'; id: string };

/**
 * Node connector lines that link an interaction to the script it belongs to
 * (who is speaking). `left` is the line's center in track-space (rail included);
 * it lines up with an emoji chip's center. `top`/`height` are measured from the
 * top of the whole Tracks stack (scene bar = y 0). Each line bridges the 8px+8px
 * gap between a chip's edge in one lane and the chip edge in the target lane.
 *
 * Lane geometry: every lane is 52px tall and every chip is 36px tall, centered,
 * so a chip spans [laneTop+8 .. laneTop+44]. Lane tops (track-space):
 *   scene 0 · jess-script 52 · jess-int 104 · kai-script 156 · kai-int 208
 *   midas-script 260 · midas-int 312
 *
 * Every line runs into exactly one reaction chip — `interactionId` names it, so
 * clicking the line selects that interaction just as clicking the chip does,
 * and the line lights up alongside it. Each `left` is the corresponding chip's
 * `center` plus the rail.
 */
export type NodeLine = {
  id: string;
  left: number;
  top: number;
  height: number;
  interactionId: string;
};

export const NODE_LINES: NodeLine[] = [
  { id: 'nl1', left: 197, top: 96, height: 16, interactionId: 'jess-i1' }, // Jess script → Jess reaction
  { id: 'nl2', left: 241, top: 96, height: 224, interactionId: 'midas-i1' }, // Jess script → Midas reaction
  { id: 'nl3', left: 452, top: 148, height: 16, interactionId: 'jess-i2' }, // Jess reaction → Kai script
  { id: 'nl4', left: 557, top: 148, height: 16, interactionId: 'jess-i3' }, // Jess reaction → Kai script
  { id: 'nl5', left: 666, top: 200, height: 120, interactionId: 'midas-i2' }, // Kai script → Midas reaction
  { id: 'nl6', left: 927, top: 252, height: 16, interactionId: 'kai-i1' }, // Kai reaction → Midas script
  { id: 'nl7', left: 1032, top: 252, height: 16, interactionId: 'kai-i2' }, // Kai reaction → Midas script
];

/* --- Timeline ruler ------------------------------------------------------- */
// Seconds 0..135, a numeric label every 5s with 4 minor ticks between.
export const RULER_MAX = 135;
export const RULER_STEP = 5;
export const RULER_PX_PER_SEC = 34.8; // ~ spacing seen in the design
export const PLAYHEAD_SEC = 21;
export const TIME_LABEL = '0:21.00 / 0:55.00';
// Playhead position in track-space px (rail excluded), matching the design.
export const PLAYHEAD_LEFT = 521;

// Left editor toolbar tools (top group) — labels drive tooltips/aria.
export const EDITOR_TOOLS = [
  { id: 'assistant', label: 'AI assistant' },
  { id: 'adjust', label: 'Adjust' },
  { id: 'eye-contact', label: 'Eye contact' },
  { id: 'layout', label: 'Layout' },
  { id: 'effects', label: 'Effects' },
] as const;
