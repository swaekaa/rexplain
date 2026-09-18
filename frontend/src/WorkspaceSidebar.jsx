/**
 * WorkspaceSidebar.jsx
 * --------------------
 * Persistent workspace sidebar.
 * Purely presentational — all state mutations go through callbacks.
 * Local state: expandedRepo, confirmDelete, rename editing.
 */
import { useState, useEffect, useRef } from "react";

function timeAgo(isoString) {
  if (!isoString) return "";
  const diff = (Date.now() - new Date(isoString)) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(isoString).toLocaleDateString();
}

function repoShortName(url) {
  const parts = url.replace(/\.git$/, "").split("/").filter(Boolean);
  const owner = parts[parts.length - 2] || "";
  const name = parts[parts.length - 1] || url;
  return { owner, name };
}

// ── Rename Input — isolated component so parent re-renders don't overwrite typing ──
function RenameInput({ thread, onSave, onCancel }) {
  const [draft, setDraft] = useState(thread.title);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSave = () => {
    const title = draft.trim();
    if (title && title !== thread.title) {
      onSave(thread.id, title);
    }
    onCancel(); // Always close the edit mode
  };

  return (
    <div className="py-1 relative z-10">
      <input
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") onCancel();
        }}
        onBlur={handleSave}
        className="w-full bg-[color:var(--surface-input)] border border-[color:var(--surface-input-border)] rounded-full px-3 py-1 text-primary font-body text-[12px] font-medium focus:outline-none focus:border-[color:var(--accent-purple)] shadow-inner"
        aria-label="Rename thread"
      />
    </div>
  );
}

