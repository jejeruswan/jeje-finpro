const LEVEL_LABELS = ['Corkboard', 'Frames'] as const;

/**
 * Spatial depth meter (Figma Raw-10/09, 602-series): a horizontal track in the
 * header where the ACTIVE stop is the level's title itself, bare —
 * `Title •`, `• Title`.
 *
 * The dot→title morph is an UNFURL, not a stretch: every stop always renders
 * its dot and its title side by side, and activation collapses the dot
 * (max-width → 0) while the title clip-reveals (max-width → open) on the same
 * curve. The text is never scaled or faded — only progressively revealed — and
 * the neighboring dot glides along via continuous flex reflow. Deactivation
 * plays the exact reverse, so travel reads as one title furling shut while the
 * next unrolls. Every dot is a jump target; hovering one names its depth.
 */
export function DepthMeter({
  level,
  labels,
  onJump,
}: {
  level: 1 | 2;
  /** The context title for each level, always available — the outgoing title
   *  must stay mounted to animate closed. */
  labels: [string, string];
  onJump: (level: 1 | 2) => void;
}) {
  return (
    <div className="mir-depth" role="tablist" aria-label="Zoom level">
      {([1, 2] as const).map((l) => {
        const active = level === l;
        return (
          <button
            key={l}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={active ? labels[l - 1] : `Level ${l} — ${LEVEL_LABELS[l - 1]}`}
            className={`mir-depth__node ${active ? 'mir-depth__node--active' : ''}`}
            onClick={() => onJump(l)}
          >
            <span className="mir-depth__dot" aria-hidden />
            <span className="mir-depth__title">{labels[l - 1]}</span>
            {!active && <span className="mir-depth__micro">{LEVEL_LABELS[l - 1]}</span>}
          </button>
        );
      })}
    </div>
  );
}
