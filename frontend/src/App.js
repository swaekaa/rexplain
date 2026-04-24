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
          <span className="bitcount-brand text-primary text-xl">REX</span>
          <span className="text-secondary font-body text-sm font-light tracking-wide">© 2024 REX. Built for clarity.</span>
        </div>
        <div className="flex gap-10">
          {["Github", "Privacy", "Terms", "Status"].map(l => (
            <a key={l} className="text-secondary font-headline font-semibold text-[11px] uppercase tracking-widest hover:text-primary transition-colors" href="#">{l}</a>
          ))}
        </div>
      </div>
    </footer>
  );
}

// ─── HTTP Method badge colors ───────────────────────────────────────────────
function methodBg(method) {
  const styles = {
    GET:     "text-green-400 bg-green-400/10 border-green-400/20",
    POST:    "text-blue-400 bg-blue-400/10 border-blue-400/20",
    PUT:     "text-orange-400 bg-orange-400/10 border-orange-400/20",
    PATCH:   "text-purple-400 bg-purple-400/10 border-purple-400/20",
    DELETE:  "text-red-400 bg-red-400/10 border-red-400/20",
    HEAD:    "text-secondary bg-white/5 border-white/10",
    OPTIONS: "text-secondary bg-white/5 border-white/10",
  };
  return styles[method] || "text-secondary bg-white/5 border-white/10";
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
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-10" onClick={onClose}>
      <div className="bg-surface-container-lowest w-full max-w-4xl max-h-full rounded-2xl overflow-hidden flex flex-col shadow-[0_20px_40px_rgba(0,0,0,0.5)] border border-white/10" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center px-6 py-4 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-secondary !text-lg">description</span>
            <span className="text-white font-body font-semibold text-sm">{filePath}</span>
          </div>
          <button onClick={onClose} className="bg-transparent border-none text-secondary hover:text-white transition-colors cursor-pointer flex items-center">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 bg-transparent">
          {loading ? (
            <div className="text-secondary font-body text-sm">Loading preview...</div>
          ) : error ? (
            <div className="text-red-400 font-body text-sm">⚠️ {error}</div>
          ) : (
            <pre className="m-0 font-mono text-xs text-secondary/80 whitespace-pre-wrap break-all leading-relaxed">
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
    <div className="h-[200px] w-full mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <XAxis dataKey="date" stroke="#a3a3a3" fontSize={10} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ background: "#1c1c1c", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12 }}
            itemStyle={{ color: "#a855f7" }}
          />
          <Line type="monotone" dataKey="count" stroke="#a855f7" strokeWidth={3} dot={{ r: 4, fill: "#a855f7" }} activeDot={{ r: 6 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Landing Page ──────────────────────────────────────────────────────────
function LandingPage({ repoUrl, setRepoUrl, onAnalyze, loading, error, theme, toggleTheme }) {
  const handleKey = (e) => { if (e.key === "Enter") onAnalyze(); };
  return (
    <div className="bg-background text-on-background font-body selection:bg-tertiary selection:text-white antialiased min-h-screen">
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-8 py-6 bg-transparent">
        <div className="flex items-center gap-8">
          <div className="flex items-center">
            <span className="rexplain-logo text-xl font-extrabold tracking-tighter font-headline">RExplain</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 font-['Manrope'] text-sm tracking-tight font-medium">
            <a className="text-primary border-b-2 border-primary pb-1" href="#">Explore</a>
          </nav>
        </div>
      </header>

      <main className="min-h-screen pt-40 pb-24 flex flex-col items-center justify-center px-6 relative overflow-hidden bg-[radial-gradient(circle_at_50%_0%,rgba(168,85,247,0.08)_0%,transparent_50%),radial-gradient(circle_at_80%_80%,rgba(249,115,22,0.05)_0%,transparent_50%)]">
        {/* Abstract glowing background elements */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-tertiary/10 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-accent-orange/5 rounded-full blur-[150px] pointer-events-none"></div>

        <div className="w-12 h-[1px] bg-outline mb-12 animate-reveal-up"></div>

        <div className="max-w-5xl w-full text-center mb-16 relative z-10">
          <h1 className="font-headline font-extrabold text-primary mb-8 leading-[0.95] tracking-tighter liquid-glass-text animate-reveal-up animate-delay-1" style={{ fontSize: "clamp(4rem, 12vw, 9rem)" }}>
            RExplain
          </h1>
          <p className="font-body text-secondary text-lg md:text-2xl tracking-tight font-light max-w-2xl mx-auto leading-relaxed animate-reveal-up animate-delay-2">
            Unfold the complexity of any GitHub repository with clarity and intent. A minimalist approach to deep codebase analysis.
          </p>
        </div>

        <div className="w-full max-w-2xl relative group mb-24 animate-reveal-up animate-delay-3 z-10">
          <div className="absolute -inset-1 bg-gradient-to-r from-tertiary to-accent-orange rounded-full blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
          <div className="relative flex items-center bg-surface-container-lowest border border-outline rounded-full p-2 pl-6 shadow-2xl">
            <span className="material-symbols-outlined text-secondary mr-3" style={{ fontSize: 22 }}>search</span>
            <input 
              className="w-full bg-transparent border-none text-on-background placeholder:text-secondary focus:outline-none focus:ring-0 font-body text-lg py-3" 
              placeholder="paste-github-repo-url-here" 
              type="text"
              value={repoUrl}
              onChange={e => setRepoUrl(e.target.value)}
              onKeyDown={handleKey}
              disabled={loading}
            />
            <button 
              className="ml-4 bg-on-background text-background px-8 py-3 rounded-full font-headline font-bold hover:scale-105 transition-transform duration-300 flex items-center gap-2 disabled:opacity-50 disabled:hover:scale-100"
              onClick={onAnalyze} 
              disabled={loading || !repoUrl.trim()}
            >
              <span>Analyze</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>
          {error && (
            <div className="mt-6 p-4 rounded-xl text-red-500 text-sm font-body border border-red-500/20 bg-red-500/5 text-center">
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* Feature Grid */}
        <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10 animate-reveal-up animate-delay-4 px-4">
          <div className="liquid-glass p-8 rounded-2xl flex flex-col justify-between h-64 group hover:bg-surface-container-lowest/50">
            <div className="flex justify-between items-start">
              <div className="w-10 h-10 rounded-full bg-tertiary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-tertiary">hub</span>
              </div>
              <span className="text-[10px] uppercase tracking-widest text-secondary font-bold group-hover:text-tertiary transition-colors">01</span>
            </div>
            <div>
              <h3 className="font-headline text-2xl font-bold text-primary mb-3">Structural Mapping</h3>
              <p className="font-body text-sm text-secondary leading-relaxed font-light">Visualizes dependencies and component relationships instantly, skipping hours of manual auditing.</p>
            </div>
          </div>

          <div className="liquid-glass p-8 rounded-2xl flex flex-col justify-between h-64 group hover:bg-surface-container-lowest/50">
            <div className="flex justify-between items-start">
              <div className="w-10 h-10 rounded-full bg-accent-orange/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-accent-orange">auto_awesome</span>
              </div>
              <span className="text-[10px] uppercase tracking-widest text-secondary font-bold group-hover:text-accent-orange transition-colors">02</span>
            </div>
            <div>
              <h3 className="font-headline text-2xl font-bold text-primary mb-3">Semantic Analysis</h3>
              <p className="font-body text-sm text-secondary leading-relaxed font-light">Understands the 'why' behind the codebase, identifying core logic patterns across multiple languages.</p>
            </div>
          </div>

          <div className="liquid-glass p-8 rounded-2xl flex flex-col justify-between h-64 group hover:bg-surface-container-lowest/50">
            <div className="flex justify-between items-start">
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary">terminal</span>
              </div>
              <span className="text-[10px] uppercase tracking-widest text-secondary font-bold group-hover:text-primary transition-colors">03</span>
            </div>
            <div>
              <h3 className="font-headline text-2xl font-bold text-primary mb-3">Zero Config</h3>
              <p className="font-body text-sm text-secondary leading-relaxed font-light">Paste a URL and explore. No installation, no complex setup required. Just immediate architectural insight.</p>
            </div>
          </div>
        </div>

        {/* Decorative architectural lines */}
        <div className="absolute left-12 top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-outline to-transparent hidden xl:block"></div>
        <div className="absolute right-12 top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-outline to-transparent hidden xl:block"></div>
      </main>
      
      <footer className="bg-transparent border-t border-outline">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8 py-10 px-8">
          <div className="flex flex-col gap-1">
            <span className="text-[13px] font-semibold text-primary font-headline tracking-tight">RExplain</span>
            <p className="font-body text-[11px] tracking-tight text-secondary italic">Built for clarity.</p>
          </div>
          <div className="flex gap-10">
            {["Github", "Privacy", "Terms", "Status"].map(l => (
              <a key={l} className="font-body text-[12px] tracking-tight text-secondary hover:text-primary transition-colors" href="#">{l}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── Loading State ──────────────────────────────────────────────────────────
function LoadingState({ repoUrl, theme }) {
  const repoName = repoUrl ? repoUrl.split("/").slice(-2).join("/") : "repository";
  return (
    <div className="bg-background text-on-background font-body antialiased h-screen overflow-hidden flex flex-col">
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-8 py-4 bg-transparent backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-8">
            <div className="flex items-center">
                <span className="rexplain-logo text-xl font-extrabold tracking-tighter font-headline">RExplain</span>
            </div>
            <nav className="hidden md:flex items-center gap-8 font-['Manrope'] text-sm tracking-tight font-medium">
                <a className="text-white border-b-2 border-white pb-1" href="#">Analysis</a>
            </nav>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 bg-transparent relative mt-[64px]">
        <div className="w-full max-w-2xl flex flex-col items-center z-10">
          <div className="text-center space-y-8 mb-16">
            <div className="flex flex-col items-center">
              <div className="relative w-16 h-16 flex items-center justify-center mb-8">
                <div className="absolute inset-0 bg-accent-purple/10 rounded-full animate-liquid-pulse"></div>
                <div className="absolute inset-0 border border-accent-purple/30 rounded-full animate-slow-spin"></div>
                <div className="relative w-2 h-2 bg-accent-purple rounded-full"></div>
              </div>
              
              <div className="space-y-6">
                <div className="inline-flex items-center gap-3 justify-center">
                    <div className="w-8 h-[1px] bg-accent-orange animate-pulse"></div>
                    <span className="text-[9px] uppercase tracking-[0.4em] font-bold text-accent-orange animate-pulse">System Insight</span>
                </div>
                <h1 className="text-5xl font-headline font-extrabold tracking-tight leading-[1.1] text-white animate-breathing">
                  Analyzing<br/>Repository
                </h1>
                <p className="text-secondary font-body text-base leading-relaxed font-light max-w-sm mx-auto opacity-80">
                  Mapping structural architecture and functional logic pathways.
                </p>
              </div>
            </div>
          </div>

          <div className="w-64 h-[1px] bg-white/5 overflow-hidden relative mb-16">
            <div className="absolute inset-0 w-1/3 h-full bg-accent-purple animate-shimmer"></div>
          </div>

          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="liquid-glass p-6 h-32 flex flex-col justify-between rounded-xl group">
              <div className="flex justify-between items-start">
                <span className="text-[9px] font-bold uppercase tracking-widest text-secondary/40">Repository</span>
                <span className="material-symbols-outlined text-secondary/20 group-hover:text-accent-purple transition-colors">folder</span>
              </div>
              <span className="text-2xl font-headline font-bold tracking-tight text-white truncate">{repoName}</span>
            </div>
            <div className="liquid-glass p-6 h-32 flex flex-col justify-between rounded-xl group">
              <div className="flex justify-between items-start">
                <span className="text-[9px] font-bold uppercase tracking-widest text-secondary/40">Source</span>
                <span className="material-symbols-outlined text-secondary/20 group-hover:text-accent-purple transition-colors">cloud</span>
              </div>
              <span className="text-2xl font-headline font-bold tracking-tight text-white truncate">GitHub URL</span>
            </div>
          </div>
        </div>
        
        {/* Decorative Aesthetic Elements */}
        <div className="fixed bottom-12 right-12 pointer-events-none opacity-[0.02] text-white">
          <span className="material-symbols-outlined text-[15rem]">architecture</span>
        </div>
        
        {/* Footer (Mini) */}
        <footer className="absolute bottom-8 left-0 right-0 text-center bg-transparent">
            <p className="text-[10px] text-secondary/30 uppercase tracking-[0.2em] font-bold">© 2024 • RExplain AI Systems</p>
        </footer>
      </main>
    </div>
  );
}

// ─── Confidence badge ────────────────────────────────────────────────────────
function ConfidenceBadge({ level }) {
  const cfg = {
    high: { bg: "bg-green-400/10", border: "border-green-400/20", color: "text-green-400", dot: "bg-green-400", label: "High confidence" },
    medium: { bg: "bg-yellow-400/10", border: "border-yellow-400/20", color: "text-yellow-400", dot: "bg-yellow-400", label: "Medium confidence" },
    low: { bg: "bg-red-400/10", border: "border-red-400/20", color: "text-red-400", dot: "bg-red-400", label: "Low confidence" },
  };
  const { bg, border, color, dot, label } = cfg[level] || cfg.medium;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${bg} ${border} ${color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot} inline-block`} />
      {label}
    </span>
  );
}

// ─── Source pill ─────────────────────────────────────────────────────────────
function SourcePill({ path }) {
  const name = path.split("/").pop();
  return (
    <span
      title={path}
      className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-white/10 bg-white/5 hover:bg-white/10 text-secondary transition-colors cursor-default"
    >
      <span className="material-symbols-outlined !text-[10px] text-secondary/60">description</span>
      {name}
    </span>
  );
}

// ─── Typing animation hook ────────────────────────────────────────────────────
function useTypewriter(fullText, speed = 14) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
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
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-2 w-full">
          {["80%", "65%", "90%"].map((w, i) => (
            <div key={i} className="h-2.5 rounded-full bg-secondary/20" style={{
              width: w,
              animation: `breathing 1.6s ease-in-out ${i * 0.22}s infinite`,
            }} />
          ))}
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-1 h-1 rounded-full bg-secondary animate-breathing" style={{
              animationDelay: `${i * 0.18}s`,
            }} />
          ))}
          <span className="text-[9px] text-secondary/60 tracking-widest font-bold uppercase ml-1">Generating…</span>
        </div>
      </div>
    );
  }

  // ── Settled / typewriter state ───────────────────────────────────────────────
  const footerVisible = (done || !animate) && (msg.sources?.length > 0 || msg.confidence);

  return (
    <>
      <span className="whitespace-pre-wrap break-words text-secondary">{text}</span>
      {showCursor && (
        <span className="inline-block w-0.5 h-[0.9em] bg-secondary/50 ml-0.5 align-text-bottom animate-breathing" />
      )}
      {footerVisible && (
        <div className="mt-3 flex flex-wrap gap-1.5 items-center border-t border-white/5 pt-2.5">
          {msg.confidence && <ConfidenceBadge level={msg.confidence} />}
          {msg.sources?.map((src, si) => <SourcePill key={si} path={src} />)}
        </div>
      )}
    </>
  );
}

// ─── Chat Sidebar ───────────────────────────────────────────────────────────
function ChatSidebar({ repoUrl, ragReady }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [asking, setAsking] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef(null);
  const esRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
        text: err?.response?.data?.detail || "Something went wrong. Check your API KEY.",
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

          let finalText = accText;
          try {
            const cleaned = accText.trim()
              .replace(/^```(?:json)?\s*/m, "")
              .replace(/```\s*$/m, "")
              .trim();
            const parsed = JSON.parse(cleaned);
            if (parsed && typeof parsed.answer === "string" && parsed.answer.trim()) {
              finalText = parsed.answer.trim();
            }
          } catch (_) {
            const m = accText.match(/"answer"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
            if (m) {
              finalText = m[1]
                .replace(/\\n/g, "\n")
                .replace(/\\t/g, "\t")
                .replace(/\\"/g, '\"')
                .replace(/\\\\/g, "\\");
            }
          }

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
          } catch (_) { }
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
    <div className="flex flex-col h-full bg-white/[0.01]">
      <div className="p-8 pb-4 flex items-center justify-between border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-accent-purple/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-accent-purple !text-lg">auto_awesome</span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-secondary/40">Assistant Core</span>
        </div>
        <button className="text-secondary/40 hover:text-white transition-colors">
            <span className="material-symbols-outlined">refresh</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6 scroll-hide">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 opacity-50">
            <span className="material-symbols-outlined text-3xl text-secondary">forum</span>
            <p className="text-xs text-secondary text-center max-w-[200px] font-body leading-relaxed">
              Ask about files, functions, frameworks, API routes, or architecture.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={msg._id ?? i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === "user" && (
              <div className="p-4 rounded-xl max-w-[85%] bg-white/5 backdrop-blur-md border border-white/10 text-white font-body text-sm leading-relaxed">
                {msg.text}
              </div>
            )}
            {msg.role === "assistant" && (
              <div className="p-4 rounded-xl max-w-[85%] bg-accent-purple/10 border-l-2 border-accent-purple backdrop-blur-md text-secondary font-body text-sm leading-relaxed">
                <AssistantBubble msg={msg} isLatest={i === latestAssistantIdx} />
              </div>
            )}
            {msg.role === "error" && (
               <div className="p-4 rounded-xl max-w-[85%] bg-red-500/10 border border-red-500/20 text-red-400 font-body text-sm leading-relaxed">
                ⚠️ {msg.text}
              </div>
            )}
          </div>
        ))}

        {asking && !streaming && (
          <div className="flex justify-start">
            <div className="p-4 rounded-xl bg-white/5 flex gap-1 items-center">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-secondary animate-breathing" style={{ animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-6 bg-transparent border-t border-white/5 flex-shrink-0">
        <div className="relative group">
            <input 
              className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-5 pr-14 text-sm focus:outline-none focus:ring-1 focus:ring-accent-purple/30 focus:border-accent-purple/50 transition-all placeholder:text-secondary/30 text-white font-body" 
              placeholder={ragReady ? "Ask about the repository architecture..." : "Analyze repo to enable chat..."}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              disabled={asking || !ragReady}
            />
            <button 
              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-white text-background rounded-lg flex items-center justify-center hover:bg-accent-purple hover:text-white transition-colors disabled:opacity-50 disabled:bg-white/50"
              onClick={ask}
              disabled={asking || !input.trim() || !ragReady}
            >
                <span className="material-symbols-outlined !text-sm">arrow_upward</span>
            </button>
        </div>
      </div>
    </div>
  );
}

// ─── Analysis View — Split Screen ───────────────────────────────────────────
const NAV_H = 72;

function AnalysisView({ result, repoUrl, onReset, theme, toggleTheme }) {
  const fw = result.framework_detection || {};
  const scan = result.scan_results || {};
  const langs = Object.entries(scan.languages || {}).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const repoName = repoUrl.replace("https://github.com/", "").replace("http://github.com/", "");
  const stackItems = [
    { label: "Backend", value: fw.backend_framework, icon: "terminal" },
    { label: "Frontend", value: fw.frontend_framework, icon: "web_asset" },
    { label: "Database", value: fw.database, icon: "database" },
  ];

  const [splitPct, setSplitPct] = useState(50);
  const [previewFile, setPreviewFile] = useState(null);
  const dragging = useRef(false);
  const containerRef = useRef(null);

  const onDividerDown = useCallback((e) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setSplitPct(Math.min(65, Math.max(25, pct)));
    };
    const onUp = () => {
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  return (
    <div className="bg-background text-on-background font-body antialiased h-screen overflow-hidden flex flex-col">
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-8 py-4 bg-transparent backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-8">
            <div className="flex items-center">
                <span className="rexplain-logo text-xl font-extrabold tracking-tighter font-headline">RExplain</span>
            </div>
            <nav className="hidden md:flex items-center gap-8 font-['Manrope'] text-sm tracking-tight font-medium">
                <a className="text-white border-b-2 border-white pb-1" href="#">Analysis</a>
            </nav>
        </div>
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1 bg-accent-orange/10 border border-accent-orange/20 rounded-full">
                <span className="w-2 h-2 rounded-full bg-accent-orange animate-pulse"></span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-accent-orange">Live Kernel</span>
            </div>
            <button onClick={onReset} className="px-5 py-2 text-xs font-bold uppercase tracking-widest hover:text-accent-purple transition-colors duration-200 text-white">New Analysis</button>
        </div>
      </header>

      <div ref={containerRef} className="flex flex-1 overflow-hidden" style={{ marginTop: '64px' }}>
        {/* Left Side: Analysis Content */}
        <main style={{ width: `${splitPct}%` }} className="overflow-y-auto bg-transparent scroll-hide border-r border-white/5">
          <div className="w-full max-w-4xl mx-auto px-8 pt-20 pb-24">
            
            {/* Hero Analysis Header */}
            <section className="mb-16 space-y-4 animate-reveal-up">
                <div className="inline-flex items-center gap-3">
                    <div className="w-8 h-[1px] bg-accent-orange"></div>
                    <span className="text-[9px] uppercase tracking-[0.4em] font-bold text-accent-orange">Structural Mapping</span>
                </div>
                <h1 className="text-5xl font-headline font-extrabold tracking-tight leading-[1.1] text-white">
                    Repository<br/>Analysis
                </h1>
                <p className="text-secondary font-body text-base leading-relaxed font-light">
                    Breakdown of <span className="text-white font-medium border-b border-white/20">{repoName}</span>. Analyzed in <span className="font-medium text-white">{result._elapsed || "~5"}s</span>.
                </p>
            </section>

            {/* Repo Stats */}
            <section className="mb-12 animate-reveal-up animate-delay-1">
                <div className="liquid-glass p-8 flex flex-col gap-6 shadow-sm rounded-xl">
                    <div className="space-y-1">
                        <span className="block text-[9px] uppercase tracking-[0.3em] text-secondary/40 font-bold">Comprehensive Scan</span>
                        <h2 className="text-4xl font-headline font-bold tracking-tight text-white">
                          {scan.total_files?.toLocaleString() || 0} <span className="text-xl font-light text-secondary/40">files</span>
                        </h2>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {langs.map(([ext, count]) => (
                          <span key={ext} className="px-4 py-1.5 bg-white/5 border border-white/10 text-secondary text-[9px] font-bold tracking-[0.1em] uppercase">
                            {ext} ({count})
                          </span>
                        ))}
                    </div>
                </div>
            </section>

            {/* Tech Stack */}
            <section className="mb-16 animate-reveal-up animate-delay-2">
                <SectionHeader label="Ecosystem" />
                <div className="grid grid-cols-2 gap-4">
                  {stackItems.slice(0,2).map(({ label, value, icon }) => (
                    <div key={label} className="liquid-glass p-6 h-40 flex flex-col justify-between group rounded-xl">
                        <div className="flex justify-between items-start">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-secondary/40">{label}</span>
                            <span className="material-symbols-outlined text-secondary/20 group-hover:text-accent-purple transition-colors">{icon}</span>
                        </div>
                        <span className="text-2xl font-headline font-bold tracking-tight text-white">{value || "Not detected"}</span>
                    </div>
                  ))}
                </div>
            </section>

            {/* AI Explanation */}
            <section className="mb-16 animate-reveal-up animate-delay-3">
              <SectionHeader label="AI Interpretation" />
              <div className="liquid-glass p-8 rounded-xl">
                <p className="text-sm font-body leading-[1.75] text-white mb-5 font-light">{result.ai_explanation}</p>
                {result.folder_explanations && Object.keys(result.folder_explanations).length > 0 && (
                  <div className="flex flex-col gap-3 mb-4">
                    {Object.entries(result.folder_explanations).slice(0, 4).map(([folder, desc]) => {
                      const [label] = desc.split(" — ");
                      return (
                        <div key={folder} className="flex items-center gap-3 text-sm">
                          <code className="text-[10px] font-bold uppercase tracking-widest bg-white/5 border border-white/10 px-2 py-1 text-white rounded">/{folder}</code>
                          <span className="text-secondary font-light">{label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="flex items-center gap-3 border-t border-white/5 pt-4">
                  <span className="material-symbols-outlined text-secondary/40 text-sm">verified</span>
                  <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-secondary/40">Static Analysis • Pattern Detection</span>
                </div>
              </div>
            </section>

            {/* API Routes */}
            {result.api_routes?.length > 0 && (
              <section className="mb-16 animate-reveal-up animate-delay-3">
                <SectionHeader label={`API Surface · ${result.api_routes.length} routes`} />
                <div className="flex flex-col gap-2">
                  {result.api_routes.slice(0, 10).map((route, i) => {
                    const [method, ...rest] = route.split(" ");
                    const cls = methodBg(method);
                    return (
                      <div key={i} className="liquid-glass p-4 rounded-lg flex items-center gap-4">
                        <span className={`text-[9px] font-headline font-bold uppercase tracking-widest px-3 py-1 rounded border ${cls} min-w-[54px] text-center`}>
                          {method}
                        </span>
                        <code className="text-sm text-secondary font-mono truncate">{rest.join(" ")}</code>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Key Files */}
            {result.important_files?.length > 0 && (
              <section className="mb-16 animate-reveal-up animate-delay-3">
                  <SectionHeader label="Core Entry Points" />
                  <div className="space-y-3">
                    {result.important_files.slice(0, 6).map((file, i) => {
                      const name = file.split("/").pop();
                      const icon = name.includes("Dockerfile") ? "deployed_code" : file.startsWith(".github") ? "hub" : name.endsWith(".json") ? "data_object" : name.endsWith(".py") ? "terminal" : "description";
                      return (
                        <div key={i} onClick={() => setPreviewFile(file)} className="group liquid-glass p-5 rounded-xl flex justify-between items-center hover:bg-white/[0.05] transition-all cursor-pointer">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 flex items-center justify-center bg-white/5 group-hover:bg-accent-purple transition-colors rounded-lg">
                                    <span className="material-symbols-outlined text-secondary/40 group-hover:text-white">{icon}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold font-headline tracking-tight text-white">{name}</span>
                                    <span className="text-[10px] text-secondary/40 font-medium uppercase tracking-wider">{file}</span>
                                </div>
                            </div>
                            <span className="material-symbols-outlined text-secondary/20 group-hover:text-accent-orange transition-all">arrow_forward</span>
                        </div>
                      )
                    })}
                  </div>
              </section>
            )}

            {previewFile && <FilePreviewModal repoUrl={repoUrl} filePath={previewFile} onClose={() => setPreviewFile(null)} />}

            {/* Commit Activity */}
            {result.metadata?.commits?.length > 0 && (
              <section className="mb-16 animate-reveal-up animate-delay-3">
                <SectionHeader label={`Commit Activity · ${result.metadata.total_commits || result.metadata.commits.length} commits`} />
                <div className="liquid-glass p-6 rounded-xl">
                  <CommitGraph commits={result.metadata.commits} />
                  <div className="mt-6 flex flex-col gap-3">
                    {result.metadata.commits.slice(0, 4).map((c, i) => (
                      <div key={i} className="flex items-start gap-3 pb-3 border-b border-white/5 last:border-0 last:pb-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-accent-purple mt-2 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="text-sm text-white font-medium truncate">{c.message}</div>
                          <div className="text-[11px] text-secondary/60 mt-0.5">{c.author} · {new Date(c.date).toLocaleDateString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* Entry Points */}
            {result.entry_points?.length > 0 && (
              <section className="mb-16 animate-reveal-up animate-delay-3">
                <SectionHeader label="Entry Points" />
                <div className="flex flex-wrap gap-2">
                  {result.entry_points.map(ep => (
                    <div key={ep} onClick={() => setPreviewFile(ep)}
                      className="liquid-glass px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer hover:bg-white/5 transition-colors">
                      <span className="material-symbols-outlined text-accent-purple !text-base">play_circle</span>
                      <span className="text-sm font-medium text-white font-body">{ep}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* README */}
            {result.readme && (
              <section className="mb-16 animate-reveal-up animate-delay-3">
                <SectionHeader label="README · Documentation" />
                <div className="liquid-glass p-8 rounded-xl">
                  <div className="readme-prose">
                    <ReactMarkdown>{result.readme}</ReactMarkdown>
                  </div>
                </div>
              </section>
            )}

            {/* Footer (Mini) */}
            <footer className="pt-12 text-center bg-transparent">
                <p className="text-[10px] text-secondary/30 uppercase tracking-[0.2em] font-bold">© 2024 • RExplain AI Systems</p>
            </footer>

          </div>
        </main>

        {/* DIVIDER */}
        <div
          onMouseDown={onDividerDown}
          className="w-1.5 flex-shrink-0 cursor-col-resize flex items-center justify-center z-10 transition-colors hover:bg-white/5"
        >
          <div className="w-0.5 h-10 rounded-full bg-white/10 pointer-events-none" />
        </div>

        {/* Right Side: AI Chat Interface */}
        <aside style={{ width: `${100 - splitPct}%` }} className="flex flex-col bg-white/[0.01]">
          <ChatSidebar repoUrl={repoUrl} ragReady={result.rag_ready} />
        </aside>
      </div>
    </div>
  );
}

// ─── Section header helper ──────────────────────────────────────────────────
function SectionHeader({ label }) {
  return (
    <div className="flex items-center gap-4 mb-8">
        <h3 className="text-[9px] uppercase tracking-[0.3em] text-secondary/40 font-bold whitespace-nowrap">{label}</h3>
        <div className="h-[1px] w-full bg-white/5"></div>
    </div>
  );
}

// ─── App Root ───────────────────────────────────────────────────────────────
export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");
  useEffect(() => {
    localStorage.setItem("theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  const toggleTheme = () => setTheme(t => t === "dark" ? "light" : "dark");
  const [repoUrl, setRepoUrl] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
  if (result) return <AnalysisView result={result} repoUrl={repoUrl} onReset={reset} theme={theme} toggleTheme={toggleTheme} />;
  return <LandingPage repoUrl={repoUrl} setRepoUrl={setRepoUrl} onAnalyze={analyze} loading={loading} error={error} theme={theme} toggleTheme={toggleTheme} />;
}