export default function WorkspaceSidebar({
  currentRepoUrl,
  currentThreadId,
  onSelectRepo,
  onSelectThread,
  onNewThread,
  onDeleteThread,
  onRenameThread,
  threads,
  repositories,
  loadingThreads,
  isRepoSwitching,
  collapsed,
  onToggle,
}) {
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [expandedRepo, setExpandedRepo] = useState(currentRepoUrl);

  // Sync expanded repo when active repo changes.
  useEffect(() => {
    setExpandedRepo(currentRepoUrl);
  }, [currentRepoUrl]);

  if (collapsed) {
    return (
      <div className="flex flex-col items-center py-8 px-2 gap-4 m-4 rounded-[2rem] bg-surface shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] h-[calc(100%-2rem)] transition-all duration-300 z-20 border-none"
        style={{ width: 72 }}>
        <button onClick={onToggle} className="text-secondary hover:text-primary transition-colors p-2 rounded-xl hover:bg-primary/5 active:scale-95" title="Expand workspace">
          <span className="material-symbols-outlined text-xl">chevron_right</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col m-4 rounded-[2rem] bg-surface shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] overflow-hidden transition-all duration-300 z-20 border-none"
      style={{ width: 280, minWidth: 280, height: 'calc(100% - 2rem)' }}
    >
      {/* Thin repo-switching loading bar at the very top */}
      {isRepoSwitching && (
        <div className="w-full h-[2px] bg-transparent relative overflow-hidden flex-shrink-0">
          <div className="absolute top-0 bottom-0 left-0 w-1/3 bg-accent-purple animate-shimmer" />
        </div>
      )}

      <div className="flex items-center justify-between px-6 pt-5 pb-2 flex-shrink-0">
        <button
          onClick={onToggle}
          className="text-secondary/40 hover:text-primary transition-colors p-1.5 rounded-full hover:bg-primary/10 active:scale-95 bg-primary/5 ml-auto"
          title="Collapse sidebar"
          aria-label="Collapse sidebar"
        >
          <span className="material-symbols-outlined text-[16px]">chevron_left</span>
        </button>
      </div>

      {/* Accordion Repository List */}
      <div className="flex-1 overflow-y-auto scroll-hide px-3 space-y-1">
        {repositories.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-10 opacity-60">
            <span className="material-symbols-outlined text-3xl mb-2 text-secondary">grid_view</span>
            <p className="font-body text-xs text-primary font-medium">No repositories yet</p>
          </div>
        ) : (
          repositories.map((repo) => {
            const { name } = repoShortName(repo.repo_url);
            const isExpanded = expandedRepo === repo.repo_url;
            const isCurrent = currentRepoUrl === repo.repo_url;
            const repoThreads = threads.filter(t => t.repo_url === repo.repo_url);

            return (
              <div key={repo.id} className="flex flex-col transition-all duration-300 mb-1">
                {/* Repository Row */}
                <div
                  className={`flex items-center justify-between w-full px-4 py-2 rounded-2xl transition-all ${
                    isCurrent
                      ? "bg-accent-purple/10 text-accent-purple shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)]"
                      : "text-primary/70 hover:bg-primary/[0.03] hover:text-primary"
                  }`}
                >
                  <button
                    onClick={() => setExpandedRepo(isExpanded ? null : repo.repo_url)}
                    className="flex-1 flex items-center gap-3 outline-none text-left"
                    aria-expanded={isExpanded}
                    aria-label={`${name} repository`}
                  >
                    <span className="material-symbols-outlined text-[18px] opacity-70">grid_view</span>
                    <span className="font-headline font-semibold text-[13px] tracking-wide truncate pr-2">{name}</span>
                    <span className={`material-symbols-outlined text-[16px] transition-transform duration-300 opacity-40 ml-auto ${isExpanded ? 'rotate-180' : ''}`}>
                      expand_more
                    </span>
                  </button>
                  {/* Switch Repo Button — only when not current */}
                  {!isCurrent && (
                    <button
                      onClick={() => onSelectRepo(repo.repo_url)}
                      title="Switch to this repository"
                      aria-label={`Switch to ${name}`}
                      className="ml-2 w-7 h-7 rounded-full bg-primary/5 hover:bg-accent-purple/20 hover:text-accent-purple text-primary/40 flex items-center justify-center transition-colors shrink-0"
                    >
                      <span className="material-symbols-outlined text-[14px]">play_arrow</span>
                    </button>
                  )}
                </div>

                {/* Nested Threads */}
                <div
                  className="overflow-hidden transition-all duration-300 ease-in-out"
                  style={{
                    maxHeight: isExpanded ? '1000px' : '0',
                    opacity: isExpanded ? 1 : 0,
                  }}
                >
                  <div className="relative ml-[22px] mt-1 pl-6 py-2 space-y-0.5">
                    {/* Vertical Tree Branch */}
                    <div className="absolute left-0 top-0 bottom-4 w-[1.5px] bg-primary/10 rounded-full" />

                    {loadingThreads ? (
                      <div className="flex flex-col gap-2 py-2">
                        {[1, 2].map(i => (
                          <div key={i} className="h-5 w-24 rounded-lg bg-primary/5 animate-pulse ml-2" />
                        ))}
                      </div>
                    ) : repoThreads.length === 0 ? (
                      <p className="py-2 text-secondary/40 font-body text-[10px] font-medium italic">No threads yet.</p>
                    ) : (
                      repoThreads.map((thread) => {
                        const isActive = currentThreadId === thread.id;
                        return (
                          <div key={thread.id} className="relative group/thread">
                            {/* Curved Tree Connector */}
                            <svg className="absolute left-[-22px] top-0 h-[20px] w-[20px] pointer-events-none" viewBox="0 0 20 20" preserveAspectRatio="none">
                              <path d="M 0,0 L 0,10 Q 0,20 10,20 L 20,20" fill="none" stroke="currentColor" className="text-primary/10" strokeWidth="1.5" />
                            </svg>

                            {renamingId === thread.id ? (
                              <RenameInput
                                thread={thread}
                                onSave={onRenameThread}
                                onCancel={() => setRenamingId(null)}
                              />
                            ) : (
                              <button
                                onClick={() => onSelectThread(thread)}
                                aria-label={`Thread: ${thread.title}`}
                                aria-current={isActive ? "true" : undefined}
                                className={`w-full text-left px-3 py-1.5 rounded-xl transition-all relative overflow-hidden flex items-center justify-between ${
                                  isActive
                                    ? "text-accent-purple font-semibold"
                                    : "text-secondary/70 hover:text-primary hover:bg-primary/5 font-medium"
                                }`}
                              >
                                <span className="text-[12px] truncate pr-4 relative z-10">{thread.title}</span>

                                {/* Hover Actions */}
                                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover/thread:opacity-100 transition-opacity bg-gradient-to-l from-surface/80 to-transparent pl-4 pr-1 z-20">
                                  <span
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setRenamingId(thread.id);
                                    }}
                                    role="button"
                                    tabIndex={0}
                                    aria-label="Rename thread"
                                    onKeyDown={e => { if (e.key === "Enter") { setRenamingId(thread.id); }}}
                                    className="material-symbols-outlined text-[14px] p-1 rounded hover:bg-primary/10 hover:text-primary text-secondary/60 transition-colors cursor-pointer"
                                  >edit</span>
                                  {confirmDelete === thread.id ? (
                                    <>
                                      <span
                                        onClick={(e) => { e.stopPropagation(); onDeleteThread(thread.id); setConfirmDelete(null); }}
                                        role="button"
                                        tabIndex={0}
                                        aria-label="Confirm delete"
                                        className="material-symbols-outlined text-[14px] p-1 rounded hover:bg-red-500/20 text-red-400 transition-colors cursor-pointer"
                                      >check_circle</span>
                                      <span
                                        onClick={(e) => { e.stopPropagation(); setConfirmDelete(null); }}
                                        role="button"
                                        tabIndex={0}
                                        aria-label="Cancel delete"
                                        className="material-symbols-outlined text-[14px] p-1 rounded hover:bg-primary/10 text-secondary/60 transition-colors cursor-pointer"
                                      >close</span>
                                    </>
                                  ) : (
                                    <span
                                      onClick={(e) => { e.stopPropagation(); setConfirmDelete(thread.id); }}
                                      role="button"
                                      tabIndex={0}
                                      aria-label="Delete thread"
                                      className="material-symbols-outlined text-[14px] p-1 rounded hover:bg-red-500/10 hover:text-red-400 text-secondary/60 transition-colors cursor-pointer"
                                    >delete</span>
                                  )}
                                </div>
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* New Thread — transparent ghost button */}
      <div className="px-4 pb-5 pt-3 flex-shrink-0 mt-auto">
        <button
          onClick={onNewThread}
          aria-label="New Thread"
          className="w-full text-secondary/70 hover:text-accent-purple font-semibold tracking-wide text-[12px] rounded-2xl py-3 flex items-center justify-center gap-2 transition-all hover:bg-accent-purple/10 active:scale-[0.98] border border-outline/40 hover:border-accent-purple/30"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          New Thread
        </button>
      </div>
    </div>
  );
}
