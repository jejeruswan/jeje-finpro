import type { ReactNode } from 'react';
import { X, Plus, NotePencil, ChartBar, CaretDown, ArrowUp } from '@phosphor-icons/react';
import { IconButton } from '../../../ui/IconButton';

/**
 * Left chat panel: header, body (empty unless the host screen passes
 * conversation content in as children), and a bottom composer.
 *
 * Collapsing is driven from the outside (`open`). The panel is a fixed-width
 * inner block inside a clipping shell, so shrinking the shell slides the
 * content out to the left instead of reflowing it on the way.
 */
export function ChatPanel({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <aside className="anim-chat" data-collapsed={!open || undefined} inert={!open}>
      <div className="anim-chat__inner">
        <div className="anim-chat__head">
          <span className="anim-chat__tab">Chat</span>
          <IconButton size={32} aria-label="Close chat" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>

        <div className="anim-chat__body">{children}</div>

        <div className="anim-chat__composer surface">
          <p className="anim-chat__placeholder">Tell me how I can help edit your video</p>
          <div className="anim-chat__composer-row">
            <div className="anim-chat__composer-left">
              <IconButton size={32} pill aria-label="Attach">
                <Plus size={18} />
              </IconButton>
              <IconButton size={32} pill aria-label="New chat">
                <NotePencil size={18} />
              </IconButton>
              <button className="btn btn--pill" type="button">
                <ChartBar size={16} weight="fill" />
                Medium
                <CaretDown size={16} />
              </button>
            </div>
            <button className="anim-chat__send" type="button" aria-label="Send" disabled>
              <ArrowUp size={18} weight="bold" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
