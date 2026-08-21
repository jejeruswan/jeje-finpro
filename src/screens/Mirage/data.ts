/* ============================================================================
   Mirage hi-fi prototype — sample data for "Vintage shopping with my sister".
   Scenes, timecodes and copy come from the real take (public/assets/video.mp4,
   3:00): Evelyn and Emily getting ready in Evelyn's New York apartment, then
   heading out vintage shopping. Scene boundaries were read off the footage's
   actual cuts; the layout follows the Figma frames Raw 01–09
   (file mN4cVt7MXQjJ1y5pOgGu4E). Scenes drive the Level 1 corkboard, the
   Level 2 script pages and the drawer; the prompt screen has its own copy.
   ============================================================================ */

export type AvatarId = 'evelyn' | 'emily' | 'olivia' | 'blake' | 'jess' | 'kai';

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
  evelyn: {
    id: 'evelyn',
    name: 'Evelyn',
    chip: '/assets/evelyn.jpg',
    portrait: '/assets/evelyn.jpg',
  },
  emily: {
    id: 'emily',
    name: 'Emily',
    chip: '/assets/emily.jpg',
    portrait: '/assets/emily.jpg',
  },
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
  'I want to generate a raw footage of me and my sister vlogging in my New York apartment ' +
  'before we head out vintage shopping. ' +
  'It should be a handheld selfie-style footage of the two of us (Evelyn and Emily) getting ' +
  'ready, trying on sunglasses, talking about the live show we’re hosting, and ' +
  'heading out into the city.';

export const PROJECT_TITLE = 'Vintage shopping with my sister';

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

/* The 12 scenes of the real take (public/assets/video.mp4, 3:00): two sisters
   getting ready in Evelyn's New York apartment, then heading out vintage
   shopping. Durations are the actual cut points of the footage; thumbnails are
   each scene's first frame. */
export const SCENES: Scene[] = [
  scene(
    'welcome',
    1,
    'Welcome to the Apartment',
    'Evelyn opens the vlog with a big welcome shrug while Emily teases her from behind the camera: “why do you act like you’ve never vlogged before?”',
    7,
    '/assets/thumbnails/thumbnail-1.jpg',
    [castOf('evelyn')],
  ),
  scene(
    'emily-joins',
    2,
    'Emily Joins the Party',
    'Quick cut to both sisters laughing by the window. Emily dances into frame.',
    3,
    '/assets/thumbnails/thumbnail-2.jpg',
    [castOf('evelyn'), castOf('emily')],
  ),
  scene(
    'game-plan',
    3,
    'Hallway Game Plan',
    'The plan: vintage shopping in New York. Emily wants a Fendi bag so bad; the rain stopped ten minutes ago, so that’s the sign.',
    20,
    '/assets/thumbnails/thumbnail-3.jpg',
    [castOf('evelyn'), castOf('emily')],
  ),
  scene(
    'mirror-check',
    4,
    'Mirror Check',
    'Full length mirror outfit check. Evelyn already kind of wishes she wore different pants, but this will do.',
    7,
    '/assets/thumbnails/thumbnail-4.jpg',
    [castOf('evelyn'), castOf('emily')],
  ),
  scene(
    'sunglasses',
    5,
    'Sunglasses Try On',
    'Evelyn models her big gradient sunglasses, wonders what she even wants from the shop, and realizes she doesn’t have her phone.',
    17,
    '/assets/thumbnails/thumbnail-5.jpg',
    [castOf('evelyn'), castOf('emily')],
  ),
  scene(
    'emily-mic',
    6,
    'Emily Takes the Mic',
    'Emily’s wishlist: a bag for her, and if not, maybe some cool sunnies.',
    10,
    '/assets/thumbnails/thumbnail-6.jpg',
    [castOf('evelyn'), castOf('emily')],
  ),
  scene(
    'group-chat',
    7,
    'Glasses & the Group Chat',
    'The glasses tightening debate, then news from the show producer group chat: they’re hosting a live show in New York like a YouTube video, IRL.',
    44,
    '/assets/thumbnails/thumbnail-7.jpg',
    [castOf('evelyn'), castOf('emily')],
  ),
  scene(
    'camera-roll',
    8,
    'Camera Roll Reactions',
    'Emily holds up the mirror photo: she looks good, and Evelyn is making the ugliest face in the back. On purpose, allegedly.',
    13,
    '/assets/thumbnails/thumbnail-8.jpg',
    [castOf('evelyn'), castOf('emily')],
  ),
  scene(
    'final-poses',
    9,
    'Final Poses & Hair Fix',
    'Sunglasses go back on for a round of poses, then Evelyn’s hair goes up in the white claw clip, time to head out.',
    14,
    '/assets/thumbnails/thumbnail-9.jpg',
    [castOf('evelyn'), castOf('emily')],
  ),
  scene(
    'lego-wall',
    10,
    'The Lego Art Wall',
    'Comment down below: should the wall frames and the Lego collection stay or go for a clean white background?',
    22,
    '/assets/thumbnails/thumbnail-10.jpg',
    [castOf('evelyn'), castOf('emily')],
  ),
  scene(
    'out-the-door',
    11,
    'Out the Door',
    'Sidewalk transition and into the back seat, outfit regret sets in immediately.',
    7,
    '/assets/thumbnails/thumbnail-11.jpg',
    [castOf('evelyn'), castOf('emily')],
  ),
  scene(
    'backseat',
    12,
    'Backseat Verdict',
    'It’s 90 degrees outside and Evelyn is wearing long sleeves, top and bottom. They’ll be back home so she can change.',
    16,
    '/assets/thumbnails/thumbnail-12.jpg',
    [castOf('evelyn'), castOf('emily')],
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

/** A user-inserted scene (the + node between cards): born EMPTY, straight
 *  into the card's edit posture — the form IS the prompt box. It only starts
 *  cooking once the ✓ commits it. */
export function makeBlankScene(id: string): Scene {
  return scene(
    id,
    0, // renumbered by the caller after insertion
    '',
    '',
    5,
    '/assets/thumbnails/thumbnail-4.jpg',
    [],
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
