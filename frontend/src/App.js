import { useState, useRef, useEffect, useCallback } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis } from "recharts";
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

// ─── File Preview Modal ─────────────────────────────────────────────────────
function FilePreviewModal({ repoUrl, filePath, onClose }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchFile() {
      try {
        const res = await axios.post("http://127.0.0.1:8000/files/content", { repo_url: repoUrl, file_path: filePath });
        setContent(res.data.content);
      } catch (err) {
        setError(err?.response?.data?.detail || "Failed to load file.");
      } finally {
        setLoading(false);
      }
    }
    fetchFile();
  }, [repoUrl, filePath]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }} onClick={onClose}>
      <div style={{ background: "#111", width: "100%", maxWidth: 900, maxHeight: "100%", borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 20px 40px rgba(0,0,0,0.3)" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.1)", background: "#1a1a1a" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="material-symbols-outlined text-stone-400" style={{ fontSize: 18 }}>description</span>
            <span style={{ color: "#fff", fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: 14 }}>{filePath}</span>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#aaa", cursor: "pointer", display: "flex", alignItems: "center" }}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 24, background: "#111" }}>
          {loading ? (
             <div style={{ color: "#888", fontFamily: "Inter, sans-serif", fontSize: 14 }}>Loading preview...</div>
          ) : error ? (
             <div style={{ color: "#f87171", fontFamily: "Inter, sans-serif", fontSize: 14 }}>⚠️ {error}</div>
          ) : (
             <pre style={{ margin: 0, fontFamily: "monospace", fontSize: 13, color: "#e5e5e5", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
               {content}
             </pre>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Commit Graph ────────────────────────────────────────────────────────────
function CommitGraph({ commits }) {
  if (!commits || commits.length === 0) return null;
  
  // Group by date
  const dataMap = {};
  commits.forEach(c => {
    const d = new Date(c.date).toLocaleDateString();
    dataMap[d] = (dataMap[d] || 0) + 1;
  });
  
  // Ensure chronological
  const data = Object.keys(dataMap).reverse().map(k => ({ date: k, count: dataMap[k] }));

  return (
    <div style={{ height: 200, width: "100%", marginTop: 10 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <XAxis dataKey="date" stroke="#888" fontSize={10} tickLine={false} axisLine={false} />
          <Tooltip 
            contentStyle={{ background: "#222", border: "none", borderRadius: 8, color: "#fff", fontSize: 12 }}
            itemStyle={{ color: "#4ade80" }}
          />
          <Line type="monotone" dataKey="count" stroke="#4ade80" strokeWidth={3} dot={{ r: 4, fill: "#4ade80" }} activeDot={{ r: 6 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
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

// ─── Confidence badge ────────────────────────────────────────────────────────
function ConfidenceBadge({ level }) {
  const cfg = {
    high:   { bg: "rgba(34,197,94,0.12)",  border: "rgba(34,197,94,0.35)",  color: "#15803d", label: "High confidence"   },
    medium: { bg: "rgba(234,179,8,0.12)",  border: "rgba(234,179,8,0.35)",  color: "#a16207", label: "Medium confidence" },
    low:    { bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.35)",  color: "#b91c1c", label: "Low confidence"    },
  };
  const { bg, border, color, label } = cfg[level] || cfg.medium;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em",
      padding: "2px 7px", borderRadius: 4,
      background: bg, border: `1px solid ${border}`, color,
      fontFamily: "Inter, sans-serif",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: color, display: "inline-block" }} />
      {label}
    </span>
  );
}

// ─── Source pill ─────────────────────────────────────────────────────────────
function SourcePill({ path }) {
  const [hovered, setHovered] = useState(false);
  const name = path.split("/").pop();
  return (
    <span
      title={path}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
        padding: "2px 7px", borderRadius: 4, cursor: "default",
        background: hovered ? "rgba(17,17,17,0.07)" : "rgba(255,255,255,0.55)",
        border: "1px solid rgba(0,0,0,0.09)", color: "#585f6c",
        fontFamily: "Inter, sans-serif", transition: "background 0.15s",
      }}>
      <span className="material-symbols-outlined" style={{ fontSize: 9, color: "#aaa" }}>description</span>
      {name}
    </span>
  );
}

// ─── Typing animation hook ────────────────────────────────────────────────────
function useTypewriter(fullText, speed = 14) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone]           = useState(false);
  useEffect(() => {
    setDisplayed("");
    setDone(false);
    if (!fullText) return;
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(fullText.slice(0, i));
      if (i >= fullText.length) { clearInterval(id); setDone(true); }
    }, speed);
    return () => clearInterval(id);
  }, [fullText, speed]);
  return { displayed, done };
}

// ─── Assistant message bubble ─────────────────────────────────────────────────
function AssistantBubble({ msg, isLatest }) {
  // Only animate the most recent message once streaming is done
  const animate = isLatest && !msg._settled && !msg._streaming;
  const { displayed, done } = useTypewriter(animate ? msg.text : "", 10);
  const text = animate ? displayed : msg.text;
  const showCursor = animate && !done;

  // ── While SSE is still streaming: show a clean generating skeleton ──────────
  if (msg._streaming) {
    return (
      <div style={{
        maxWidth: "88%", padding: "14px 16px",
        borderRadius: "12px 12px 12px 2px",
        background: "rgba(0,0,0,0.04)",
        border: "1px solid rgba(0,0,0,0.05)",
        fontFamily: "Inter, sans-serif",
      }}>
        {/* Pulse lines skeleton */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {["80%", "65%", "90%"].map((w, i) => (
            <div key={i} style={{
              height: 11, borderRadius: 6,
              background: `rgba(0,0,0,${0.055 - i * 0.01})`,
              width: w,
              animation: `breathing 1.6s ease-in-out ${i * 0.22}s infinite`,
            }} />
          ))}
        </div>
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 6 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 4, height: 4, borderRadius: "50%", background: "#bbb",
              animation: "breathing 1.1s ease-in-out infinite",
              animationDelay: `${i * 0.18}s`,
            }} />
          ))}
          <span style={{ fontSize: 10, color: "#bbb", letterSpacing: "0.05em", fontWeight: 600, textTransform: "uppercase" }}>Generating…</span>
        </div>
      </div>
    );
  }

  // ── Settled / typewriter state ───────────────────────────────────────────────
  const footerVisible = (done || !animate) && (msg.sources?.length > 0 || msg.confidence);

  return (
    <div style={{
      maxWidth: "88%", padding: "13px 15px",
      borderRadius: "12px 12px 12px 2px",
      background: "rgba(0,0,0,0.04)",
      border: "1px solid rgba(0,0,0,0.06)",
      fontSize: 13.5, lineHeight: 1.75, fontFamily: "Inter, sans-serif",
      color: "#1a1c1b", whiteSpace: "pre-wrap", wordBreak: "break-word",
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    }}>
      {text}
      {showCursor && (
        <span style={{
          display: "inline-block", width: 2, height: "0.9em",
          background: "#555", marginLeft: 2,
          verticalAlign: "text-bottom",
          animation: "breathing 0.7s ease-in-out infinite",
        }} />
      )}
      {footerVisible && (
        <div style={{
          marginTop: 11,
          display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center",
          borderTop: "1px solid rgba(0,0,0,0.05)", paddingTop: 9,
        }}>
          {msg.confidence && <ConfidenceBadge level={msg.confidence} />}
          {msg.sources?.map((src, si) => <SourcePill key={si} path={src} />)}
        </div>
      )}
    </div>
  );
}

