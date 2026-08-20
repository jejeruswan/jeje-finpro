/* ============================================================================
   Mirage hi-fi prototype — sample data for "I let AI plan my wedding".
   Content, timecodes and copy are pulled from the Figma frames Raw 01–09
   (file mN4cVt7MXQjJ1y5pOgGu4E). Scenes drive the Level 1 corkboard, the
   Level 2 script pages and the drawer; the prompt screen has its own copy.
   ============================================================================ */

export type AvatarId = 'olivia' | 'blake' | 'jess' | 'kai';

export type Avatar = {
  id: AvatarId;
  name: string;
  /** Face crop used on scene-card chips (Raw 04/05). */
  chip: string;
  /** Full portrait used on the prompt pills (Raw 02). */
  portrait: string;
};

/** The user's avatar library — what the cast editor's "+" can pull from. */
export const AVATARS: Record<AvatarId, Avatar> = {
  olivia: {
    id: 'olivia',
    name: 'Olivia',
    chip: '/assets/avatar-olivia-chip.jpg',
    portrait: '/assets/avatar-olivia.png',
  },
  blake: {
    id: 'blake',
    name: 'Blake',
    chip: '/assets/avatar-blake-chip.jpg',
    portrait: '/assets/avatar-blake.png',
  },
  jess: {
    id: 'jess',
    name: 'Jess',
    chip: '/assets/avatar-jess.jpg',
    portrait: '/assets/avatar-jess.jpg',
  },
  kai: {
    id: 'kai',
    name: 'Kai',
    chip: '/assets/avatar-kai.jpg',
    portrait: '/assets/avatar-kai.jpg',
  },
};

/* --- Cast ---------------------------------------------------------------------
   Who is in a scene, with PROVENANCE — the same distinction Level 3's subject
   graph draws. A `generated` member is a Captions avatar: fully editable,
   recastable, re-renderable. A `detected` member is a person found in the
   user's own footage: shown as a dashed, unclaimed chip until the user names
   them or promotes them into an avatar (the claim flow). */
export type CastMember = {
  id: string;
  name: string;
  provenance: 'generated' | 'detected';
  /** Face chip. Detected people have none until they are claimed. */
  chip?: string;
};

/** A generated cast member backed by an avatar from the library. */
export const castOf = (id: AvatarId): CastMember => ({
  id,
  name: AVATARS[id].name,
  provenance: 'generated',
  chip: AVATARS[id].chip,
});

/* --- Prompt screen (Raw 01 / Raw 02) ---------------------------------------- */

export const PROMPT_PLACEHOLDER = 'How can I help you today?';

export const PROMPT_TEXT =
  'I want to make a cinematic vlog-style video of my avatars Olivia and Blake ' +
  'who are a couple and they are talking about “how they let AI plan their ' +
  'wedding”. It should have a handheld camera feel, warm morning kitchen ' +
  'light, shallow depth of field. They should be sitting at a kitchen table, ' +
  'laptop open between them, coffee mugs and a scattered wedding binder in frame.';

export const PROJECT_TITLE = 'I let AI plan my wedding';

export const SIDEBAR_PROJECTS: { thumb: string; title: string; meta: string }[] = [
  { thumb: '/assets/projects/p1.png', title: 'Nature vitamins', meta: 'Today ⋅ 2 videos' },
  { thumb: '/assets/projects/p2.png', title: 'I tried this new viral trend so you', meta: '2 videos ⋅ Yesterday' },
  { thumb: '/assets/projects/p3.png', title: 'This is the latest new secret hack', meta: '2 videos ⋅ Monday' },
  { thumb: '/assets/projects/p4.png', title: 'If only I knew about this a long time ago', meta: '2 videos ⋅ April 14' },
  { thumb: '/assets/projects/p5.png', title: 'The next big thing is right now', meta: '2 videos ⋅ April 2' },
  { thumb: '/assets/projects/p6.png', title: 'How to learn', meta: '2 videos ⋅ April 2' },
  { thumb: '/assets/projects/p7.png', title: 'Anyone can video with this new tool', meta: '2 videos ⋅ March 28' },
  { thumb: '/assets/projects/p8.png', title: 'This is going to blow your mind', meta: '2 videos ⋅ March 28' },
  { thumb: '/assets/projects/p9.png', title: 'This is going to blow your mind', meta: '2 videos ⋅ March 28' },
];

/* --- Scene model -------------------------------------------------------------- */

export type Scene = {
  id: string;
  num: number;
  title: string;
  summary: string;
  /** The scene's length in seconds. Start timecodes, the card badges, the
   *  drawer times and the board meta are all DERIVED from these, so retiming
   *  or reordering one scene ripples through everything downstream. */
  durationSec: number;
  thumb: string;
  cast: CastMember[];
};




