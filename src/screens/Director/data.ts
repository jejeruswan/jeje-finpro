/* ============================================================================
   Director prototype — sample data for "Tokyo Offsite".
   Everything on the page is driven from here: the script lines carry their
   typographic treatments as flags (slow runs, beats, interruptions, ghost
   subtext), coverage strokes are line-anchored (not time-anchored), and the
   playback clock is derived from per-word durations so word anchors survive
   any regeneration story we tell.
   ============================================================================ */

export type CharId = 'jess' | 'kai' | 'midas';

export type Character = {
  name: string;
  avatar: string;
  /** Dialogue accent / chip text color. */
  text: string;
  /** Chip background. */
  bg: string;
};

export const CHARS: Record<CharId, Character> = {
  jess: { name: 'JESS', avatar: '/assets/avatar-jess.jpg', text: '#B8A9F5', bg: '#4C4470' },
  kai: { name: 'KAI', avatar: '/assets/avatar-kai.jpg', text: '#E2B4BC', bg: '#5C4046' },
  midas: { name: 'MIDAS', avatar: '/assets/avatar-midas.jpg', text: '#9BD4B8', bg: '#24463A' },
};

/* --- Script model ---------------------------------------------------------- */

export type WordToken = {
  t: string;
  /** Wide letter-spacing = slow, deliberate delivery ("pace: slow" on hover). */
  slow?: boolean;
  /** Part of an interruption tail — rendered at 40% opacity. */
  overlapped?: boolean;
  /** A typeset pause (visible gap + amber underline dot) sits before this word. */
  beatBefore?: boolean;
};

export type ScriptLine = {
  id: string;
  who: CharId;
  words: WordToken[];
  /** Faint interlinear subtext beneath the spoken line. */
  ghost?: string;
  /** Tight tracking + heavier weight = fast, urgent. */
  urgent?: boolean;
  /** This line physically overlaps the tail of the previous line. */
  interrupt?: boolean;
  /** No coverage stroke beside it — the to-do list. */
  uncovered?: boolean;
  /** Jess's punchline carries the takes chip. */
  hasTakes?: boolean;
  /** Amber blocking note in the left margin. */
  note?: string;
  /** A rejected mark — struck through, kept visible on the page. */
  rejected?: string;
};

export type CoverageStroke = {
  id: string;
  label: string;
  /** Line indices the setup covers (inclusive). */
  startLine: number;
  endLine: number;
  /** Line heard but not seen — rendered as a zigzag through that stretch. */
  zigzagLine?: number;
};

export type Scene = {
  id: string;
  num: number;
  title: string;
  summary: string;
  duration: string;
  cast: CharId[];
  slug: string;
  lines: ScriptLine[];
  coverage: CoverageStroke[];
  /** Amber circled take-number seeded on the board card. */
  circledTake?: number;
};

const w = (t: string, extra?: Partial<WordToken>): WordToken => ({ t, ...extra });
const words = (s: string): WordToken[] => s.split(' ').map((t) => ({ t }));

/* --- Scene 2 — the fully-directed sample page ------------------------------ */

const SCENE_2_LINES: ScriptLine[] = [
  {
    id: 's2-l0',
    who: 'jess',
    words: [
      w('Hi'), w('everyone'), w('—'), w('today'), w('is'),
      w('such', { slow: true }), w('a', { slow: true }), w('wonderful', { slow: true }),
      w('day.'),
    ],
    ghost: 'she’s plotting something',
    note: '→ leans in',
  },
  {
    id: 's2-l1',
    who: 'kai',
    words: words('Thanks for joining us on this project!'),
  },
  {
    id: 's2-l2',
    who: 'jess',
    words: [
      w("We've"), w('been'), w('waiting'), w('to'), w('tell'), w('you'),
      w('about'), w('this', { overlapped: true }), w('for', { overlapped: true }),
      w('weeks.', { beatBefore: true, overlapped: true }),
    ],
    hasTakes: true,
    note: '→ turns to Kai',
    rejected: 'bigger laugh ✕',
  },
  {
    id: 's2-l3',
    who: 'kai',
    words: [w('Okay'), w('okay'), w('—'), w('tell'), w('them,'), w('tell'), w('them!')],
    urgent: true,
    interrupt: true,
  },
  {
    id: 's2-l4',
    who: 'midas',
    words: words("Let's dive right into the key updates."),
    uncovered: true,
  },
];

/* --- All five board scenes -------------------------------------------------- */

