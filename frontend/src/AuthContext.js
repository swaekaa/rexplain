/**
 * AuthContext.js
 * --------------
 * Manages authentication state for the entire app.
 *
 * Token strategy: in-memory only (NOT localStorage).
 * - Token is stored in React state (survives re-renders, lost on full page refresh).
 * - On mount, reads token from URL (?token=...) if Google just redirected back.
 * - On mount (and token change), calls /auth/me to validate and load user.
 * - Provides: user, loading, isAuthenticated, token, login(), logout()
 */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";

const API_URL =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_URL)
    ? import.meta.env.VITE_API_URL
    : (process.env.REACT_APP_API_URL || "http://127.0.0.1:8000");

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);

  const fetchMe = useCallback(async (jwt) => {
    if (!jwt) return null;
    try {
      const res = await axios.get(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${jwt}` },
        timeout: 8000,
      });
      return res.data;
    } catch {
      return null;
    }
  }, []);

  // On mount: check URL for token (Google OAuth redirect) or restore from sessionStorage
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    (async () => {
      setLoading(true);

      // 1. Check URL for token from Google OAuth redirect
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get("token");
      const authError = params.get("auth_error");

      // Clean the URL regardless
      if (urlToken || authError) {
        const clean = window.location.pathname;
        window.history.replaceState({}, "", clean);
      }

      if (authError) {
        console.warn("[auth] OAuth error:", authError);
        setLoading(false);
        return;
      }

      // 2. Use URL token if present, otherwise try sessionStorage fallback
      let jwt = urlToken;
      if (!jwt) {
        try { jwt = sessionStorage.getItem("rexplain_token"); } catch { }
      }

      if (jwt) {
        const me = await fetchMe(jwt);
        if (me) {
          setToken(jwt);
          setUser(me);
          // Persist in sessionStorage so refresh works within same browser tab/session
          try { sessionStorage.setItem("rexplain_token", jwt); } catch { }
        } else {
          // Token invalid — clear it
          try { sessionStorage.removeItem("rexplain_token"); } catch { }
        }
      }

      setLoading(false);
    })();
  }, [fetchMe]);

  const login = useCallback(() => {
    // Redirect browser to backend OAuth start
    window.location.href = `${API_URL}/auth/google`;
  }, []);

  const logout = useCallback(async () => {
    try {
      if (token) {
        await axios.post(`${API_URL}/auth/logout`, {}, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch { }
    setToken(null);
    setUser(null);
    try { sessionStorage.removeItem("rexplain_token"); } catch { }
  }, [token]);

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!user,
    login,
    logout,
    apiUrl: API_URL,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

// Helper: axios instance with auth header injected
export function useAuthAxios() {
  const { token } = useAuth();
  return useCallback((config = {}) => {
    return axios({
      ...config,
      headers: {
        ...(config.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  }, [token]);
}
