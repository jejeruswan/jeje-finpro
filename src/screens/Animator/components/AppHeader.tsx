import { ArrowCounterClockwise, ArrowClockwise, DownloadSimple } from '@phosphor-icons/react';
import { IconButton } from '../../../ui/IconButton';
import { Button } from '../../../ui/Button';

/**
 * Top app header: the project title on the left; undo/redo and the download
 * action on the right. The middle toggle group (layout/filters) stays retired
 * with the three-level system.
 */
export function AppHeader({ title }: { title: string }) {
  return (
    <header className="anim-header">
      <div className="anim-header__group">
        <span className="anim-header__title">{title}</span>
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
      </div>
    </header>
  );
}
