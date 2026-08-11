import { RULER_MAX, RULER_STEP, RULER_PX_PER_SEC, PLAYHEAD_LEFT, TIME_LABEL } from '../data';

/** Timeline ruler: second labels every 5s with 4 minor ticks between, plus the
 *  white current-time pill sitting above the playhead. The pill follows the
 *  playhead (`playheadX`, content-space px) so the two stay locked together. */
export function TimelineRuler({
  playheadX = PLAYHEAD_LEFT,
  label = TIME_LABEL,
}: {
  playheadX?: number;
  label?: string;
}) {
  const majors: number[] = [];
  for (let s = 0; s <= RULER_MAX; s += RULER_STEP) majors.push(s);

  return (
    <div className="anim-ruler">
      <div className="anim-ruler__ticks">
        {majors.map((s) => (
          <div
            className="anim-ruler__seg"
            key={s}
            style={{ width: RULER_STEP * RULER_PX_PER_SEC }}
          >
            <span className="anim-ruler__label">{s}</span>
            <span className="anim-ruler__dots">
              {[0, 1, 2, 3].map((d) => (
                <span className="anim-ruler__dot" key={d} />
              ))}
            </span>
          </div>
        ))}
      </div>

      <div className="anim-ruler__time" style={{ left: `calc(var(--rail) + ${playheadX}px)` }}>
        {label}
      </div>
    </div>
  );
}