const scene = (
  id: string,
  num: number,
  title: string,
  summary: string,
  durationSec: number,
  thumb: string,
  cast: CastMember[],
): Scene => ({ id, num, title, summary, durationSec, thumb, cast });

/** An unclaimed person detected in the user's own footage. */
const person = (id: string, n: number): CastMember => ({
  id,
  name: `Person ${n}`,
  provenance: 'detected',
});

export const SCENES: Scene[] = [
  scene('intro', 1, 'Intro', 'Jess talks about the content of the video', 10, '/assets/frames/scene-f1.jpg', [castOf('olivia')]),
  scene(
    'idea',
    2,
    'The Idea',
    'Eleven weeks to wedding date and have made almost no decisions.',
    12,
    '/assets/frames/scene-f2.jpg',
    [castOf('olivia')],
  ),
  scene(
    'rules',
    3,
    'Setting the Rules',
    'Nothing illegal, nothing that costs more than the existing budget, and the officiant stays human.',
    8,
    '/assets/frames/scene-f3.jpg',
    [castOf('olivia')],
  ),
  scene(
    'venue',
    4,
    'Choosing venue and menu',
    'Feeds it their constraints and gets back five options. Three are reasonable. One is a botanical ' +
      'garden that’s already booked. One is the top level of a parking structure, pitched with genuinely persuasive...',
    15,
    '/assets/frames/scene-f4.jpg',
    [castOf('olivia')],
  ),
  scene(
    'fiance',
    5,
    'Telling my fiance',
    'Confession day!!!!',
    10,
    '/assets/frames/scene-f5.jpg',
    [castOf('olivia'), castOf('blake')],
  ),
  scene(
    'vendors',
    6,
    'The Vendor Calls',
    'The AI drafts every email and one voicemail script. The florist thinks Olivia wrote it. She did not.',
    9,
    '/assets/frames/scene-f6.jpg',
    [castOf('olivia'), castOf('blake')],
  ),
  // Shot on the couple's own phone — its people are DETECTED, not generated,
  // until the user claims them.
  scene(
    'rehearsal',
    7,
    'Dress Rehearsal',
    'Raw footage from the rehearsal dinner — a full run-through, timed to the minute by the schedule the model produced.',
    11,
    '/assets/frames/scene-f7.jpg',
    [person('p1', 1), person('p2', 2)],
  ),
  // Mixed provenance: real footage of a person plus a generated avatar
  // composited into the same scene.
  scene(
    'closing',
    8,
    'Closing',
    'Would they do it again? A verdict, and what they’d never hand over next time.',
    14,
    '/assets/frames/scene-f8.jpg',
    [castOf('olivia'), person('p3', 1)],
  ),
];

export const sceneById = (id: string): Scene => SCENES.find((s) => s.id === id) ?? SCENES[0];

/** Patch a scene edit can carry. Summary, duration and cast changes are
 *  generative — they mark the scene stale and re-cook its render. */
export type ScenePatch = Partial<Pick<Scene, 'title' | 'summary' | 'durationSec' | 'cast'>>;

/* --- Derived timing ---------------------------------------------------------- */

/** Seconds → "MM:SS", the card-badge/drawer format from the design. */
export const formatTimecode = (sec: number): string => {
  const v = Math.max(0, Math.round(sec));
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
};

/** Each scene's start time, accumulated from the durations before it. */
export function sceneStarts(scenes: Scene[]): number[] {
  let clock = 0;
  return scenes.map((s) => {
    const start = clock;
    clock += s.durationSec;
    return start;
  });
}

export const boardMeta = (scenes: Scene[]): string =>
  `${scenes.length} scenes · ${formatTimecode(scenes.reduce((t, s) => t + s.durationSec, 0))}`;

/** A user-inserted scene (the + node between cards). It cooks like a
 *  generated one; a prompt from the reticle's insertion box becomes its
 *  working summary until the render lands. */
export function makeInsertedScene(id: string, prompt?: string): Scene {
  return scene(
    id,
    0, // renumbered by the caller after insertion
    'New scene',
    prompt?.trim() ||
      'Describe what happens here — Mirage will stage and render it in the background.',
    10,
    '/assets/frames/scene-f4.jpg',
    [castOf('olivia'), castOf('blake')],
  );
}

/** How long each scene card holds the reticle during corkboard playback. */
export const PLAYBACK_SCENE_MS = 3600;



/* --- Materialization ("the entry point is the wait") -------------------------
   Cards assemble onto the corkboard sequentially and their thumbnails sharpen
   as simulated background renders finish. Delays are per-scene so the board
   fills left-to-right while later scenes keep cooking. */

export const SPAWN_INTERVAL_MS = 550;
/** How long a scene's thumbnail stays blurred after its card lands. */
export const renderDurationMs = (index: number) => 2600 + index * 1400;
