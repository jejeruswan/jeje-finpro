import { useEffect, useMemo, useState } from 'react';
import { CHARS, type CharId, type Scene } from '../data';
import type { DiveContext } from './Page';

/* ----------------------------------------------------------------------------
   FRAME: one moment, full bleed. Develops through the letterforms of the word
   you dove into, like a darkroom print. The avatars are objects — the scene
   graph came free from generation — so they're clickable.
   ---------------------------------------------------------------------------- */

export type Eyeline = 'camera' | 'partner' | 'down';

type Overlay = 'occlusion' | 'legibility' | 'confidence';
type Platform = 'tiktok' | 'reels' | 'shorts';

/** Platform UI presets — the hatched regions shift between them. */
const OCCLUSION: Record<Platform, { rail: React.CSSProperties; band: React.CSSProperties }> = {
  tiktok: { rail: { top: '34%', bottom: '13%', width: 76 }, band: { height: '17%' } },
  reels: { rail: { top: '40%', bottom: '15%', width: 70 }, band: { height: '22%' } },
  shorts: { rail: { top: '36%', bottom: '11%', width: 86 }, band: { height: '19%' } },
};

type FrameProps = {
  ctx: DiveContext;
  scene: Scene;
  leaving: boolean;
  playing: boolean;
  progress: number;
  eyelines: Record<CharId, Eyeline>;
  onEyeline: (c: CharId, e: Eyeline) => void;
  verbFor: (c: CharId) => string;
};

