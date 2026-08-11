import {
  ArrowLeft,
  FadersHorizontal,
  Layout,
  ArrowCounterClockwise,
  ArrowClockwise,
  DownloadSimple,
  DotsThree,
} from '@phosphor-icons/react';
import { IconButton } from '../../../ui/IconButton';
import { Button } from '../../../ui/Button';

/** Top app header: back + title, layout toggles, undo/redo + download.
 *  The Layout button doubles as the chat panel's show/hide toggle, so the panel
 *  can be brought back after it has been closed from its own X. */
export function AppHeader({
  chatOpen,
  onToggleChat,
}: {
  chatOpen: boolean;
  onToggleChat: () => void;
}) {
  return (
    <header className="anim-header">
      <div className="anim-header__group">
        <IconButton size={40} aria-label="Back">
          <ArrowLeft size={20} />
        </IconButton>
        <span className="anim-header__title">Tokyo Offsite</span>
      </div>

      <div className="anim-header__group">
        <IconButton size={40} variant="active" aria-label="Filters">
          <FadersHorizontal size={20} />
        </IconButton>
        <IconButton
          size={40}
          variant={chatOpen ? 'active' : undefined}
          aria-label={chatOpen ? 'Hide chat panel' : 'Show chat panel'}
          aria-pressed={chatOpen}
          onClick={onToggleChat}
        >
          <Layout size={20} />
        </IconButton>
      </div>

      <div className="anim-header__group">
        <IconButton size={40} aria-label="Undo">
          <ArrowCounterClockwise size={20} />
        </IconButton>
        <IconButton size={40} aria-label="Redo">
          <ArrowClockwise size={20} />
        </IconButton>
        <Button variant="primary" leftIcon={<DownloadSimple size={20} weight="bold" />}>
          Download video
        </Button>
        <IconButton size={40} aria-label="More">
          <DotsThree size={20} weight="bold" />
        </IconButton>
      </div>
    </header>
  );
}
