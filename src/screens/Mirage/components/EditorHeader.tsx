import {
  ArrowClockwise,
  ArrowCounterClockwise,
  DownloadSimple,
  Sidebar,
} from '@phosphor-icons/react';
import { IconButton } from '../../../ui/IconButton';
import { Button } from '../../../ui/Button';

/**
 * The fixed editor header for both zoom levels: the sidebar toggle and the
 * project title — which stays the SAME at every level, so the header names the
 * project, not your position in it. It lives OUTSIDE the zoom viewport, so
 * level travel never scales it. The unused props stay accepted so the host
 * keeps compiling while the navigation model settles.
 */
export function EditorHeader({
  level,
  labels,
  onJump,
  chatOpen,
  onToggleChat,
}: {
  level: 1 | 2;
  /** [project title, level-2 context] — only the project title is shown now. */
  labels: [string, string];
  onJump?: (level: 1 | 2) => void;
  chatOpen?: boolean;
  onToggleChat?: () => void;
}) {
  void level;
  void onJump;
  return (
    <header className="mir-editor__header">
      <div className="mir-editor__header-left">
        <IconButton
          size={40}
          aria-label={chatOpen ? 'Hide sidebar' : 'Show sidebar'}
          aria-pressed={chatOpen}
          onClick={onToggleChat}
        >
          <Sidebar size={20} />
        </IconButton>
        <span className="mir-editor__title">{labels[0]}</span>
      </div>

      <div className="mir-editor__header-right">
        <IconButton size={40} aria-label="Undo">
          <ArrowCounterClockwise size={20} />
        </IconButton>
        <IconButton size={40} aria-label="Redo">
          <ArrowClockwise size={20} />
        </IconButton>
        <Button variant="primary" leftIcon={<DownloadSimple size={20} weight="bold" />}>
          Download video
        </Button>
      </div>
    </header>
  );
}