export function Frame({ ctx, scene, leaving, playing, progress, eyelines, onEyeline, verbFor }: FrameProps) {
  const [developed, setDeveloped] = useState(false);
  const [selected, setSelected] = useState<CharId | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [overlays, setOverlays] = useState<Set<Overlay>>(new Set());
  const [platform, setPlatform] = useState<Platform>('tiktok');
  const [pulsing, setPulsing] = useState<CharId | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setDeveloped(true)));
    return () => cancelAnimationFrame(id);
  }, []);

  /* Escape closes the eyeline menu, then the character card, before the
     global handler zooms back up an altitude. */
  useEffect(() => {
    if (!selected) return;
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (menuOpen) setMenuOpen(false);
      else setSelected(null);
    };
    window.addEventListener('keydown', key, { capture: true });
    return () => window.removeEventListener('keydown', key, { capture: true });
  }, [selected, menuOpen]);

  const radius = useMemo(
    () => Math.hypot(Math.max(ctx.cx, window.innerWidth - ctx.cx), Math.max(ctx.cy, window.innerHeight - ctx.cy)) + 60,
    [ctx],
  );

  const open = developed && !leaving;
  const line = scene.lines[ctx.lineIdx];
  const lineChar = CHARS[line.who];

  const toggle = (o: Overlay) =>
    setOverlays((prev) => {
      const next = new Set(prev);
      if (next.has(o)) next.delete(o);
      else next.add(o);
      return next;
    });

  const pulse = (c: CharId) => {
    setPulsing(c);
    window.setTimeout(() => setPulsing(null), 1500);
  };

  const changeEyeline = (c: CharId, e: Eyeline) => {
    onEyeline(c, e);
    setMenuOpen(false);
    pulse(c); // regeneration, simulated: the working ink glows while it thinks
  };

  const occ = OCCLUSION[platform];
  const partnerName = (c: CharId) => (c === 'jess' ? 'Kai' : 'Jess');
  const eyelineLabel = (c: CharId, e: Eyeline) =>
    e === 'camera' ? '→ camera' : e === 'down' ? '→ down' : `→ ${partnerName(c)}`;

  return (
    <div
      className={`dir-frame ${open ? 'is-open' : ''}`}
      style={{ clipPath: `circle(${open ? radius : 26}px at ${ctx.cx}px ${ctx.cy}px)` }}
      onClick={() => setSelected(null)}
    >
      {/* The word's letterforms, dissolving as the frame develops through them. */}
      <span
        className={`fr-wordclone ${open ? 'is-gone' : ''}`}
        style={{ left: ctx.rect.x, top: ctx.rect.y, color: lineChar.text }}
      >
        {ctx.word}
      </span>

      <div className="fr-stage">
        <i className="fr-spot" />
        <div className="fr-screenprop">
          <i />
          <i />
        </div>
        <i className="fr-floor" />

        <Figure
          char="jess"
          eyeline={eyelines.jess}
          selected={selected === 'jess'}
          pulsing={pulsing === 'jess'}
          onClick={(e) => {
            e.stopPropagation();
            setSelected('jess');
            setMenuOpen(false);
          }}
        />
        <div className="fr-mic" aria-hidden>
          <i className="fr-mic-cap" />
          <i className="fr-mic-stand" />
        </div>
        <Figure
          char="kai"
          eyeline={eyelines.kai}
          selected={selected === 'kai'}
          pulsing={pulsing === 'kai'}
          onClick={(e) => {
            e.stopPropagation();
            setSelected('kai');
            setMenuOpen(false);
          }}
        />
      </div>

      {/* --- Occlusion: where platform UI sits --------------------------------- */}
      {overlays.has('occlusion') && (
        <div className="fr-occ" aria-hidden>
          <div className="fr-occ-rail" style={occ.rail}>
            {Array.from({ length: 5 }, (_, i) => (
              <i key={i} />
            ))}
          </div>
          <div className="fr-occ-band" style={occ.band}>
            <span className="fr-occ-label">covered by platform UI</span>
          </div>
        </div>
      )}

      {/* --- Legibility: where captions can live -------------------------------- */}
      {overlays.has('legibility') && (
        <div className="fr-heat" aria-hidden>
          <i className="fr-heat-safe" style={{ left: '8%', top: '18%', width: '38%', height: '34%' }} />
          <i className="fr-heat-safe" style={{ left: '30%', top: '56%', width: '32%', height: '20%' }} />
          <i className="fr-heat-busy" style={{ right: '2%', top: '30%', width: '16%', height: '52%' }} />
          <i className="fr-heat-busy" style={{ left: '10%', bottom: '0%', width: '84%', height: '16%' }} />
          <i className="fr-heat-busy" style={{ right: '9%', top: '10%', width: '24%', height: '26%' }} />
        </div>
      )}

      {/* --- Confidence: the model saying "check me" ---------------------------- */}
      {overlays.has('confidence') && (
        <div className="fr-conf" aria-hidden>
          <div className="fr-conf-region" style={{ left: '21%', top: '58%', width: 230, height: 140 }}>
            <span>model uncertain — check before export</span>
          </div>
          <div className="fr-conf-region" style={{ right: '11%', top: '11%', width: 320, height: 200 }}>
            <span>model uncertain — check before export</span>
          </div>
        </div>
      )}

      {/* --- Overlay toggles ------------------------------------------------------ */}
      <div className="fr-toggles" onClick={(e) => e.stopPropagation()}>
        {(['occlusion', 'legibility', 'confidence'] as Overlay[]).map((o) => (
          <button key={o} type="button" className={`fr-toggle ${overlays.has(o) ? 'is-on' : ''}`} onClick={() => toggle(o)}>
            {o[0].toUpperCase() + o.slice(1)}
          </button>
        ))}
        {overlays.has('occlusion') && (
          <div className="fr-presets">
            {(['tiktok', 'reels', 'shorts'] as Platform[]).map((p) => (
              <button key={p} type="button" className={platform === p ? 'is-on' : ''} onClick={() => setPlatform(p)}>
                {p === 'tiktok' ? 'TikTok' : p[0].toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* --- Character card -------------------------------------------------------- */}
      {selected && (
        <div className="fr-card" onClick={(e) => e.stopPropagation()}>
          <header>
            <img src={CHARS[selected].avatar} alt="" style={{ borderColor: CHARS[selected].text }} />
            <b style={{ color: CHARS[selected].text }}>{CHARS[selected].name}</b>
          </header>
          <div className="fr-card-row">
            <span>direction</span>
            <b className="fr-card-verb">{verbFor(selected)}</b>
          </div>
          <div className="fr-card-row">
            <span>eyeline</span>
            <div className="fr-dd">
              <button type="button" onClick={() => setMenuOpen((v) => !v)}>
                {eyelineLabel(selected, eyelines[selected])}
                <i>▾</i>
              </button>
              {menuOpen && (
                <ul>
                  {(['camera', 'partner', 'down'] as Eyeline[]).map((e) => (
                    <li key={e}>
                      <button
                        type="button"
                        className={eyelines[selected] === e ? 'is-on' : ''}
                        onClick={() => changeEyeline(selected, e)}
                      >
                        {eyelineLabel(selected, e)}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <button type="button" className="fr-rerender" onClick={() => pulse(selected)}>
            re-render
          </button>
        </div>
      )}

      {/* Breadcrumb: the line you dove through stays pinned. */}
      <div className="fr-caption">
        <b style={{ color: lineChar.text }}>{lineChar.name}</b>
        <span>{line.words.map((w) => w.t).join(' ')}</span>
      </div>

      {playing && <span className="fr-progress" style={{ width: `${progress * 100}%` }} />}
    </div>
  );
}

function Figure({
  char,
  eyeline,
  selected,
  pulsing,
  onClick,
}: {
  char: CharId;
  eyeline: Eyeline;
  selected: boolean;
  pulsing: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      className={`fr-figure fr-figure--${char} ${selected ? 'is-selected' : ''} ${pulsing ? 'is-working' : ''}`}
      style={{ ['--rim' as string]: CHARS[char].text }}
      data-eyeline={eyeline}
      onClick={onClick}
      aria-label={CHARS[char].name}
    >
      <span className="fr-head">
        <i className="fr-face" />
      </span>
      <span className="fr-body" />
    </button>
  );
}
