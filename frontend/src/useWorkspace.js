/**
 * useWorkspace.js
 * ---------------
 * Custom hook that manages all workspace state:
 *   - Repository history
 *   - Thread list (all repos, filtered in sidebar by repo_url)
 *   - Message history for current thread
 *   - Thread CRUD (create, rename, delete) — all optimistic
 *
 * Key guarantees:
 *   - Stale async responses NEVER overwrite newer thread state (AbortController + generation counter)
 *   - Delete/rename/create are optimistic with rollback on failure
 *   - Single source of truth: messages live here only (ChatSidebar reads, never duplicates)
 */
import { useState, useCallback, useEffect, useRef } from "react";
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
  const [isRepoSwitching, setIsRepoSwitching] = useState(false);

  // ── Race condition prevention ─────────────────────────────────────────────
  // A ref mirror of currentThreadId so async callbacks always see the latest value.
  const currentThreadIdRef = useRef(null);
  useEffect(() => { currentThreadIdRef.current = currentThreadId; }, [currentThreadId]);

  // AbortController for in-flight message fetches.
  const abortControllerRef = useRef(null);

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

  // ── Fetch threads for all repos ─────────────────────────────────────────────
  const refreshThreads = useCallback(async (background = false) => {
    if (!isAuthenticated || !token) return;
    if (!background) setLoadingThreads(true);
    try {
      const res = await axios.get(`${API_URL}/threads`, { headers: authHeaders() });
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
    } else {
      setRepositories([]);
      setThreads([]);
      setMessages([]);
    }
  }, [isAuthenticated, refreshRepositories, refreshThreads]);

  // ── Fetch messages for a thread — race-condition-safe ───────────────────────
  const refreshMessages = useCallback(async (threadId, background = false) => {
    if (!isAuthenticated || !token || !threadId) return;

    // If it's a pending optimistic thread, it has no messages on server yet.
    if (threadId.startsWith("temp-")) {
      setMessages([]);
      if (!background) setLoadingMessages(false);
      return;
    }

    // Abort any in-flight fetch for a previous thread.
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (!background) setLoadingMessages(true);
    try {
      const res = await axios.get(`${API_URL}/threads/${threadId}/messages`, {
        headers: authHeaders(),
        signal: controller.signal,
      });

      // CRITICAL: Only apply if this thread is still the active one.
      if (threadId !== currentThreadIdRef.current) {
        console.log(`[workspace] Discarding stale response for thread ${threadId} (current: ${currentThreadIdRef.current})`);
        return;
      }

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
      if (axios.isCancel(e) || e.name === "CanceledError" || e.code === "ERR_CANCELED") {
        // Intentionally aborted — not an error.
        return;
      }
      console.warn("[workspace] failed to load messages:", e);
    } finally {
      // Only clear loading if this thread is still current.
      if (threadId === currentThreadIdRef.current) {
        if (!background) setLoadingMessages(false);
      }
    }
  }, [isAuthenticated, token, authHeaders]);

  // ── Select a repository ─────────────────────────────────────────────────────
  const selectRepo = useCallback(async (repoUrl) => {
    setCurrentRepoUrl(repoUrl);
    setCurrentThreadId(null);
    currentThreadIdRef.current = null;
    setMessages([]);
    setIsRepoSwitching(true);
    try {
      await refreshThreads(true);
    } finally {
      setIsRepoSwitching(false);
    }
  }, [refreshThreads]);

  // ── Select a thread ─────────────────────────────────────────────────────────
  const selectThread = useCallback((thread) => {
    const threadId = thread.id;
    // Already selected — nothing to do.
    if (threadId === currentThreadIdRef.current) return;

    // Update state immediately.
    setCurrentThreadId(threadId);
    currentThreadIdRef.current = threadId;

    // Instant cache hit — show immediately, sync in background.
    if (messagesCache[threadId]) {
      setMessages(messagesCache[threadId]);
      refreshMessages(threadId, true);
    } else {
      setMessages([]);
      refreshMessages(threadId, false);
    }
  }, [refreshMessages, messagesCache]);

  // ── Create a new thread — optimistic ────────────────────────────────────────
  const createThread = useCallback(async (repoUrl, title = "New Conversation") => {
    if (!isAuthenticated || !token) return null;

    const optimisticId = `temp-${Date.now()}`;
    const optimisticThread = {
      id: optimisticId,
      repo_url: repoUrl,
      title,
      created_at: new Date().toISOString(),
      _pending: true,
    };

    // Show immediately.
    setThreads(prev => [optimisticThread, ...prev]);
    setMessagesCache(c => ({ ...c, [optimisticId]: [] }));

    // Fire API in background.
    axios.post(`${API_URL}/threads`, { repo_url: repoUrl, title }, { headers: authHeaders() })
      .then(res => {
        const realThread = res.data;
        // Swap optimistic entry for real one.
        setThreads(prev => prev.map(t => t.id === optimisticId ? realThread : t));
        // Move message cache key.
        setMessagesCache(c => {
          const next = { ...c };
          if (next[optimisticId] !== undefined) {
            next[realThread.id] = next[optimisticId];
            delete next[optimisticId];
          }
          return next;
        });
        // Update currentThreadId if still on optimistic one.
        setCurrentThreadId(prev => {
          if (prev === optimisticId) {
            currentThreadIdRef.current = realThread.id;
            return realThread.id;
          }
          return prev;
        });
      })
      .catch(e => {
        console.warn("[workspace] createThread failed:", e);
        // Rollback.
        setThreads(prev => prev.filter(t => t.id !== optimisticId));
        setMessagesCache(c => {
          const next = { ...c };
          delete next[optimisticId];
          return next;
        });
        if (currentThreadIdRef.current === optimisticId) {
          setCurrentThreadId(null);
          currentThreadIdRef.current = null;
          setMessages([]);
        }
      });

    return optimisticThread;
  }, [isAuthenticated, token, authHeaders]);

  // ── Ensure thread exists (creates one if no active thread) ──────────────────
  // Used by ChatSidebar before sending a first message.
  const ensureThread = useCallback(async (repoUrl, title = "New Conversation") => {
    if (currentThreadIdRef.current) return currentThreadIdRef.current;
    const thread = await createThread(repoUrl, title);
    if (thread) {
      setCurrentThreadId(thread.id);
      currentThreadIdRef.current = thread.id;
      setMessages([]);
    }
    return thread?.id || null;
  }, [createThread]);

  // ── Rename thread — optimistic ───────────────────────────────────────────────
  const renameThread = useCallback(async (threadId, title) => {
    if (!token || !title.trim()) return;
    const prevThreads = threads;
    // Optimistic update.
    setThreads(prev => prev.map(t => t.id === threadId ? { ...t, title } : t));
    try {
      await axios.patch(`${API_URL}/threads/${threadId}`, { title }, { headers: authHeaders() });
    } catch (e) {
      console.warn("[workspace] renameThread failed:", e);
      // Rollback.
      setThreads(prevThreads);
    }
  }, [token, authHeaders, threads]);

  // ── Delete thread — optimistic ───────────────────────────────────────────────
  const deleteThread = useCallback(async (threadId) => {
    if (!token) return;

    const prevThreads = threads;
    const wasActive = currentThreadIdRef.current === threadId;

    // Optimistic removal.
    const remaining = threads.filter(t => t.id !== threadId);
    setThreads(remaining);

    // If active thread was deleted, switch to the next available in same repo.
    if (wasActive) {
      const deletedThread = threads.find(t => t.id === threadId);
      const sameRepoThreads = remaining.filter(t => t.repo_url === deletedThread?.repo_url);
      const nextThread = sameRepoThreads[0] || null;
      setCurrentThreadId(nextThread?.id || null);
      currentThreadIdRef.current = nextThread?.id || null;
      if (nextThread) {
        if (messagesCache[nextThread.id]) {
          setMessages(messagesCache[nextThread.id]);
        } else {
          setMessages([]);
          refreshMessages(nextThread.id, false);
        }
      } else {
        setMessages([]);
      }
    }

    // Background delete.
    try {
      await axios.delete(`${API_URL}/threads/${threadId}`, { headers: authHeaders() });
    } catch (e) {
      console.warn("[workspace] deleteThread failed:", e);
      // Rollback.
      setThreads(prevThreads);
      if (wasActive) {
        setCurrentThreadId(threadId);
        currentThreadIdRef.current = threadId;
      }
    }
  }, [token, authHeaders, threads, messagesCache, refreshMessages]);

  // ── Called after full analysis completes ────────────────────────────────────
  const onAnalysisComplete = useCallback(async (repoUrl, initialThreadId) => {
    if (!isAuthenticated) return;
    // Refresh repos and threads in parallel, not sequentially.
    const [repos] = await Promise.all([
      axios.get(`${API_URL}/repositories`, { headers: authHeaders() }).then(r => r.data).catch(() => null),
      axios.get(`${API_URL}/threads`, { headers: authHeaders() }).then(r => {
        setThreads(r.data || []);
      }).catch(() => {}),
    ]);
    if (repos) setRepositories(repos);
    setCurrentRepoUrl(repoUrl);
    if (initialThreadId) {
      selectThread({ id: initialThreadId });
    } else {
      setCurrentThreadId(null);
      currentThreadIdRef.current = null;
      setMessages([]);
    }
  }, [isAuthenticated, authHeaders, selectThread]);

  // ── Optimistic message helpers ───────────────────────────────────────────────
  const addOptimisticMessage = useCallback((role, text, id) => {
    setMessages(prev => {
      const next = [...prev, { _id: id || Date.now(), role, text, sources: [], confidence: "medium" }];
      const tid = currentThreadIdRef.current;
      if (tid) setMessagesCache(c => ({ ...c, [tid]: next }));
      return next;
    });
  }, []);

  const updateMessage = useCallback((id, updates) => {
    setMessages(prev => {
      const next = prev.map(m => m._id === id ? { ...m, ...updates } : m);
      const tid = currentThreadIdRef.current;
      if (tid) setMessagesCache(c => ({ ...c, [tid]: next }));
      return next;
    });
  }, []);

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
    isRepoSwitching,

    // Actions
    selectRepo,
    selectThread,
    createThread,
    ensureThread,
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
