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

/**
 * The area mark's bare ✼ — the same six strokes MarkGlyph draws for Area,
 * without the trailing run-line. Sized ABOVE the 7px object/none dots on
 * purpose: thin spokes carry far less ink than a solid disc, so matching
 * their boxes made the flower read too small — ~10px of spokes is what
 * optically matches a 7px dot.
 */
export function AreaFlower({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 9 9" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <g stroke="currentColor" strokeLinecap="round">
        <path d="M4.5 1.3V7.7" />
        <path d="M1.73 2.9L7.27 6.1" />
        <path d="M1.73 6.1L7.27 2.9" />
      </g>
    </svg>
  );
}
