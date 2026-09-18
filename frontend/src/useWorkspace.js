/**
 * useWorkspace.js
 * ---------------
 * Custom hook that manages all workspace state:
 *   - Repository history
 *   - Thread list for current repo
 *   - Message history for current thread
 *   - Thread CRUD (create, rename, delete)
 *
 * All data is fetched from the backend (PostgreSQL is the source of truth).
 * Authenticated users get full persistence.
 */
import { useState, useCallback, useEffect } from "react";
import axios from "axios";
import { useAuth } from "./AuthContext";

const API_URL =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_URL)
    ? import.meta.env.VITE_API_URL
    : (process.env.REACT_APP_API_URL || "http://127.0.0.1:8000");

export function useWorkspace() {
  const { token, isAuthenticated } = useAuth();

  const [repositories, setRepositories] = useState([]);
  const [threads, setThreads] = useState([]);
  const [messages, setMessages] = useState([]);
  const [messagesCache, setMessagesCache] = useState({});
  const [currentRepoUrl, setCurrentRepoUrl] = useState(null);
  const [currentThreadId, setCurrentThreadId] = useState(null);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const authHeaders = useCallback(() => ({
    Authorization: `Bearer ${token}`,
  }), [token]);

  // ── Fetch repositories ──────────────────────────────────────────────────────
  const refreshRepositories = useCallback(async () => {
    if (!isAuthenticated || !token) return;
    setLoadingRepos(true);
    try {
      const res = await axios.get(`${API_URL}/repositories`, { headers: authHeaders() });
      setRepositories(res.data || []);
    } catch (e) {
      console.warn("[workspace] failed to load repositories:", e);
    }
    setLoadingRepos(false);
  }, [isAuthenticated, token, authHeaders]);

  // ── Fetch threads for all repos ────────────────────────────────────────────────
  const refreshThreads = useCallback(async (background = false) => {
    if (!isAuthenticated || !token) return;
    if (!background) setLoadingThreads(true);
    try {
      const res = await axios.get(`${API_URL}/threads`, {
        headers: authHeaders(),
      });
      setThreads(res.data || []);
    } catch (e) {
      console.warn("[workspace] failed to load threads:", e);
    }
    if (!background) setLoadingThreads(false);
  }, [isAuthenticated, token, authHeaders]);

  useEffect(() => {
    if (isAuthenticated) {
      refreshRepositories();
      refreshThreads(false);
    }
    else { setRepositories([]); setThreads([]); setMessages([]); }
  }, [isAuthenticated, refreshRepositories, refreshThreads]);

  // ── Fetch messages for a thread ─────────────────────────────────────────────
  const refreshMessages = useCallback(async (threadId, background = false) => {
    if (!isAuthenticated || !token || !threadId) return;
    if (!background) setLoadingMessages(true);
    try {
      const res = await axios.get(`${API_URL}/threads/${threadId}/messages`, {
        headers: authHeaders(),
      });
      // Convert backend format to chat format
      const msgs = (res.data || []).map(m => ({
        _id: m.id,
        role: m.role,
        text: m.content,
        sources: m.sources || [],
        confidence: m.confidence || "medium",
        _settled: true,
        _fromDB: true,
      }));
      setMessages(msgs);
      setMessagesCache(prev => ({ ...prev, [threadId]: msgs }));
    } catch (e) {
      console.warn("[workspace] failed to load messages:", e);
    }
    if (!background) setLoadingMessages(false);
  }, [isAuthenticated, token, authHeaders]);

  // ── Select a repository ─────────────────────────────────────────────────────
  const selectRepo = useCallback(async (repoUrl) => {
    setCurrentRepoUrl(repoUrl);
    setCurrentThreadId(null);
    setMessages([]);
    await refreshThreads(true);
  }, [refreshThreads]);

  // ── Select a thread ─────────────────────────────────────────────────────────
  const selectThread = useCallback(async (thread) => {
    if (currentThreadId === thread.id) return;
    setCurrentThreadId(thread.id);
    
    // Optimistic UI using cache
    if (messagesCache[thread.id]) {
      setMessages(messagesCache[thread.id]);
      refreshMessages(thread.id, true); // non-blocking background sync
    } else {
      setMessages([]);
      refreshMessages(thread.id, false); // non-blocking fetch
    }
  }, [currentThreadId, refreshMessages, messagesCache]);

  // ── Create new thread ────────────────────────────────────────────────────────
  const createThread = useCallback(async (repoUrl, title = "New Conversation") => {
    if (!isAuthenticated || !token) return null;
    try {
      const res = await axios.post(`${API_URL}/threads`,
        { repo_url: repoUrl, title },
        { headers: authHeaders() }
      );
      const thread = res.data;
      setThreads(prev => [thread, ...prev]);
      return thread;
    } catch (e) {
      console.warn("[workspace] createThread failed:", e);
      return null;
    }
  }, [isAuthenticated, token, authHeaders]);

  // ── Rename thread ────────────────────────────────────────────────────────────
  const renameThread = useCallback(async (threadId, title) => {
    if (!token) return;
    try {
      await axios.patch(`${API_URL}/threads/${threadId}`,
        { title },
        { headers: authHeaders() }
      );
      setThreads(prev => prev.map(t => t.id === threadId ? { ...t, title } : t));
    } catch (e) {
      console.warn("[workspace] renameThread failed:", e);
    }
  }, [token, authHeaders]);

  // ── Delete thread ─────────────────────────────────────────────────────────────
  const deleteThread = useCallback(async (threadId) => {
    if (!token) return;
    try {
      await axios.delete(`${API_URL}/threads/${threadId}`, { headers: authHeaders() });
      setThreads(prev => {
        const next = prev.filter(t => t.id !== threadId);
        return next;
      });
      if (currentThreadId === threadId) {
        setCurrentThreadId(null);
        setMessages([]);
      }
    } catch (e) {
      console.warn("[workspace] deleteThread failed:", e);
    }
  }, [token, authHeaders, currentThreadId]);

  // ── Called after analysis completes (to register repo + initial thread) ──────
  const onAnalysisComplete = useCallback(async (repoUrl, initialThreadId) => {
    if (!isAuthenticated) return;
    await refreshRepositories();
    await refreshThreads(true);
    setCurrentRepoUrl(repoUrl);
    if (initialThreadId) {
      setCurrentThreadId(initialThreadId);
      // No messages yet for a fresh analysis
      setMessages([]);
    }
  }, [isAuthenticated, refreshRepositories, refreshThreads]);

  // ── Update messages optimistically (when user sends a chat message) ──────────
  const addOptimisticMessage = useCallback((role, text, id) => {
    setMessages(prev => {
      const next = [...prev, { _id: id || Date.now(), role, text, sources: [], confidence: "medium" }];
      if (currentThreadId) {
        setMessagesCache(c => ({ ...c, [currentThreadId]: next }));
      }
      return next;
    });
  }, [currentThreadId]);

  const updateMessage = useCallback((id, updates) => {
    setMessages(prev => {
      const next = prev.map(m => m._id === id ? { ...m, ...updates } : m);
      if (currentThreadId) {
        setMessagesCache(c => ({ ...c, [currentThreadId]: next }));
      }
      return next;
    });
  }, [currentThreadId]);

  return {
    // State
    repositories,
    threads,
    messages,
    currentRepoUrl,
    currentThreadId,
    loadingRepos,
    loadingThreads,
    loadingMessages,

    // Actions
    selectRepo,
    selectThread,
    createThread,
    renameThread,
    deleteThread,
    refreshRepositories,
    refreshThreads,
    refreshMessages,
    onAnalysisComplete,
    setCurrentRepoUrl,
    setCurrentThreadId,
    setMessages,
    addOptimisticMessage,
    updateMessage,
  };
}
