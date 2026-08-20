export type Altitude = 'board' | 'page' | 'frame';

const LEVELS: { key: Altitude; label: string }[] = [
  { key: 'board', label: 'Board' },
  { key: 'page', label: 'Page' },
  { key: 'frame', label: 'Frame' },
];

/** Minimal depth gauge, top-left. You can always see how deep you are. */
export function AltitudeDots({ current, onJump }: { current: Altitude; onJump: (a: Altitude) => void }) {
  return (
    <nav className="dir-dots" aria-label="Altitude">
      {LEVELS.map((l) => (
        <button
          key={l.key}
          type="button"
          className={current === l.key ? 'is-active' : ''}
          onClick={() => onJump(l.key)}
        >
          <span className="dir-dots-label">{l.label}</span>
        </button>
      ))}
    </nav>
  );
}