export const SCENES: Scene[] = [
  {
    id: 's1',
    num: 1,
    title: 'Cold open',
    summary: 'Jess hooks the episode.',
    duration: '0:09',
    cast: ['jess'],
    slug: 'INT. PODCAST STUDIO — DAY',
    lines: [
      { id: 's1-l0', who: 'jess', words: words('What happens when three friends take one company offsite to Tokyo?') },
      { id: 's1-l1', who: 'jess', words: words('Stick around — it gets better.') },
    ],
    coverage: [{ id: 's1-a', label: '1A-WS', startLine: 0, endLine: 1 }],
  },
  {
    id: 's2',
    num: 2,
    title: 'Welcome + banter',
    summary: 'Intros, Kai interrupts Jess, laughter.',
    duration: '0:55',
    cast: ['jess', 'kai', 'midas'],
    slug: 'INT. PODCAST STUDIO — DAY',
    lines: SCENE_2_LINES,
    coverage: [
      { id: 's2-a', label: '2A-WS', startLine: 0, endLine: 3 },
      { id: 's2-b', label: '2B-CU JESS', startLine: 0, endLine: 2, zigzagLine: 1 },
      { id: 's2-c', label: '2C-CU KAI', startLine: 1, endLine: 3 },
    ],
  },
  {
    id: 's3',
    num: 3,
    title: 'Key updates',
    summary: 'Midas walks through the news.',
    duration: '1:20',
    cast: ['midas', 'kai'],
    slug: 'INT. PODCAST STUDIO — DAY',
    lines: [
      { id: 's3-l0', who: 'midas', words: words('Three things happened this week, and all of them matter.') },
      { id: 's3-l1', who: 'midas', words: words('First: the avatar pipeline is twice as fast.') },
      { id: 's3-l2', who: 'kai', words: words('Twice? Say that slower.') },
      { id: 's3-l3', who: 'midas', words: words('Second and third are better. Keep listening.') },
    ],
    coverage: [{ id: 's3-a', label: '3A-WS', startLine: 0, endLine: 3 }],
  },
  {
    id: 's4',
    num: 4,
    title: 'The debate',
    summary: 'Jess and Kai disagree.',
    duration: '1:05',
    cast: ['jess', 'kai'],
    slug: 'INT. PODCAST STUDIO — DAY',
    circledTake: 3,
    lines: [
      { id: 's4-l0', who: 'jess', words: words('You cannot ship a feature nobody asked for.') },
      { id: 's4-l1', who: 'kai', words: words('Nobody asked for podcasts either. Here we are.') },
      { id: 's4-l2', who: 'jess', words: words('That is not the same thing and you know it.') },
      { id: 's4-l3', who: 'kai', words: words('It is exactly the same thing. Roll the clip.') },
    ],
    coverage: [{ id: 's4-a', label: '4A-WS', startLine: 0, endLine: 3 }],
  },
  {
    id: 's5',
    num: 5,
    title: 'Sign-off',
    summary: 'Warm outro.',
    duration: '0:20',
    cast: ['jess', 'kai', 'midas'],
    slug: 'INT. PODCAST STUDIO — DAY',
    lines: [
      { id: 's5-l0', who: 'jess', words: words('That is all we have for this week.') },
      { id: 's5-l1', who: 'midas', words: words('Links and notes are below, as always.') },
      { id: 's5-l2', who: 'kai', words: words('See you in Tokyo. Bye everyone!') },
    ],
    coverage: [{ id: 's5-a', label: '5A-WS', startLine: 0, endLine: 2 }],
  },
];

export const PROJECT_TITLE = 'Tokyo Offsite';

export const sceneById = (id: string): Scene => SCENES.find((s) => s.id === id) ?? SCENES[1];

/* --- The verb deck ---------------------------------------------------------- */

export const VERBS = ['to confide', 'to provoke', 'to dismiss', 'to protect', 'to plead', 'to tease'] as const;
export type Verb = (typeof VERBS)[number];

/** Verb → CSS suffix used for the line's typographic restyle. */
export const verbClass = (verb: string) => `vb-${verb.replace('to ', '')}`;

/* --- Takes (Jess's punchline) ------------------------------------------------ */

export type Take = { id: number; label: string };
export const TAKES: Take[] = [
  { id: 3, label: 'sarcastic' },
  { id: 1, label: 'deadpan' },
  { id: 2, label: 'warmer' },
];
export const DEFAULT_TAKE = 3;

/* --- Word-anchored playback timing ------------------------------------------
   Durations are per-word so cues attach to language, not timecode. Slow words
   stretch, urgent words compress, a beat is a real hole in time, and Kai's
   interruption starts inside Jess's beat — two voices genuinely overlap.
   ---------------------------------------------------------------------------- */

export type WordTime = { line: number; word: number; start: number; end: number };
export type SceneTiming = {
  times: WordTime[];
  /** `${lineIdx}:${wordIdx}` → timing, for O(1) karaoke lookups. */
  map: Map<string, WordTime>;
  total: number;
};

const BEAT_SECONDS = 1.0;
const LINE_GAP = 0.55;

function wordDuration(t: WordToken, line: ScriptLine): number {
  const base = t.slow ? 0.5 : line.urgent ? 0.13 : 0.22;
  return base + t.t.length * 0.024;
}

export function buildSceneTiming(scene: Scene): SceneTiming {
  const times: WordTime[] = [];
  let clock = 0.6; // small pre-roll
  let beatStart: number | null = null; // where the last typeset beat opened

  scene.lines.forEach((line, li) => {
    // An interruption barges in during the previous line's beat.
    let cursor = line.interrupt && beatStart != null ? beatStart + 0.08 : clock;
    line.words.forEach((tok, wi) => {
      if (tok.beatBefore) {
        beatStart = cursor;
        cursor += BEAT_SECONDS;
      }
      const dur = wordDuration(tok, line);
      times.push({ line: li, word: wi, start: cursor, end: cursor + dur });
      cursor += dur;
    });
    clock = Math.max(clock, cursor) + LINE_GAP;
  });

  const map = new Map(times.map((t) => [`${t.line}:${t.word}`, t]));
  return { times, map, total: clock + 0.9 };
}

/** The demo performance — scene 2 is what plays across every altitude. */
export const PLAYBACK_SCENE_ID = 's2';
export const S2_TIMING = buildSceneTiming(SCENES[1]);