// ─── Chat Sidebar ───────────────────────────────────────────────────────────
function ChatSidebar({ repoUrl, ragReady }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState("");
  const [asking, setAsking]     = useState(false);
  const [streaming, setStreaming] = useState(false);
  const bottomRef               = useRef(null);
  const esRef                   = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cleanup EventSource on unmount
  useEffect(() => () => esRef.current?.close(), []);

  const _blockingAsk = async (q, replacePlaceholderId) => {
    try {
      const res = await axios.post("http://127.0.0.1:8000/chat/", { repo_url: repoUrl, question: q });
      const newMsg = {
        role: "assistant",
        text: res.data.answer,
        sources: res.data.sources || [],
        confidence: res.data.confidence || "medium",
        _settled: false,
        _id: Date.now(),
      };
      if (replacePlaceholderId) {
        setMessages(prev => prev.map(m => m._id === replacePlaceholderId ? newMsg : m));
      } else {
        setMessages(prev => [...prev, newMsg]);
      }
    } catch (err) {
      const errMsg = {
        role: "error",
        text: err?.response?.data?.detail || "Something went wrong. Check your GROQ_API_KEY.",
        _id: Date.now(),
      };
      if (replacePlaceholderId) {
        setMessages(prev => prev.map(m => m._id === replacePlaceholderId ? errMsg : m));
      } else {
        setMessages(prev => [...prev, errMsg]);
      }
    } finally {
      setAsking(false);
      setStreaming(false);
    }
  };

  const ask = async () => {
    const q = input.trim();
    if (!q || asking) return;
    setMessages(prev => [...prev, { role: "user", text: q, _id: Date.now() }]);
    setInput("");
    setAsking(true);

    if (typeof EventSource !== "undefined" && ragReady) {
      setStreaming(true);
      const placeholderIdx = Date.now() + 1;
      setMessages(prev => [...prev, {
        role: "assistant", text: "", sources: [], confidence: "medium",
        _streaming: true, _id: placeholderIdx,
      }]);

      let accText = "";
      const streamUrl = `http://127.0.0.1:8000/chat/stream?repo_url=${encodeURIComponent(repoUrl)}&question=${encodeURIComponent(q)}`;
      const es = new EventSource(streamUrl);
      esRef.current = es;

      es.onmessage = (e) => {
        const data = e.data;
        if (data === "[DONE]") {
          es.close();
          setAsking(false);
          setStreaming(false);

          // ── Extract clean answer text from accumulated raw JSON ──────────────
          let finalText = accText;
          try {
            // Strip any markdown fences the model may have added
            const cleaned = accText.trim()
              .replace(/^```(?:json)?\s*/m, "")
              .replace(/```\s*$/m, "")
              .trim();
            const parsed = JSON.parse(cleaned);
            if (parsed && typeof parsed.answer === "string" && parsed.answer.trim()) {
              finalText = parsed.answer.trim();
            }
          } catch (_) {
            // Regex fallback: pull the answer value even from partial JSON
            const m = accText.match(/"answer"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
            if (m) {
              finalText = m[1]
                .replace(/\\n/g, "\n")
                .replace(/\\t/g, "\t")
                .replace(/\\"/g, '"')
                .replace(/\\\\/g, "\\");
            }
          }

          // _settled: false → triggers typewriter animation on the clean answer
          setMessages(prev => prev.map(m =>
            m._id === placeholderIdx
              ? { ...m, text: finalText, _streaming: false, _settled: false }
              : m
          ));
          return;
        }
        if (data.startsWith("[META] ")) {
          try {
            const meta = JSON.parse(data.slice(7));
            setMessages(prev => prev.map(m =>
              m._id === placeholderIdx
                ? { ...m, sources: meta.sources || [], confidence: meta.confidence || "medium" }
                : m
            ));
          } catch (_) {}
          return;
        }
        const token = data.replace(/\\n/g, "\n");
        accText += token;
        setMessages(prev => prev.map(m =>
          m._id === placeholderIdx ? { ...m, text: accText } : m
        ));
      };

      es.onerror = () => {
        es.close();
        if (!accText) {
          _blockingAsk(q, placeholderIdx);
        } else {
          setAsking(false);
          setStreaming(false);
          setMessages(prev => prev.map(m =>
            m._id === placeholderIdx ? { ...m, _streaming: false, _settled: true } : m
          ));
        }
      };
      return;
    }

    _blockingAsk(q, null);
  };

  const handleKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } };

  const latestAssistantIdx = messages.reduce((acc, m, i) => m.role === "assistant" ? i : acc, -1);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "rgba(255,255,255,0.6)", backdropFilter: "blur(20px)" }}>

      {/* Header */}
      <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid rgba(0,0,0,0.06)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: "#111" }}>smart_toy</span>
          <span className="font-headline font-bold text-xs uppercase tracking-widest" style={{ color: "#111" }}>Repository AI Chat</span>
          {streaming && (
            <span style={{
              fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em",
              padding: "2px 7px", borderRadius: 4, marginLeft: "auto",
              background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)", color: "#4f46e5",
              fontFamily: "Inter, sans-serif", animation: "breathing 1.5s ease-in-out infinite",
            }}>Streaming…</span>
          )}
        </div>
        <p style={{ fontSize: 11, color: ragReady ? "#22c55e" : "#aaa", fontFamily: "Inter, sans-serif", display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: ragReady ? "#22c55e" : "#ddd", display: "inline-block", flexShrink: 0 }} />
          {ragReady ? "LLM RAG ready — powered by Groq" : "Analyze a repo to enable chat"}
        </p>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 14, opacity: 0.45 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 32, color: "#ccc" }}>forum</span>
            <p style={{ fontSize: 12, color: "#aaa", textAlign: "center", lineHeight: 1.65, maxWidth: 190, fontFamily: "Inter, sans-serif" }}>
              Ask about files, functions, frameworks, API routes, or architecture.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, justifyContent: "center", maxWidth: 220 }}>
              {["What does this repo do?", "List the API routes", "What framework is used?"].map(hint => (
                <button key={hint} onClick={() => setInput(hint)}
                  style={{
                    fontSize: 10, padding: "4px 8px", borderRadius: 5, border: "1px solid rgba(0,0,0,0.1)",
                    background: "rgba(0,0,0,0.03)", color: "#777", cursor: "pointer", fontFamily: "Inter, sans-serif",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,0,0,0.06)"; e.currentTarget.style.color = "#111"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0.03)"; e.currentTarget.style.color = "#777"; }}
                >{hint}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={msg._id ?? i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
            {msg.role === "user" && (
              <div style={{
                maxWidth: "88%", padding: "9px 13px",
                borderRadius: "12px 12px 2px 12px",
                background: "#111", color: "#fff",
                fontSize: 13, lineHeight: 1.6, fontFamily: "Inter, sans-serif",
              }}>
                {msg.text}
              </div>
            )}
            {msg.role === "assistant" && (
              <AssistantBubble msg={msg} isLatest={i === latestAssistantIdx} />
            )}
            {msg.role === "error" && (
              <div style={{
                maxWidth: "88%", padding: "9px 13px",
                borderRadius: "12px 12px 12px 2px",
                background: "#fee2e2", color: "#991b1b",
                fontSize: 13, lineHeight: 1.6, fontFamily: "Inter, sans-serif",
              }}>
                ⚠️ {msg.text}
              </div>
            )}
          </div>
        ))}

        {asking && !streaming && (
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
          id="chat-input"
          type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
          disabled={asking || !ragReady}
          placeholder={ragReady ? "Ask about this repository…" : "Run an analysis first…"}
          style={{ flex: 1, border: "none", outline: "none", background: "rgba(0,0,0,0.04)", borderRadius: 8, padding: "9px 12px", fontFamily: "Inter, sans-serif", fontSize: 13, color: "#111" }}
        />
        <button id="chat-send-btn" onClick={ask} disabled={asking || !input.trim() || !ragReady}
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
  const [previewFile, setPreviewFile] = useState(null);
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

          {previewFile && <FilePreviewModal repoUrl={repoUrl} filePath={previewFile} onClose={() => setPreviewFile(null)} />}

          {/* Repository Activity */}
          {result.metadata?.commits?.length > 0 && (
            <section style={{ marginBottom: 44 }} className="reveal-up reveal-hidden delay-3">
              <SectionHeader label="Repository Activity" extra={`${result.metadata.total_commits || 0} Total Commits`} />
              <div className="glass-card p-7">
                <CommitGraph commits={result.metadata.commits} />
                <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 10 }}>
                  {result.metadata.commits.slice(0, 3).map((c, i) => (
                    <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", paddingBottom: 10, borderBottom: i < 2 ? "1px solid rgba(0,0,0,0.05)" : "none" }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", marginTop: 7, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 13, color: "#111", fontWeight: 500, fontFamily: "Inter, sans-serif" }}>{c.message}</div>
                        <div style={{ fontSize: 11, color: "#888", marginTop: 2, fontFamily: "Inter, sans-serif" }}>{c.author} • {new Date(c.date).toLocaleDateString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Entry Points & Docs */}
          {(result.entry_points?.length > 0 || result.doc_links?.length > 0) && (
            <section style={{ marginBottom: 44 }} className="reveal-up reveal-hidden delay-4">
              <SectionHeader label="Project Navigation" />
              
              {result.entry_points?.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <h4 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#888", marginBottom: 12 }}>Entry Points</h4>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {result.entry_points.map(ep => (
                      <div key={ep} onClick={() => setPreviewFile(ep)} 
                           className="glass-card glass-card-hover"
                           style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", borderRadius: 8 }}>
                        <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>play_circle</span>
                        <span style={{ fontSize: 12, fontWeight: 600, fontFamily: "Inter, sans-serif", color: "#111" }}>{ep}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.doc_links?.length > 0 && (
                <div>
                  <h4 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#888", marginBottom: 12 }}>Documentation Links</h4>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {result.doc_links.map(dl => (
                      <div key={dl} onClick={() => setPreviewFile(dl)} 
                           className="glass-card glass-card-hover"
                           style={{ padding: "6px 12px", display: "flex", alignItems: "center", gap: 6, cursor: "pointer", borderRadius: 6, background: "rgba(0,0,0,0.02)" }}>
                        <span className="material-symbols-outlined text-stone-500" style={{ fontSize: 14 }}>menu_book</span>
                        <span style={{ fontSize: 11, fontWeight: 500, fontFamily: "Inter, sans-serif", color: "#555" }}>{dl}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

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
                    <div key={i} onClick={() => setPreviewFile(file)} className="group glass-card p-5 flex justify-between items-center cursor-pointer key-file-row">
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