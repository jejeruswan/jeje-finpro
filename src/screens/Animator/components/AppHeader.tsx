/**
 * Top app header: just the project title. The buttons are gone — no sidebar
 * toggle (no chat panel), no undo/redo (no history yet), no download, no more —
 * and the level/altitude toggle system is retired with them.
 */
export function AppHeader({ title }: { title: string }) {
  return (
    <header className="anim-header">
      <div className="anim-header__group">
        <span className="anim-header__title">{title}</span>
      </div>
    </header>
  );
}
