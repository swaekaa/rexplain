/**
 * UserMenu.jsx
 * ------------
 * Displays the logged-in user's avatar, name, and a logout button.
 * Used in the navbar of both the landing page and the analysis view.
 *
 * When logged OUT, shows a "Sign in" button instead.
 */
import { useState, useRef, useEffect } from "react";
import { useAuth } from "./AuthContext";

export default function UserMenu() {
  const { user, isAuthenticated, login, logout, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  // Close menu on outside click
  useEffect(() => {
    function handler(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (loading) {
    return (
      <div className="w-8 h-8 rounded-full bg-primary/10 animate-pulse" />
    );
  }

  if (!isAuthenticated) {
    return (
      <button
        onClick={login}
        className="flex items-center gap-2 px-4 py-2 rounded-xl font-headline font-bold text-[11px] uppercase tracking-[0.18em] text-white hover:opacity-90 hover:scale-[1.02] transition-all"
        style={{ background: "linear-gradient(135deg, #a855f7 0%, #800020 100%)" }}
        id="sign-in-btn"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Sign in
      </button>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 p-1 rounded-full hover:bg-primary/5 transition-all"
        id="user-menu-btn"
        aria-label="User menu"
      >
        {user?.picture ? (
          <img
            src={user.picture}
            alt={user.name || "User"}
            className="w-8 h-8 rounded-full border-2 border-accent-purple/30 object-cover"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-accent-purple/20 flex items-center justify-center text-accent-purple font-bold text-sm">
            {(user?.name || "U")[0].toUpperCase()}
          </div>
        )}
        <span className="hidden md:block text-primary font-headline font-semibold text-sm max-w-[120px] truncate">
          {user?.name?.split(" ")[0]}
        </span>
        <span className="material-symbols-outlined text-secondary text-base">
          {open ? "expand_less" : "expand_more"}
        </span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-outline shadow-xl backdrop-blur-xl z-[200] overflow-hidden"
          style={{ background: "var(--bg-surface)" }}
        >
          {/* User info */}
          <div className="px-4 py-4 border-b border-outline">
            <div className="flex items-center gap-3">
              {user?.picture ? (
                <img src={user.picture} alt={user.name} className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-accent-purple/20 flex items-center justify-center text-accent-purple font-bold">
                  {(user?.name || "U")[0].toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-primary font-headline font-bold text-sm truncate">{user?.name}</p>
                <p className="text-secondary font-body text-xs truncate">{user?.email}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="p-2">
            <button
              onClick={() => { setOpen(false); logout(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-secondary hover:text-primary hover:bg-primary/5 transition-all font-body text-sm"
              id="logout-btn"
            >
              <span className="material-symbols-outlined text-base">logout</span>
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
