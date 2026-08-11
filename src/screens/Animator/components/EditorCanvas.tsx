import { useState } from 'react';
import {
  ChatCircle,
  Aperture,
  Users,
  Article,
  ShareNetwork,
  Gear,
  Play,
  Pause,
  Minus,
  Plus,
} from '@phosphor-icons/react';
import { IconButton } from '../../../ui/IconButton';
import { ShotStylePanel } from './ShotStylePanel';
import { ScriptPanel } from './ScriptPanel';
import { InteractionPanel } from './InteractionPanel';
import { SHOT_PRESETS } from '../data';
import type { Interaction, Scene, ScriptChip } from '../data';
import type { ShotEditing } from '../useShotEditing';

/** The framing a shot's preset applies to the preview, as a CSS transform.
 *  With nothing selected the viewport sits at its natural wide framing. */
function framingTransform(scene: Scene | null): string | undefined {
  if (!scene) return undefined;
  const p = SHOT_PRESETS.find((x) => x.id === scene.preset);
  if (!p) return undefined;
  return `scale(${p.zoom}) translate(${p.x}%, ${p.y}%)`;
}

/** The editor tools in the left pillar; exactly one is active at a time. The
 *  chat toggle sits above them and is deliberately not part of this group — it
 *  is an independent on/off, not a tool selection. */
const TOOLS = [
  { id: 'shot-styles', label: 'Shot styles', Icon: Aperture },
  { id: 'avatars', label: 'Avatars', Icon: Users },
  { id: 'script', label: 'Script', Icon: Article },
  { id: 'interactions', label: 'Interactions', Icon: ShareNetwork },
  { id: 'settings', label: 'Settings', Icon: Gear },
];

/**
 * Editor canvas: a transparent tool pillar on the far left (between the chat
 * sidebar and the preview), the centered video preview, and the play / zoom
 * controls floating just outside the video frame (bottom-left / bottom-right).
 * Selecting a timeline clip floats an inspector on the right: "Shot Style" for
 * a camera-shot clip, "Script" for a script clip, "Interaction" for an emoji
 * reaction. Selection is exclusive, so at most one of the three is ever set.
 */
export function EditorCanvas({
  selectedScene,
  selectedScript,
  selectedInteraction,
  onCloseInspector,
  isPlaying,
  onTogglePlay,
  chatOpen,
  onToggleChat,
  shots,
}: {
  selectedScene: Scene | null;
  selectedScript: ScriptChip | null;
  selectedInteraction: Interaction | null;
  onCloseInspector: () => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  chatOpen: boolean;
  onToggleChat: () => void;
  shots: ShotEditing;
}) {
  // The currently selected editor tool. Clicking any icon activates it.
  // Starts unset: the chat toggle above carries the pillar's active pill while
  // the panel is open, matching the design's single highlighted icon.
  const [activeTool, setActiveTool] = useState<string | null>(null);

  return (
    <div className="anim-canvas">
      <div className="anim-toolcol">
        <div className="anim-toolbar surface">
          {/* Chat toggle — the same action as the panel's own X: shows the
              panel when hidden, hides it when shown. */}
          <IconButton
            size={32}
            pill
            variant={chatOpen ? 'selected' : 'ghost'}
            aria-label={chatOpen ? 'Close chat' : 'Open chat'}
            aria-pressed={chatOpen}
            onClick={onToggleChat}
          >
            <ChatCircle size={18} />
          </IconButton>

          {TOOLS.map(({ id, label, Icon }) => (
            <IconButton
              key={id}
              size={32}
              pill
              variant={activeTool === id ? 'selected' : 'ghost'}
              aria-label={label}
              aria-pressed={activeTool === id}
              onClick={() => setActiveTool(id)}
            >
              {/* Regular (outline) weight: the shape's fill is transparent, so
                  the white pill shows through when the tool is active. */}
              <Icon size={18} />
            </IconButton>
          ))}
        </div>

        <button
          className="anim-play"
          type="button"
          aria-label={isPlaying ? 'Pause' : 'Play'}
          aria-pressed={isPlaying}
          onClick={onTogglePlay}
        >
          {isPlaying ? <Pause size={18} weight="fill" /> : <Play size={18} weight="fill" />}
        </button>
      </div>

      <div className="anim-preview-wrap">
        <div className="anim-preview">
          {/* The selected shot's preset reframes the viewport — a stand-in for
              a real camera move, so switching Wide / CU / OTS is visible. */}
          <img
            src="/assets/animator-preview.png"
            alt="Video preview"
            style={{ transform: framingTransform(selectedScene) }}
          />
        </div>
      </div>

      <div className="anim-zoom surface">
        <IconButton size={26} variant="ghost" aria-label="Zoom out">
          <Minus size={16} />
        </IconButton>
        <IconButton size={26} variant="ghost" aria-label="Zoom in">
          <Plus size={16} />
        </IconButton>
      </div>

      {selectedScene && (
        <ShotStylePanel
          scene={selectedScene}
          onClose={onCloseInspector}
          onRename={(label) => shots.rename(selectedScene.id, label)}
          onRetime={(edge, sec) => shots.retime(selectedScene.id, edge, sec)}
          onSetPreset={(preset) => shots.setPreset(selectedScene.id, preset)}
          onSetSpeaker={(speaker) => shots.setSpeaker(selectedScene.id, speaker)}
          onAddFocus={() => shots.addFocus(selectedScene.id)}
          onRemoveFocus={(focusId) => shots.removeFocus(selectedScene.id, focusId)}
          onUpdateFocus={(focusId, next) => shots.updateFocus(selectedScene.id, focusId, next)}
        />
      )}
      {selectedScript && <ScriptPanel chip={selectedScript} onClose={onCloseInspector} />}
      {selectedInteraction && (
        <InteractionPanel interaction={selectedInteraction} onClose={onCloseInspector} />
      )}
    </div>
  );
}
