import { useLayoutEffect, useRef, useState } from 'react';
import { Target, CornersOut } from '@phosphor-icons/react';
import { IconButton } from '../../../ui/IconButton';
import { AVATAR_ROWS, NODE_LINES, RULER_PX_PER_SEC } from '../data';
import type { Scene, ScriptChip, TimelineSelection } from '../data';

/**
 * A caption/script block. Its width hugs the text. Each word's content-space
 * span is measured once after layout so that, as `playheadX` advances during
 * playback, the word *after* the one the playhead is touching lights up — one
 * at a time, in reading order (karaoke-style).
 *
 * Selecting it opens the floating "Script" inspector. Selection is purely
 * additive — the block keeps its left edge and its length, and the trim handles
 * are laid outside its ends — so the measurement below holds in both states.
 */
function Script({
  chip,
  playheadX,
  selected,
  onSelect,
}: {
  chip: ScriptChip;
  playheadX: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [bounds, setBounds] = useState<Array<{ start: number; end: number }>>([]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !chip.words) return;
    const spans = el.querySelectorAll<HTMLElement>('.anim-script__word');
    setBounds(
      Array.from(spans).map((span) => ({
        start: chip.left + span.offsetLeft,
        end: chip.left + span.offsetLeft + span.offsetWidth,
      })),
    );
  }, [chip.left, chip.words]);

  // Only react while the playhead is actually over a word; highlight the word
  // that follows the one it touches.
  const touchIndex = bounds.findIndex((b) => playheadX >= b.start && playheadX < b.end);
  const activeIndex = touchIndex >= 0 ? touchIndex + 1 : -1;

  return (
    <button
      className="anim-script"
      ref={ref}
      type="button"
      data-selected={selected || undefined}
      aria-pressed={selected}
      style={{ left: chip.left }}
      onClick={onSelect}
    >
      {selected && <span className="anim-script__handle" aria-hidden />}
      <span className="anim-script__body">
        {chip.label
          ? chip.label
          : chip.words?.map((w, i) => (
              <span
                className="anim-script__word"
                data-active={i === activeIndex || undefined}
                key={i}
              >
                {w}
              </span>
            ))}
      </span>
      {selected && <span className="anim-script__handle" aria-hidden />}
    </button>
  );
}

/** Screen-reader name for a connector line: the reaction sitting at its end. */
function interactionLabel(interactionId: string): string {
  for (const row of AVATAR_ROWS) {
    const hit = row.interactions.find((i) => i.id === interactionId);
    if (hit) return `${row.name} reacts ${hit.label}`;
  }
  return 'Interaction';
}

/**
 * The timeline tracks. Four stacked layers, each separated by a hairline:
 *  1. camera-shot styles (scene bar) with a sticky icon in the left rail
 *  2-4. three avatars, each a script sub-lane + an emoji interaction sub-lane,
 *       with a sticky profile picture in the left rail.
 * Every lane is the same height (52px) and every chip the same height (36px).
 * Node connector lines link interactions to the script that's speaking. The
 * playhead is NOT rendered here — it is pinned to the timeline container so it
 * does not scroll with the tracks.
 */
export function Tracks({
  scenes,
  selection,
  onSelectClip,
  playheadX,
}: {
  scenes: Scene[];
  selection: TimelineSelection | null;
  onSelectClip: (kind: TimelineSelection['kind'], id: string) => void;
  playheadX: number;
}) {
  return (
    <div className="anim-tracks">
      <div className="anim-tracks__scroll">
        {/* Layer 1 — camera-shot styles */}
        <div className="anim-layer anim-scenebar">
          <div className="anim-rail">
            <IconButton size={24} variant="ghost" aria-label="Camera shot styles">
              <Target size={24} />
            </IconButton>
          </div>
          <div className="anim-scenebar__chips">
            {scenes.map((s) => {
              const selected = selection?.kind === 'scene' && selection.id === s.id;
              const span = s.end - s.start;
              return (
                <button
                  className="anim-scene"
                  key={s.id}
                  type="button"
                  data-selected={selected || undefined}
                  aria-pressed={selected}
                  /* Width tracks the shot's duration, so retiming it in the
                     inspector moves its boundary on the rail as you scrub. */
                  style={{ width: span * RULER_PX_PER_SEC }}
                  onClick={() => onSelectClip('scene', s.id)}
                >
                  {selected && <span className="anim-scene__handle" aria-hidden />}
                  <span className="anim-scene__body">
                    <CornersOut size={16} />
                    <span className="anim-scene__label">{s.label}</span>
                    {/* One keyframe per eye-contact cut, placed at its share of
                        the shot's run. */}
                    {s.focuses.map((f) => (
                      <span
                        className="anim-scene__keyframe"
                        key={f.id}
                        aria-hidden
                        style={{
                          left: `${Math.min(100, Math.max(0, ((f.time - s.start) / span) * 100))}%`,
                        }}
                      />
                    ))}
                  </span>
                  {selected && <span className="anim-scene__handle" aria-hidden />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Layers 2-4 — avatars */}
        {AVATAR_ROWS.map((row) => (
          <div className="anim-layer anim-avatar-row" key={row.id} data-color={row.color}>
            <div className="anim-rail">
              <img className="anim-avatar" src={row.avatar} alt={row.name} />
            </div>
            <div className="anim-avatar-row__lanes">
              <div className="anim-lane anim-lane--script">
                {row.scripts.map((chip) => (
                  <Script
                    chip={chip}
                    playheadX={playheadX}
                    selected={selection?.kind === 'script' && selection.id === chip.id}
                    onSelect={() => onSelectClip('script', chip.id)}
                    key={chip.id}
                  />
                ))}
              </div>
              <div className="anim-lane anim-lane--interaction">
                {row.interactions.map((it) => {
                  const selected = selection?.kind === 'interaction' && selection.id === it.id;
                  return (
                    <button
                      className="anim-emoji"
                      key={it.id}
                      type="button"
                      data-selected={selected || undefined}
                      aria-pressed={selected}
                      aria-label={`${row.name} reacts ${it.label}`}
                      style={{ left: it.center }}
                      onClick={() => onSelectClip('interaction', it.id)}
                    >
                      {selected && <span className="anim-emoji__handle" aria-hidden />}
                      <span className="anim-emoji__body">{it.emoji}</span>
                      {selected && <span className="anim-emoji__handle" aria-hidden />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ))}

        {/* Node connector lines (who is speaking). Each one selects the
            reaction it runs into, so the thin line is as clickable as the chip
            — and lights up with it when either is picked. */}
        <div className="anim-nodelines">
          {NODE_LINES.map((l) => {
            const selected =
              selection?.kind === 'interaction' && selection.id === l.interactionId;
            return (
              <button
                className="anim-nodeline"
                key={l.id}
                type="button"
                data-selected={selected || undefined}
                aria-pressed={selected}
                aria-label={interactionLabel(l.interactionId)}
                style={{ left: l.left, top: l.top, height: l.height }}
                onClick={() => onSelectClip('interaction', l.interactionId)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
