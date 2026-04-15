import { useState, useRef, useEffect, useCallback } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import "./index.css";

// ─── Shared Footer ─────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="border-t border-white/20 py-16 px-8 bg-stone-100/50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10">
        <div className="flex flex-col md:flex-row items-center gap-10">
          <span className="font-extrabold text-primary font-headline text-xl tracking-tighter">RExplain</span>
          <span className="text-stone-400 font-body text-sm font-light tracking-wide">© 2024 RExplain. Built for clarity.</span>
        </div>
        <div className="flex gap-10">
          {["Github", "Privacy", "Terms", "Status"].map(l => (
            <a key={l} className="text-stone-400 font-headline font-semibold text-[11px] uppercase tracking-widest hover:text-primary transition-colors" href="#">{l}</a>
          ))}
        </div>
      </div>
    </footer>
  );
}

// ─── HTTP Method badge colors ───────────────────────────────────────────────
function methodBg(method) {
  const bg = { GET: "#dcfce7", POST: "#dbeafe", PUT: "#ffedd5", PATCH: "#ede9fe", DELETE: "#fee2e2", HEAD: "#f3f4f6", OPTIONS: "#f3f4f6" };
  const c  = { GET: "#166534", POST: "#1e40af", PUT: "#9a3412", PATCH: "#5b21b6", DELETE: "#991b1b", HEAD: "#374151", OPTIONS: "#374151" };
  return { bg: bg[method] || "#f3f4f6", color: c[method] || "#374151" };
}

