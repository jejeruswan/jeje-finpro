import { useState } from 'react';
import {
  AppHeader,
  ChatPanel,
  EditorCanvas,
  TimelineResizer,
  TimelineRuler,
  Tracks,
} from './components';
import { AVATAR_ROWS, PLAYHEAD_LEFT, RULER_PX_PER_SEC, TIME_LABEL } from './data';
import type { TimelineSelection } from './data';
import { useShotEditing } from './useShotEditing';
import { useResizableTimeline } from './useResizableTimeline';
import { useCenteredPlayhead } from './useCenteredPlayhead';
import { usePlayback } from './usePlayback';
import './animator.css';

/** Seconds → "M:SS.CS" for the ruler time pill. */
function formatTime(sec: number): string {
  const clamped = Math.max(0, sec);
  const m = Math.floor(clamped / 60);
  const s = Math.floor(clamped % 60);
  const cs = Math.floor((clamped * 100) % 100);
  return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

export function Animator() {
  // Which timeline clip is selected. One at a time across every track, so
  // picking a script clip drops a selected camera shot (and vice versa) and the
  // floating inspector swaps with it. `null` = nothing selected, no panel.
  const [selection, setSelection] = useState<TimelineSelection | null>(null);

  // Clicking the already-selected clip deselects it and closes the panel.
  const selectClip = (kind: TimelineSelection['kind'], id: string) =>
    setSelection((cur) => (cur?.kind === kind && cur.id === id ? null : { kind, id }));

  // The camera shots, and every edit the Shot Style inspector can make to them.
  // Held as state so renames, retimes and focus cuts land on the rail live.
  const shots = useShotEditing();

  const selectedScene =
    selection?.kind === 'scene'
      ? (shots.scenes.find((s) => s.id === selection.id) ?? null)
      : null;
  const selectedScript =
    selection?.kind === 'script'
      ? (AVATAR_ROWS.flatMap((r) => r.scripts).find((c) => c.id === selection.id) ?? null)
      : null;
  const selectedInteraction =
    selection?.kind === 'interaction'
      ? (AVATAR_ROWS.flatMap((r) => r.interactions).find((i) => i.id === selection.id) ?? null)
      : null;

  // Draggable splitter between the preview and the timeline.
  const { containerRef, timelineHeight, resizerProps } = useResizableTimeline();

  // Chat sidebar. Closing it collapses the panel to the left and lets the
  // editor + timeline expand into the full width. One shared toggle backs every
  // entry point: the panel's X, the tool pillar's chat icon and the header.
  const [chatOpen, setChatOpen] = useState(true);
  const toggleChat = () => setChatOpen((v) => !v);

  // Simulated playback: the playhead sweeps and the tracks highlight each word
  // as it is passed. At rest it sits in the middle of the timeline — measured,
  // so it re-centres when the chat panel collapses and the workspace widens.
  const restingX = useCenteredPlayhead(containerRef, PLAYHEAD_LEFT);
  const { isPlaying, playheadX, toggle } = usePlayback(restingX);
  const atRest = !isPlaying && playheadX === restingX;
  const timeLabel = atRest
    ? TIME_LABEL
    : `${formatTime(playheadX / RULER_PX_PER_SEC)} / 0:55.00`;

  return (
    <div className="anim">
      <div className="anim-window">
        <AppHeader chatOpen={chatOpen} onToggleChat={toggleChat} />
        <div className="anim-body">
          <div className="anim-shell">
            <ChatPanel open={chatOpen} onClose={toggleChat} />
            <main className="anim-main" ref={containerRef}>
              <EditorCanvas
                selectedScene={selectedScene}
                selectedScript={selectedScript}
                selectedInteraction={selectedInteraction}
                onCloseInspector={() => setSelection(null)}
                isPlaying={isPlaying}
                onTogglePlay={toggle}
                chatOpen={chatOpen}
                onToggleChat={toggleChat}
                shots={shots}
              />
              <TimelineResizer {...resizerProps} />
              <div className="anim-timeline" style={{ height: timelineHeight }}>
                <TimelineRuler playheadX={playheadX} label={timeLabel} />
                <Tracks
                  scenes={shots.scenes}
                  selection={selection}
                  onSelectClip={selectClip}
                  playheadX={playheadX}
                />
                {/* Sits outside the scrolling tracks so it stays locked under
                    the ruler's time pill; it advances during playback. */}
                <span
                  className="anim-playhead"
                  style={{ left: `calc(var(--rail) + ${playheadX}px)` }}
                />
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
