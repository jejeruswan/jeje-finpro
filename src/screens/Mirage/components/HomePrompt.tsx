import { useState } from 'react';
import {
  ArrowRightThin,
  AvatarsAdd,
  ChevronDownSmall,
  CreateTemplate,
  EditBare,
  FolderAdd,
  HouseNav,
  InfoRing,
  PaperclipTilt,
  SidebarPanel,
  TipLamp,
} from '../../../assets/icons';
import { AVATARS, PROMPT_PLACEHOLDER, PROMPT_TEXT, SIDEBAR_PROJECTS } from '../data';

/**
 * Raw 01 → Raw 02: the Captions home. Clicking the prompt field or "Add
 * avatars" configures the prompt (Raw 02); "Create my video →" hands off to
 * the corkboard immediately — the generation itself is watched on Level 1.
 */
export function HomePrompt({ onCreate }: { onCreate: () => void }) {
  const [configured, setConfigured] = useState(false);
  const [sideOpen, setSideOpen] = useState(true);
  const configure = () => setConfigured(true);

  return (
    <div className="mir-home">
      <aside className="mir-side" data-collapsed={!sideOpen || undefined} inert={!sideOpen}>
        <div className="mir-side__content">
          <button
            type="button"
            className="mir-side__toggle"
            aria-label="Collapse sidebar"
            aria-expanded={sideOpen}
            onClick={() => setSideOpen(false)}
          >
            <SidebarPanel size={20} />
          </button>

          <button type="button" className="mir-side__workspace">
            Mirage
            <ChevronDownSmall size={16} />
          </button>

          <nav className="mir-side__nav">
            <button type="button" className="mir-side__item mir-side__item--active">
              <HouseNav size={20} />
              Home
            </button>
            <button type="button" className="mir-side__item">
              <FolderAdd size={20} />
              New folder
            </button>
          </nav>
          <div className="mir-side__divider" />

          <div className="mir-side__projects">
            {SIDEBAR_PROJECTS.map((p, i) => (
              <button type="button" className="mir-side__project" key={i}>
                <img src={p.thumb} alt="" width={30} height={36} />
                <span className="mir-side__project-info">
                  <span className="mir-side__project-title">{p.title}</span>
                  <span className="mir-side__project-meta">{p.meta}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="mir-side__footer">
            <button type="button" className="mir-side__credits">
              <img src="/assets/mirage-coin.svg" alt="" width={20} height={20} />
              5288 credits
            </button>
            <button type="button" className="mir-side__help" aria-label="Help">
              <InfoRing size={20} />
            </button>
          </div>
        </div>
      </aside>

      <main className="mir-home__main">
        {/* When the sidebar is away, its toggle waits at the main area's
            top-left to bring it back. */}
        {!sideOpen && (
          <button
            type="button"
            className="mir-side__toggle mir-home__reopen"
            aria-label="Expand sidebar"
            aria-expanded={false}
            onClick={() => setSideOpen(true)}
          >
            <SidebarPanel size={20} />
          </button>
        )}
        <div className="mir-home__content">
          <div className="mir-home__header">
            <img src="/assets/captions-logo.svg" alt="" className="mir-home__logo" />
            <h1 className="mir-home__title">Welcome to Captions</h1>
          </div>

          <div className="mir-prompt">
            <div
              className="mir-prompt__field"
              onClick={configure}
              role="textbox"
              aria-label="Prompt"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && configure()}
            >
              {configured ? (
                <p className="mir-prompt__text">{PROMPT_TEXT}</p>
              ) : (
                <p className="mir-prompt__placeholder">
                  <span className="mir-prompt__caret" />
                  {PROMPT_PLACEHOLDER}
                </p>
              )}
            </div>

            <div className="mir-prompt__actions">
              <div className="mir-prompt__pills">
                <button type="button" className="mir-pill mir-pill--icon" aria-label="Attach">
                  <PaperclipTilt size={20} />
                </button>
                {configured ? (
                  (['evelyn', 'emily'] as const).map((id) => (
                    <button type="button" className="mir-pill mir-pill--tagged mir-pill--avatar" key={id}>
                      <img src={AVATARS[id].chip} alt="" width={30} height={30} />
                      {AVATARS[id].name}
                    </button>
                  ))
                ) : (
                  <button type="button" className="mir-pill" onClick={configure}>
                    <AvatarsAdd size={20} />
                    Add avatars
                  </button>
                )}
              </div>

              <button
                type="button"
                className={`mir-create ${configured ? 'mir-create--ready' : ''}`}
                disabled={!configured}
                onClick={onCreate}
              >
                Create my video
                <ArrowRightThin size={20} />
              </button>
            </div>
          </div>

          <div className="mir-home__modes">
            <button type="button" className="mir-mode">
              <CreateTemplate size={16} />
              Create
            </button>
            <button type="button" className="mir-mode">
              <EditBare size={16} />
              Edit
            </button>
            <button type="button" className="mir-mode">
              <TipLamp size={16} />
              Mirage’s choice
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