// ─── Landing Page ──────────────────────────────────────────────────────────
function LandingPage({ repoUrl, setRepoUrl, onAnalyze, loading, error }) {
  const handleKey = (e) => { if (e.key === "Enter") onAnalyze(); };
  return (
    <>
      <nav className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-8 md:px-12 py-6 glass-card border-none">
        <div className="text-xl font-extrabold tracking-tighter text-primary font-headline pb-1">RExplain</div>
        <div className="hidden md:flex items-center space-x-10 font-headline font-semibold text-sm tracking-tight">
          <a className="text-stone-400 hover:text-primary transition-colors" href="#">Explore</a>
          <a className="text-stone-400 hover:text-primary transition-colors" href="#">Docs</a>
          <a className="text-stone-400 hover:text-primary transition-colors" href="#">Pricing</a>
        </div>
        <button className="text-primary font-bold text-xs px-5 py-2 hover:opacity-60 transition-opacity font-headline uppercase tracking-widest">Sign In</button>
      </nav>

      <main className="min-h-screen pt-48 pb-32 px-6 flex flex-col items-center"
        style={{ background: "#f3f3f1", backgroundImage: "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.4) 0%, transparent 100%)" }}>

        <div className="w-12 h-[1px] bg-black/20 mb-16" style={{ animation: "fadeInTitle 2s ease-out 0.8s forwards", opacity: 0 }} />

        <div className="max-w-4xl w-full text-center mb-24">
          <h1 className="liquid-glass-text font-headline font-extrabold tracking-tighter mb-8 leading-tight pb-4"
            style={{ fontSize: "clamp(4rem, 12vw, 9rem)" }}>
            RExplain
          </h1>
          <p className="hero-sub font-body text-secondary text-lg md:text-2xl tracking-tight font-light max-w-xl mx-auto leading-relaxed">
            Unfold the complexity of any GitHub repository with clarity and intent.
          </p>
        </div>

        <div className="w-full max-w-2xl relative group mb-24 search-container">
          <div className="absolute inset-0 bg-white/40 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none" />
          <div className="relative glass-card rounded-2xl p-3 flex items-center gap-2">
            <div className="pl-5 flex items-center text-stone-300">
              <span className="material-symbols-outlined" style={{ fontSize: 22 }}>link</span>
            </div>
            <input
              id="repo-url-input"
              type="text"
              placeholder="paste-github-repo-url-here"
              value={repoUrl}
              onChange={e => setRepoUrl(e.target.value)}
              onKeyDown={handleKey}
              disabled={loading}
              className="search-input flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-primary font-body text-lg placeholder:text-stone-300 placeholder:font-light py-5"
              style={{ fontFamily: "Inter, sans-serif" }}
            />
            <button id="analyze-btn" onClick={onAnalyze} disabled={loading || !repoUrl.trim()}
              className="bg-primary hover:bg-black text-white font-headline font-bold px-8 md:px-10 py-5 rounded-xl transition-all duration-500 ease-out flex items-center gap-3 text-xs uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed">
              Analyze
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_forward</span>
            </button>
          </div>
          <div className="mt-10 flex justify-center gap-12 items-center text-[11px] font-headline font-bold uppercase tracking-[0.3em] text-stone-400">
            {["Zero Install", "Markdown", "AI Logic"].map(h => (
              <div key={h} className="flex items-center gap-3">
                <span className="w-1 h-1 bg-stone-300 rounded-full" />
                <span>{h}</span>
              </div>
            ))}
          </div>
          {error && (
            <div className="mt-6 glass-card rounded-xl p-4 text-red-700 text-sm font-body border border-red-200">
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* Bento */}
        <div className="max-w-6xl w-full grid grid-cols-1 md:grid-cols-12 gap-8 px-4 mb-32">
          <div className="md:col-span-7 glass-card rounded-3xl p-12 flex flex-col justify-between overflow-hidden relative group">
            <div className="relative z-10">
              <span className="text-[11px] font-headline font-bold uppercase tracking-[0.25em] text-stone-400 mb-6 block">The Process</span>
              <h3 className="font-headline text-4xl font-extrabold text-primary mb-6 leading-tight tracking-tight">Instant Architecture<br />Mapping</h3>
              <p className="font-body text-stone-500 text-lg font-light leading-relaxed max-w-sm">We traverse your repository's dependency graph to visualize how components interact, saving hours of manual audit.</p>
            </div>
            <div className="mt-16 rounded-2xl overflow-hidden translate-y-6 group-hover:translate-y-2 transition-transform duration-700 ease-out border border-white/20" style={{ boxShadow: "0 20px 40px rgba(0,0,0,0.04)" }}>
              <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuANIUqkQKetZNqCvI31fkSSD4lQdFAmcu8sn6ZXPDectSxl--1dcR0eKgRsT6lUZkPuYbSXMHqC5CKgmm2oF2SarZWja038lDMSytaTrXN3QxdXJ1mn_00on3JyLMCIf42Ue46SkTRrKV03HeV_VivCBznNORm8_yPBAQ5RoSdns3LnK4ZulsgLqerjraBSDsUHjkhTyp08RtFDezrKwiRvis3ELhaJajrSU__Gr3Ww_Xg0NSePUQSVGJrfYFUm4SRPSW29qVWAVCc"
                alt="Architecture visualization" className="w-full h-64 object-cover grayscale opacity-90 contrast-125" />
            </div>
          </div>
          <div className="md:col-span-5 glass-card rounded-3xl p-12 flex flex-col">
            <div className="flex-1">
              <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mb-10 shadow-lg">
                <span className="material-symbols-outlined text-white text-3xl">auto_awesome</span>
              </div>
              <h3 className="font-headline text-4xl font-extrabold text-primary mb-6 tracking-tight">Deep Semantics</h3>
              <p className="font-body text-stone-500 text-lg font-light leading-relaxed">Go beyond syntax. Understand the "why" behind the code structures and design patterns used in the project.</p>
            </div>
            <div className="mt-12 flex flex-wrap gap-3">
              {["React", "TypeScript", "Rust", "Python", "Go"].map(tag => (
                <span key={tag} className="px-4 py-2 bg-white/40 text-[10px] font-headline font-bold uppercase tracking-widest rounded-lg border border-white/20">{tag}</span>
              ))}
            </div>
          </div>
        </div>

        <section className="max-w-4xl w-full mb-24 px-8">
          <div className="glass-card p-16 rounded-3xl text-center relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-black/5 group-hover:bg-black/10 transition-colors duration-700" />
            <blockquote className="font-headline text-3xl font-medium text-primary leading-snug tracking-tight mb-10 italic">
              "The most efficient way to onboard new engineers to a complex legacy codebase I've ever seen. It turned a week-long process into minutes."
            </blockquote>
            <cite className="block font-headline text-[12px] font-extrabold uppercase tracking-[0.4em] text-stone-400 not-italic">
              — Lead Architect, Modern Systems
            </cite>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

// ─── Loading State ──────────────────────────────────────────────────────────
function LoadingState({ repoUrl }) {
  const repoName = repoUrl ? repoUrl.split("/").slice(-2).join("/") : "repository";
  return (
    <>
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-8 py-6 bg-white/40 backdrop-blur-xl border-b border-stone-200/30">
        <div className="flex items-center gap-12">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.3)", backdropFilter: "blur(12px)" }}>
              <div className="w-1.5 h-1.5 bg-stone-950 rounded-full" />
            </div>
            <span className="text-lg font-semibold tracking-tight text-stone-950 font-headline py-1">RExplain</span>
          </div>
          <nav className="hidden md:flex gap-8">
            {["Explore", "Docs", "Pricing"].map(l => (
              <a key={l} className="text-[13px] text-stone-500 hover:text-stone-950 transition-colors font-medium tracking-tight" href="#">{l}</a>
            ))}
          </nav>
        </div>
        <button className="text-stone-950 font-medium tracking-tight text-[13px] hover:opacity-60 transition-opacity">Sign In</button>
      </header>

      <main className="min-h-screen flex flex-col items-center justify-center px-6"
        style={{ background: "#fafaf9", backgroundImage: "radial-gradient(circle at center, rgba(0,0,0,0.02) 0%, transparent 100%)" }}>
        <div className="w-full max-w-sm flex flex-col items-center">
          <div className="text-center space-y-6 mb-12">
            <div className="flex flex-col items-center gap-8">
              <div className="relative w-12 h-12 flex items-center justify-center">
                <div className="absolute inset-0 bg-stone-200 rounded-full" style={{ animation: "liquidPulse 4s cubic-bezier(0.4,0,0.2,1) infinite" }} />
                <div className="absolute inset-0 border-[0.5px] border-stone-200 rounded-full" style={{ animation: "spin 8s linear infinite" }} />
                <div className="relative w-1.5 h-1.5 bg-stone-950 rounded-full" />
              </div>
              <div className="space-y-2">
                <h1 className="font-headline text-xl font-medium tracking-tight text-stone-900" style={{ animation: "breathing 3s ease-in-out infinite" }}>
                  Analyzing repository
                </h1>
                <p className="font-body text-stone-400 text-[13px] tracking-tight max-w-[240px] mx-auto leading-relaxed opacity-60">
                  Mapping structural architecture and functional logic pathways.
                </p>
              </div>
            </div>
          </div>
          <div className="w-48 h-[1px] bg-stone-100 overflow-hidden relative">
            <div className="absolute inset-0 w-1/3 h-full bg-stone-300" style={{ animation: "shimmer 2.5s cubic-bezier(0.4,0,0.2,1) infinite" }} />
          </div>
          <div className="mt-20 grid grid-cols-2 gap-[1px] bg-stone-100 border border-stone-100 w-full">
            <div className="p-6 bg-white/50 backdrop-blur-sm flex flex-col gap-1.5">
              <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-stone-400">Repository</span>
              <span className="text-[12px] font-body truncate text-stone-600">{repoName}</span>
            </div>
            <div className="p-6 bg-white/50 backdrop-blur-sm flex flex-col gap-1.5">
              <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-stone-400">Source</span>
              <span className="text-[12px] font-body tabular-nums text-stone-600">rexplain-v1</span>
            </div>
          </div>
        </div>
        <div className="fixed bottom-12 right-12 pointer-events-none opacity-[0.03]">
          <span className="material-symbols-outlined" style={{ fontSize: "15rem" }}>architecture</span>
        </div>
      </main>

      <footer className="border-t border-stone-100">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8 py-10 px-8">
          <div className="flex flex-col gap-1">
            <span className="text-[13px] font-semibold text-stone-950 font-headline tracking-tight py-1">RExplain</span>
            <p className="font-body text-[11px] tracking-tight text-stone-400 italic">Built for clarity.</p>
          </div>
          <div className="flex gap-10">
            {["Github", "Privacy", "Terms", "Status"].map(l => (
              <a key={l} className="font-body text-[12px] tracking-tight text-stone-400 hover:text-stone-950 transition-colors" href="#">{l}</a>
            ))}
          </div>
        </div>
      </footer>
    </>
  );
}

// ─── Chat Sidebar ───────────────────────────────────────────────────────────
function ChatSidebar({ repoUrl, ragReady }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState("");
  const [asking, setAsking]     = useState(false);
  const bottomRef               = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const ask = async () => {
    const q = input.trim();
    if (!q || asking) return;
    setMessages(prev => [...prev, { role: "user", text: q }]);
    setInput("");
    setAsking(true);
    try {
      const res = await axios.post("http://127.0.0.1:8000/chat/", { repo_url: repoUrl, question: q });
      setMessages(prev => [...prev, { role: "assistant", text: res.data.answer, sources: res.data.sources || [] }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "error", text: err?.response?.data?.detail || "Something went wrong." }]);
    } finally {
      setAsking(false);
    }
  };

  const handleKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "rgba(255,255,255,0.6)", backdropFilter: "blur(20px)" }}>

      {/* Header */}
      <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid rgba(0,0,0,0.06)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: "#111" }}>chat</span>
          <span className="font-headline font-bold text-xs uppercase tracking-widest" style={{ color: "#111" }}>Repository Chat</span>
        </div>
        <p style={{ fontSize: 11, color: ragReady ? "#22c55e" : "#aaa", fontFamily: "Inter, sans-serif", display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: ragReady ? "#22c55e" : "#ddd", display: "inline-block", flexShrink: 0 }} />
          {ragReady ? "RAG index ready" : "Analyze a repo to enable chat"}
        </p>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 14, opacity: 0.45 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 32, color: "#ccc" }}>auto_awesome</span>
            <p style={{ fontSize: 12, color: "#aaa", textAlign: "center", lineHeight: 1.65, maxWidth: 180, fontFamily: "Inter, sans-serif" }}>
              Ask about files, functions, frameworks, or the architecture of this repo.
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "88%", padding: "9px 13px",
              borderRadius: msg.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
              background: msg.role === "user" ? "#111" : msg.role === "error" ? "#fee2e2" : "rgba(0,0,0,0.05)",
              color: msg.role === "user" ? "#fff" : msg.role === "error" ? "#991b1b" : "#1a1c1b",
              fontSize: 13, lineHeight: 1.6, fontFamily: "Inter, sans-serif", whiteSpace: "pre-wrap",
            }}>
              {msg.text}
              {msg.sources?.length > 0 && (
                <div style={{ marginTop: 7, display: "flex", flexWrap: "wrap", gap: 3 }}>
                  {msg.sources.map((src, si) => (
                    <span key={si} style={{
                      fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
                      padding: "2px 6px", borderRadius: 3,
                      background: "rgba(255,255,255,0.55)", border: "1px solid rgba(0,0,0,0.09)", color: "#585f6c",
                      fontFamily: "Inter, sans-serif",
                    }}>
                      {src.split("/").pop()}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {asking && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{ padding: "9px 13px", borderRadius: "12px 12px 12px 2px", background: "rgba(0,0,0,0.05)", display: "flex", gap: 4, alignItems: "center" }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "#bbb", animation: "breathing 1.2s ease-in-out infinite", animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)", padding: "10px 12px", flexShrink: 0, display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.75)" }}>
        <input
          type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
          disabled={asking || !ragReady}
          placeholder={ragReady ? "Ask a question…" : "Run an analysis first…"}
          style={{ flex: 1, border: "none", outline: "none", background: "rgba(0,0,0,0.04)", borderRadius: 8, padding: "9px 12px", fontFamily: "Inter, sans-serif", fontSize: 13, color: "#111" }}
        />
        <button onClick={ask} disabled={asking || !input.trim() || !ragReady}
          style={{
            background: asking || !input.trim() || !ragReady ? "#e5e5e5" : "#111",
            color: asking || !input.trim() || !ragReady ? "#999" : "#fff",
            border: "none", borderRadius: 8, padding: "9px 14px",
            cursor: asking || !input.trim() || !ragReady ? "not-allowed" : "pointer",
            transition: "all 0.2s", display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
          }}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>send</span>
        </button>
      </div>
    </div>
  );
}

// ─── Analysis View — Split Screen ───────────────────────────────────────────
const NAV_H = 72;

function AnalysisView({ result, repoUrl, onReset }) {
  const fw   = result.framework_detection || {};
  const scan = result.scan_results || {};
  const langs = Object.entries(scan.languages || {}).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const repoName = repoUrl.replace("https://github.com/", "");
  const stackItems = [
    { label: "Backend",  value: fw.backend_framework,  icon: "terminal" },
    { label: "Frontend", value: fw.frontend_framework, icon: "web_asset" },
    { label: "Database", value: fw.database,           icon: "database"  },
  ];

  // ── Resizable split ────────────────────────────────────────────────────────
  const [splitPct, setSplitPct] = useState(38);
  const dragging    = useRef(false);
  const containerRef = useRef(null);

  const onDividerDown = useCallback((e) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor    = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct  = ((e.clientX - rect.left) / rect.width) * 100;
      setSplitPct(Math.min(65, Math.max(25, pct)));
    };
    const onUp = () => {
      dragging.current = false;
      document.body.style.cursor    = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  return (
    <>
      {/* Fixed Nav */}
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-8 border-b border-stone-200/40 backdrop-blur-xl"
        style={{ background: "rgba(249,249,247,0.88)", height: NAV_H }}>
        <div className="flex items-center gap-8">
          <div className="logo-glass flex items-center">
            <span className="text-xl font-bold tracking-tighter text-stone-950 font-headline pb-1">RExplain</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 font-headline text-sm tracking-tight font-medium">
            <button onClick={onReset} className="text-stone-500 hover:text-stone-950 transition-colors">← New Analysis</button>
            <a className="text-stone-500 hover:text-stone-950 transition-colors" href="#">Docs</a>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden md:block text-[10px] font-headline font-bold uppercase tracking-widest text-stone-400">{repoName}</span>
          <button onClick={onReset} className="px-4 py-2 text-xs font-bold uppercase tracking-widest hover:opacity-70 transition-opacity text-stone-950 font-headline border border-stone-200 rounded-lg">
            New →
          </button>
        </div>
      </header>

      {/* ── Split container ───────────────────────────────────────────────── */}
      <div ref={containerRef} style={{ display: "flex", height: `calc(100vh - ${NAV_H}px)`, marginTop: NAV_H, background: "#f9f9f7", overflow: "hidden" }}>

        {/* LEFT — Chat sidebar */}
        <div style={{ width: `${splitPct}%`, flexShrink: 0, borderRight: "1px solid rgba(0,0,0,0.07)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <ChatSidebar repoUrl={repoUrl} ragReady={result.rag_ready} />
        </div>

        {/* DIVIDER */}
        <div
          onMouseDown={onDividerDown}
          style={{ width: 6, flexShrink: 0, cursor: "col-resize", position: "relative", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10, transition: "background 0.15s" }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.06)"}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
        >
          <div style={{ width: 3, height: 36, borderRadius: 99, background: "rgba(0,0,0,0.14)", pointerEvents: "none" }} />
        </div>

        {/* RIGHT — Repository content */}
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "44px 44px 80px" }}>

          {/* Hero */}
          <section style={{ marginBottom: 56 }} className="reveal-up reveal-hidden">
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ width: 36, height: 1, background: "#111" }} />
              <span className="text-[10px] uppercase tracking-[0.4em] font-bold text-stone-400">System Insight</span>
            </div>
            <h1 className="font-headline font-bold tracking-tight leading-[0.9] text-primary"
              style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)", marginBottom: 14 }}>
              Repository<br />Analysis
            </h1>
            <p className="text-stone-500 font-body text-base leading-relaxed font-light">
              <span className="text-primary font-medium border-b border-black/20">{repoName}</span>
              {" "}— analyzed in <span className="font-medium">{result._elapsed || "~5"}s</span>.
            </p>
          </section>

          {/* Stats */}
          <section style={{ marginBottom: 40 }} className="reveal-up reveal-hidden delay-1">
            <div className="glass-card glass-card-hover p-7 flex flex-col gap-6 shadow-sm">
              <div>
                <span className="block text-[10px] uppercase tracking-[0.3em] text-stone-400 font-bold mb-1">Comprehensive Scan</span>
                <h2 className="font-headline font-bold tracking-tight" style={{ fontSize: "clamp(1.6rem, 3vw, 2.5rem)" }}>
                  {scan.total_files?.toLocaleString()}{" "}
                  <span className="text-xl font-light text-stone-400">files</span>
                </h2>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {langs.map(([ext, count]) => (
                  <span key={ext} className="px-4 py-1.5 bg-white/40 border border-white/60 text-stone-600 text-[10px] font-bold tracking-[0.1em] uppercase">
                    {ext} ({count})
                  </span>
                ))}
              </div>
            </div>
          </section>

          {/* Tech Stack */}
          <section style={{ marginBottom: 44 }} className="reveal-up reveal-hidden delay-2">
            <SectionHeader label="Detected Ecosystem" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
              {stackItems.map(({ label, value, icon }) => {
                const missing = !value;
                return (
                  <div key={label}
                    className={`glass-card p-6 flex flex-col justify-between stack-card transition-all duration-500 ${missing ? "opacity-50 grayscale hover:grayscale-0" : "glass-card-hover"}`}
                    style={{ minHeight: 130 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">{label}</span>
                      <span className="material-symbols-outlined text-stone-300" style={{ fontSize: 16 }}>{icon}</span>
                    </div>
                    <div>
                      {missing
                        ? <span className="text-base font-headline font-light italic text-stone-400">Not detected</span>
                        : <><span className="text-xl font-headline font-bold tracking-tight">{value}</span><div className="stack-underline" /></>
                      }
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* AI Explanation */}
          <section style={{ marginBottom: 44 }} className="reveal-up reveal-hidden delay-3">
            <SectionHeader label="AI Interpretation" />
            <div className="glass-card p-7">
              <p className="text-base font-body leading-[1.75] text-primary mb-5 font-light">{result.ai_explanation}</p>
              {result.folder_explanations && Object.keys(result.folder_explanations).length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 14 }}>
                  {Object.entries(result.folder_explanations).slice(0, 4).map(([folder, desc]) => {
                    const [label] = desc.split(" — ");
                    return (
                      <div key={folder} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                        <code className="text-[10px] font-bold uppercase tracking-widest bg-stone-100 px-2 py-1 text-stone-600">/{folder}</code>
                        <span className="text-stone-500 font-light">{label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 8, borderTop: "1px solid rgba(0,0,0,0.05)", paddingTop: 14 }}>
                <span className="material-symbols-outlined text-stone-400" style={{ fontSize: 15 }}>verified</span>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Static Analysis • Pattern Detection</span>
              </div>
            </div>
          </section>

          {/* Architecture Diagram */}
          {result.diagram && (
            <section style={{ marginBottom: 44 }} className="reveal-up reveal-hidden delay-4">
              <SectionHeader label="System Topology" />
              <div className="glass-card p-8 flex items-center justify-center bg-stone-50/40">
                <img src={result.diagram} alt="Architecture Diagram"
                  style={{ maxWidth: "100%", maxHeight: 280, objectFit: "contain", filter: "invert(1) hue-rotate(180deg) brightness(0.9)" }} />
              </div>
            </section>
          )}

          {/* API Routes */}
          {result.api_routes?.length > 0 && (
            <section style={{ marginBottom: 44 }} className="reveal-up reveal-hidden delay-4">
              <SectionHeader label="API Surface" extra={`${result.api_routes.length} routes`} />
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {result.api_routes.slice(0, 12).map((route, i) => {
                  const [method, ...rest] = route.split(" ");
                  const { bg, color } = methodBg(method);
                  return (
                    <div key={i} className="glass-card glass-card-hover p-4 flex items-center gap-4 cursor-default">
                      <span className="text-[9px] font-headline font-bold uppercase tracking-widest px-3 py-1 rounded"
                        style={{ background: bg, color, minWidth: 48, textAlign: "center" }}>{method}</span>
                      <code className="text-sm text-stone-700 font-mono">{rest.join(" ")}</code>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Key Files */}
          {result.important_files?.length > 0 && (
            <section style={{ marginBottom: 44 }} className="reveal-up reveal-hidden delay-5">
              <SectionHeader label="Core Entry Points" />
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {result.important_files.slice(0, 6).map((file, i) => {
                  const name = file.split("/").pop();
                  const icon = name.includes("Dockerfile") ? "deployed_code"
                    : file.startsWith(".github") ? "hub"
                    : name.endsWith(".json") ? "data_object"
                    : name.endsWith(".py") ? "terminal" : "description";
                  return (
                    <div key={i} className="group glass-card p-5 flex justify-between items-center cursor-pointer key-file-row">
                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <div className="w-9 h-9 flex items-center justify-center bg-stone-100 key-file-icon">
                          <span className="material-symbols-outlined text-stone-400" style={{ fontSize: 17 }}>{icon}</span>
                        </div>
                        <div>
                          <div className="text-sm font-bold font-headline tracking-tight key-file-name">{name}</div>
                          <div className="text-[10px] text-stone-400 font-medium uppercase tracking-wider mt-0.5">{file}</div>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-stone-300 key-file-arrow" style={{ fontSize: 16 }}>arrow_forward</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* README */}
          {result.readme && (
            <section style={{ marginBottom: 40 }} className="reveal-up reveal-hidden delay-6">
              <SectionHeader label="Documentation" extra="README.MD" />
              <div className="glass-card p-8">
                <div className="readme-prose">
                  <ReactMarkdown>{result.readme}</ReactMarkdown>
                </div>
              </div>
            </section>
          )}

        </div>{/* end right */}
      </div>{/* end split */}
    </>
  );
}

// ─── Section header helper ──────────────────────────────────────────────────
function SectionHeader({ label, extra }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
      <h3 className="text-[10px] uppercase tracking-[0.3em] text-stone-400 font-bold whitespace-nowrap">{label}</h3>
      <div style={{ height: 1, background: "#e7e5e4", flex: 1 }} />
      {extra && <span className="text-[9px] text-stone-400 whitespace-nowrap font-bold uppercase tracking-widest">{extra}</span>}
    </div>
  );
}

// ─── App Root ───────────────────────────────────────────────────────────────
export default function App() {
  const [repoUrl, setRepoUrl] = useState("");
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const analyze = async () => {
    if (!repoUrl.trim()) return;
    setLoading(true); setError(null); setResult(null);
    const t0 = Date.now();
    try {
      const res = await axios.post("http://127.0.0.1:8000/analyze/", { repo_url: repoUrl.trim() });
      setResult({ ...res.data, _elapsed: ((Date.now() - t0) / 1000).toFixed(1) });
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || "Failed to analyze repository.");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { setResult(null); setError(null); };

  if (loading) return <LoadingState repoUrl={repoUrl} />;
  if (result)  return <AnalysisView result={result} repoUrl={repoUrl} onReset={reset} />;
  return <LandingPage repoUrl={repoUrl} setRepoUrl={setRepoUrl} onAnalyze={analyze} loading={loading} error={error} />;
}