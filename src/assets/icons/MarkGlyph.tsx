import type { AttentionKind } from '../../screens/Animator/data';

/**
 * The attention line's mark-glyphs, as the inspector draws them: the mark's
 * symbol at the left with the run it starts trailing off to the right
 * (jess-mirage, "Glyphs" Type=Object/Area/None, nodes 710:134013–15).
 * Object and None use the exported geometry verbatim; Area's ✼ outline is
 * redrawn as six strokes because the 4KB text-outline export is not worth
 * embedding at 8px. Colour rides `currentColor` — the panel paints it with
 * the track's own `--attn-line`.
 */
export function MarkGlyph({ kind, size = 15 }: { kind: AttentionKind; size?: number }) {
  const h = kind === 'area' ? (size * 8) / 15 : (size * 6) / 15;
  if (kind === 'object') {
    return (
      <svg width={size} height={h} viewBox="0 0 15 6" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <path d="M4 3H15" stroke="currentColor" />
        <circle cx="3" cy="3" r="3" fill="currentColor" />
      </svg>
    );
  }
  if (kind === 'none') {
    return (
      <svg width={size} height={h} viewBox="0 0 15 6" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <circle cx="3" cy="3" r="2.5" stroke="currentColor" />
        <path d="M5 3L15 3" stroke="currentColor" />
      </svg>
    );
  }
  return (
    <svg width={size} height={h} viewBox="0 0 15 8" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M4 4.11H15" stroke="currentColor" />
      <g stroke="currentColor" strokeLinecap="round">
        <path d="M4.5 0.9V7.3" />
        <path d="M1.73 2.5L7.27 5.7" />
        <path d="M1.73 5.7L7.27 2.5" />
      </g>
    </svg>
  );
}
