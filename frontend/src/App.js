import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import { LineChart, Line, BarChart, Bar, YAxis, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import InteractiveDiagram from "./InteractiveDiagram";
import "./index.css";

// ─── Environment & API Config ───────────────────────────────────────────────
const API_URL =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_URL)
    ? import.meta.env.VITE_API_URL
    : (process.env.REACT_APP_API_URL || "http://127.0.0.1:8000");
console.log("[RExplain] API_URL resolved to:", API_URL);

// ─── Axios Interceptor for Render Cold Starts ────────────────────────────────
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;
    if (!config || !config.retry) {
      config.retry = 0;
    }
    
    // Render free tier sleeping returns 502 Bad Gateway or timeouts
    const isRenderColdStart = !response || response.status === 502 || response.status === 503 || error.code === 'ECONNABORTED';
    
    if (isRenderColdStart && config.retry < 3) {
      config.retry += 1;
      console.log(`[RExplain] Backend may be sleeping. Retrying request (${config.retry}/3) in 5s...`);
      window.dispatchEvent(new CustomEvent("backend-waking-up"));
      await new Promise(resolve => setTimeout(resolve, 5000));
      return axios(config);
    }
    return Promise.reject(error);
  }
);

// ─── Shared Footer ─────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="border-t border-white/20 py-16 px-8 bg-stone-100/50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10">
        <div className="flex flex-col md:flex-row items-center gap-10">
          <span className="bitcount-brand text-primary text-xl">REX</span>
          <span className="text-secondary font-body text-sm font-light tracking-wide">© 2026 REX. Built for clarity.</span>
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
        console.log("API URL:", API_URL);
        const res = await axios.post(`${API_URL}/files/content`, { repo_url: repoUrl, file_path: filePath });
        console.log("Response:", res.data);
        setContent(res.data.content);
        setLoading(false);
      } catch (err) {
        console.error("API Error:", err);
        if (err.response) {
          console.error("Backend response:", err.response.data);
        }
        setError(err.response?.data?.detail || "Backend not reachable. Try again.");
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

// ─── File Types Graph ────────────────────────────────────────────────────────
function FileTypesGraph({ langs }) {
  if (!langs || langs.length === 0) return null;

  const data = langs.map(([ext, count]) => ({ ext, count }));

  return (
    <div className="h-[200px] w-full mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <XAxis dataKey="ext" stroke="#a3a3a3" fontSize={10} tickLine={false} axisLine={false} />
          <YAxis stroke="#a3a3a3" fontSize={10} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ background: "#1c1c1c", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12 }}
            itemStyle={{ color: "#a855f7" }}
            cursor={{ fill: "rgba(255,255,255,0.05)" }}
          />
          <Bar dataKey="count" fill="#a855f7" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Landing Page ──────────────────────────────────────────────────────────
function LandingPage({ repoUrl, setRepoUrl, onAnalyze, loading, error, theme, toggleTheme, healthStatus }) {
  const handleKey = (e) => { if (e.key === "Enter") onAnalyze(); };
  return (
    <div className="bg-background text-on-background font-body selection:bg-tertiary selection:text-white antialiased min-h-[100dvh]">
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-4 md:px-8 py-4 md:py-6 bg-transparent">
        <div className="flex items-center gap-4 md:gap-8">
          <div className="flex items-center">
            <span className="rexplain-logo text-lg md:text-xl font-extrabold tracking-tighter font-headline">RExplain</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 font-['Manrope'] text-sm tracking-tight font-medium">
            <a className="text-primary border-b-2 border-primary pb-1" href="#">Explore</a>
          </nav>
        </div>
        <div className="flex items-center">
          <span className={`text-[10px] md:text-xs font-bold px-2 md:px-3 py-1 rounded-full ${healthStatus === 'Backend connected' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
            {healthStatus}
          </span>
        </div>
      </header>

      <main className="min-h-[100dvh] pt-32 md:pt-40 pb-24 flex flex-col items-center justify-center px-4 md:px-6 relative overflow-hidden bg-[radial-gradient(circle_at_50%_0%,rgba(168,85,247,0.08)_0%,transparent_50%),radial-gradient(circle_at_80%_80%,rgba(249,115,22,0.05)_0%,transparent_50%)]">
        {/* Abstract glowing background elements */}
        <div className="absolute top-1/4 left-1/4 w-64 md:w-96 h-64 md:h-96 bg-tertiary/10 rounded-full blur-[80px] md:blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-accent-orange/5 rounded-full blur-[100px] md:blur-[150px] pointer-events-none"></div>

        <div className="w-12 h-[1px] bg-outline mb-8 md:mb-12 animate-reveal-up"></div>

        <div className="max-w-5xl w-full text-center mb-12 md:mb-16 relative z-10">
          <h1 className="font-headline font-extrabold text-primary mb-6 md:mb-8 leading-[0.95] tracking-tighter liquid-glass-text" style={{ fontSize: "clamp(3.5rem, 12vw, 9rem)" }}>
            RExplain
          </h1>
          <p className="font-body text-secondary text-base md:text-2xl tracking-tight font-light max-w-2xl mx-auto leading-relaxed animate-reveal-up px-4" style={{ animationDelay: '0.2s' }}>
            Unfold the complexity of any GitHub repository with clarity and intent. A minimalist approach to deep codebase analysis.
          </p>
        </div>

        <div className="w-full max-w-2xl relative group mb-16 md:mb-24 animate-reveal-up z-10" style={{ animationDelay: '0.4s' }}>
          <div className="absolute -inset-1 bg-gradient-to-r from-tertiary to-accent-orange rounded-full blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
          <div className="relative flex flex-col md:flex-row items-center bg-surface-container-lowest border border-outline rounded-3xl md:rounded-full p-2 md:pl-6 shadow-2xl gap-2 md:gap-0">
            <div className="flex w-full items-center pl-4 md:pl-0">
                <span className="material-symbols-outlined text-secondary mr-3" style={{ fontSize: 22 }}>search</span>
                <input 
                className="w-full bg-transparent border-none text-on-background placeholder:text-secondary focus:outline-none focus:ring-0 font-body text-base md:text-lg py-3" 
                placeholder="paste-github-repo-url-here" 
                type="text"
                value={repoUrl}
                onChange={e => setRepoUrl(e.target.value)}
                onKeyDown={handleKey}
                disabled={loading}
                />
            </div>
            <button 
              className="w-full md:w-auto md:ml-4 bg-on-background text-background px-8 py-3 rounded-2xl md:rounded-full font-headline font-bold hover:scale-105 transition-transform duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:scale-100"
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
        <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10 animate-reveal-up px-4" style={{ animationDelay: '0.6s' }}>
          <div className="liquid-glass p-6 md:p-8 rounded-2xl flex flex-col justify-between h-auto md:h-64 group hover:bg-surface-container-lowest/50 gap-4 md:gap-0">
            <div className="flex justify-between items-start">
              <div className="w-10 h-10 rounded-full bg-tertiary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-tertiary">hub</span>
              </div>
              <span className="text-[10px] uppercase tracking-widest text-secondary font-bold group-hover:text-tertiary transition-colors">01</span>
            </div>
            <div>
              <h3 className="font-headline text-xl md:text-2xl font-bold text-primary mb-2 md:mb-3">Structural Mapping</h3>
              <p className="font-body text-sm text-secondary leading-relaxed font-light">Visualizes dependencies and component relationships instantly, skipping hours of manual auditing.</p>
            </div>
          </div>

          <div className="liquid-glass p-6 md:p-8 rounded-2xl flex flex-col justify-between h-auto md:h-64 group hover:bg-surface-container-lowest/50 gap-4 md:gap-0">
            <div className="flex justify-between items-start">
              <div className="w-10 h-10 rounded-full bg-accent-orange/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-accent-orange">auto_awesome</span>
              </div>
              <span className="text-[10px] uppercase tracking-widest text-secondary font-bold group-hover:text-accent-orange transition-colors">02</span>
            </div>
            <div>
              <h3 className="font-headline text-xl md:text-2xl font-bold text-primary mb-2 md:mb-3">Semantic Analysis</h3>
              <p className="font-body text-sm text-secondary leading-relaxed font-light">Understands the 'why' behind the codebase, identifying core logic patterns across multiple languages.</p>
            </div>
          </div>

          <div className="liquid-glass p-6 md:p-8 rounded-2xl flex flex-col justify-between h-auto md:h-64 group hover:bg-surface-container-lowest/50 gap-4 md:gap-0">
            <div className="flex justify-between items-start">
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary">terminal</span>
              </div>
              <span className="text-[10px] uppercase tracking-widest text-secondary font-bold group-hover:text-primary transition-colors">03</span>
            </div>
            <div>
              <h3 className="font-headline text-xl md:text-2xl font-bold text-primary mb-2 md:mb-3">Zero Config</h3>
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
  const [waking, setWaking] = useState(false);
  
  useEffect(() => {
    const handleWaking = () => setWaking(true);
    window.addEventListener("backend-waking-up", handleWaking);
    return () => window.removeEventListener("backend-waking-up", handleWaking);
  }, []);

  const repoName = repoUrl ? repoUrl.split("/").slice(-2).join("/") : "repository";
  return (
    <div className="bg-background text-on-background font-body antialiased h-[100dvh] overflow-hidden flex flex-col">
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-4 md:px-8 py-3 md:py-4 bg-transparent backdrop-blur-sm md:backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-4 md:gap-8">
            <div className="flex items-center">
                <span className="rexplain-logo text-lg md:text-xl font-extrabold tracking-tighter font-headline">RExplain</span>
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
              
              <div className="space-y-4 md:space-y-6">
                <div className="inline-flex items-center gap-2 md:gap-3 justify-center">
                    <div className="w-6 md:w-8 h-[1px] bg-accent-orange animate-pulse"></div>
                    <span className="text-[8px] md:text-[9px] uppercase tracking-[0.4em] font-bold text-accent-orange animate-pulse">System Insight</span>
                </div>
                <h1 className="text-4xl md:text-5xl font-headline font-extrabold tracking-tight leading-[1.1] text-white animate-breathing">
                  {waking ? "Waking Backend" : "Analyzing"}<br/>Repository
                </h1>
                <p className="text-secondary font-body text-sm md:text-base leading-relaxed font-light max-w-sm mx-auto opacity-80 px-4">
                  {waking ? "Render free tier takes ~50s to wake up. Retrying..." : "Mapping structural architecture and functional logic pathways."}
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
            <p className="text-[10px] text-secondary/30 uppercase tracking-[0.2em] font-bold">© 2026 • RExplain AI Systems</p>
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

  const handleResetChat = () => {
    setMessages([]);
    setInput("");
    setAsking(false);
    setStreaming(false);
    if (esRef.current) {
        esRef.current.close();
    }
  };

  const ask = async () => {
    const q = input.trim();
    // Strict guard: one active request at a time
    if (!q || asking) return;

    // 1. Add exactly ONE user message
    const userMsgId = Date.now();
    setMessages(prev => [...prev, { role: "user", text: q, _id: userMsgId }]);
    setInput("");
    setAsking(true);

    // 2. Always add exactly ONE assistant placeholder
    const placeholderId = userMsgId + 1;
    setMessages(prev => [...prev, {
      role: "assistant", text: "", sources: [], confidence: "medium",
      _streaming: true, _id: placeholderId,
    }]);

    // Helper: resolve the placeholder with a final message
    const resolve = (text, sources = [], confidence = "medium") => {
      setMessages(prev => prev.map(m =>
        m._id === placeholderId
          ? { ...m, text, sources, confidence, _streaming: false, _settled: false }
          : m
      ));
      setAsking(false);
      setStreaming(false);
    };

    const resolveError = (text) => {
      setMessages(prev => prev.map(m =>
        m._id === placeholderId
          ? { role: "error", text, _id: placeholderId }
          : m
      ));
      setAsking(false);
      setStreaming(false);
    };

    // 3. Try streaming first (SSE), fall back to blocking POST
    if (typeof EventSource !== "undefined" && ragReady) {
      setStreaming(true);
      let accText = "";
      console.log("API URL:", API_URL);
      const streamUrl = `${API_URL}/chat/stream?repo_url=${encodeURIComponent(repoUrl)}&question=${encodeURIComponent(q)}`;
      const es = new EventSource(streamUrl);
      esRef.current = es;

      es.onmessage = (e) => {
        const data = e.data;
        if (data === "[DONE]") {
          es.close();
          let finalText = accText;
          try {
            const cleaned = accText.trim().replace(/^```(?:json)?\s*/m, "").replace(/```\s*$/m, "").trim();
            const parsed = JSON.parse(cleaned);
            if (parsed && typeof parsed.answer === "string" && parsed.answer.trim()) {
              finalText = parsed.answer.trim();
            }
          } catch (_) {
            const m = accText.match(/"answer"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
            if (m) finalText = m[1].replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
          }
          // Preserve sources/confidence already set by [META] — only update text + settle flag
          setMessages(prev => prev.map(m =>
            m._id === placeholderId
              ? { ...m, text: finalText, _streaming: false, _settled: false }
              : m
          ));
          setAsking(false);
          setStreaming(false);
          return;
        }
        if (data.startsWith("[META] ")) {
          try {
            const meta = JSON.parse(data.slice(7));
            setMessages(prev => prev.map(m =>
              m._id === placeholderId ? { ...m, sources: meta.sources || [], confidence: meta.confidence || "medium" } : m
            ));
          } catch (_) { }
          return;
        }
        accText += data.replace(/\\n/g, "\n");
        setMessages(prev => prev.map(m =>
          m._id === placeholderId ? { ...m, text: accText } : m
        ));
      };

      es.onerror = async () => {
        es.close();
        if (accText) {
          // Already have partial text — settle it
          resolve(accText);
        } else {
          // SSE failed with nothing — fall back to blocking POST
          try {
            console.log("API URL:", API_URL);
            const res = await axios.post(`${API_URL}/chat/`, { repo_url: repoUrl, question: q });
            console.log("Response:", res.data);
            resolve(res.data.answer, res.data.sources || [], res.data.confidence || "medium");
          } catch (err) {
            console.error("API Error:", err);
            if (err.response) {
              console.error("Backend response:", err.response.data);
            }
            resolveError(err.response?.data?.detail || "Backend not reachable. Try again.");
          }
        }
      };
      return;
    }

    // 4. Non-streaming path (no EventSource or RAG not ready)
    try {
      console.log("API URL:", API_URL);
      const res = await axios.post(`${API_URL}/chat/`, { repo_url: repoUrl, question: q });
      console.log("Response:", res.data);
      resolve(res.data.answer, res.data.sources || [], res.data.confidence || "medium");
    } catch (err) {
      console.error("API Error:", err);
      if (err.response) {
        console.error("Backend response:", err.response.data);
      }
      resolveError(err.response?.data?.detail || "Backend not reachable. Try again.");
    }
  };

  const handleKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } };

  const latestAssistantIdx = messages.reduce((acc, m, i) => m.role === "assistant" ? i : acc, -1);

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%" }} className="bg-white/[0.01]">
      <div className="p-4 md:p-8 pb-3 md:pb-4 flex items-center justify-between border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-2 md:gap-3">
            <button onClick={handleResetChat} title="Reset Chat" className="text-secondary/40 hover:text-white transition-colors flex items-center justify-center p-2 md:p-1 rounded-md hover:bg-white/5 active:scale-95">
                <span className="material-symbols-outlined">refresh</span>
            </button>
            <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-accent-purple/20 flex items-center justify-center ml-1 md:ml-2">
                <span className="material-symbols-outlined text-accent-purple !text-base md:!text-lg">auto_awesome</span>
            </div>
            <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-[0.3em] text-secondary/40">Assistant Core</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-4 md:py-6 space-y-4 md:space-y-6 scroll-hide">
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


        <div ref={bottomRef} />
      </div>

      <div className="p-4 md:p-6 bg-transparent border-t border-white/5 flex-shrink-0 pb-[env(safe-area-inset-bottom,16px)]">
        <div className="relative group">
            <textarea 
              rows={1}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 md:py-4 pl-4 md:pl-5 pr-12 md:pr-14 text-sm focus:outline-none focus:ring-1 focus:ring-accent-purple/30 focus:border-accent-purple/50 transition-all placeholder:text-secondary/30 text-white font-body resize-none overflow-hidden min-h-[48px] max-h-[120px]" 
              placeholder="Ask about architecture..."
              value={input}
              onChange={e => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              onKeyDown={handleKey}
              disabled={asking}
            />
            <button 
              className="absolute right-2 md:right-3 bottom-2 md:top-1/2 md:-translate-y-1/2 w-8 h-8 bg-white text-background rounded-lg flex items-center justify-center hover:bg-accent-purple hover:text-white transition-colors disabled:opacity-50 disabled:bg-white/50 active:scale-95"
              onClick={ask}
              disabled={asking || !input.trim()}
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

  const [splitPct, setSplitPct] = useState(75);
  const [previewFile, setPreviewFile] = useState(null);
  const [diagramView, setDiagramView] = useState("interactive");
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
      // Limits: analysis minimum 45%, chatbot minimum 20%
      setSplitPct(Math.min(80, Math.max(45, pct)));
    };
    const onUp = () => {
      if (dragging.current) {
        dragging.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="bg-background text-on-background font-body antialiased h-[100dvh] overflow-hidden flex flex-col">
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-4 md:px-8 py-3 md:py-4 bg-transparent backdrop-blur-sm md:backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-4 md:gap-8">
            <div className="flex items-center">
                <span className="rexplain-logo text-lg md:text-xl font-extrabold tracking-tighter font-headline">RExplain</span>
            </div>
            <nav className="hidden md:flex items-center gap-8 font-['Manrope'] text-sm tracking-tight font-medium">
                <a className="text-white border-b-2 border-white pb-1" href="#">Analysis</a>
            </nav>
        </div>
        <div className="flex items-center gap-3 md:gap-4">
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-accent-orange/10 border border-accent-orange/20 rounded-full">
                <span className="w-2 h-2 rounded-full bg-accent-orange animate-pulse"></span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-accent-orange">Live Kernel</span>
            </div>
            <button onClick={onReset} className="px-4 md:px-5 py-2 text-[10px] md:text-xs font-bold uppercase tracking-widest hover:text-accent-purple transition-colors duration-200 text-white border border-white/10 md:border-none rounded-lg md:rounded-none bg-white/5 md:bg-transparent active:scale-95">New Analysis</button>
        </div>
      </header>

      <div ref={containerRef} className="flex flex-col md:flex-row flex-1 overflow-hidden" style={{ marginTop: isMobile ? '56px' : '64px' }}>
        {/* Left Side: Analysis Content */}
        <main 
          style={isMobile ? { width: '100%', flex: '55 1 0', overflowY: 'auto' } : { flex: `0 0 ${splitPct}%`, width: `${splitPct}%`, overflowY: 'auto' }} 
          className="bg-transparent scroll-hide border-b md:border-b-0 md:border-r border-white/5"
        >
          <div className="w-full px-4 md:px-6 pt-8 md:pt-20 pb-24 max-w-[100vw] overflow-x-hidden">
            
            {/* Hero Analysis Header */}
            <section className="mb-10 md:mb-16 space-y-3 md:space-y-4 animate-reveal-up">
                <div className="inline-flex items-center gap-2 md:gap-3">
                    <div className="w-6 md:w-8 h-[1px] bg-accent-orange"></div>
                    <span className="text-[8px] md:text-[9px] uppercase tracking-[0.4em] font-bold text-accent-orange">Structural Mapping</span>
                </div>
                <h1 className="text-3xl md:text-5xl font-headline font-extrabold tracking-tight leading-[1.1] text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-white/50 break-words">
                    Repository<br/>Analysis
                </h1>
                <p className="text-secondary font-body text-sm md:text-base leading-relaxed font-light break-words">
                    Breakdown of <a href={repoUrl} target="_blank" rel="noopener noreferrer" className="text-transparent bg-clip-text bg-gradient-to-r from-accent-purple to-accent-orange font-bold border-b border-white/10 pb-[1px] hover:border-accent-purple transition-colors duration-300 break-all">{repoName}</a>. Analyzed in <span className="font-medium text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">{result._elapsed || "~5"}s</span>.
                </p>
            </section>

            {/* Repo Stats */}
            <section className="mb-8 md:mb-12 animate-reveal-up" style={{ animationDelay: '0.2s' }}>
                <div className="liquid-glass p-6 md:p-8 flex flex-col gap-4 md:gap-6 shadow-sm rounded-xl">
                    <div className="space-y-1">
                        <span className="block text-[8px] md:text-[9px] uppercase tracking-[0.3em] text-secondary/40 font-bold">Comprehensive Scan</span>
                        <h2 className="text-3xl md:text-4xl font-headline font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white to-white/60">
                          {scan.total_files?.toLocaleString() || 0} <span className="text-lg md:text-xl font-light text-secondary/40 drop-shadow-none">files</span>
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

            {/* File Types Graph */}
            {langs.length > 0 && (
              <section className="mb-12 animate-reveal-up" style={{ animationDelay: '0.2s' }}>
                  <SectionHeader label="File Distribution" />
                  <div className="liquid-glass p-6 rounded-xl">
                      <FileTypesGraph langs={langs} />
                  </div>
              </section>
            )}

            {/* Tech Stack */}
            <section className="mb-10 md:mb-16 animate-reveal-up" style={{ animationDelay: '0.4s' }}>
                <SectionHeader label="Ecosystem" />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                  {stackItems.map(({ label, value, icon }) => (
                    <div key={label} className="liquid-glass p-5 md:p-6 h-auto sm:h-40 flex sm:flex-col justify-between items-center sm:items-stretch group rounded-xl gap-2 sm:gap-0">
                        <div className="flex sm:justify-between items-center sm:items-start w-full sm:w-auto gap-3 sm:gap-0">
                            <span className="material-symbols-outlined text-secondary/20 group-hover:text-accent-purple transition-colors order-first sm:order-last">{icon}</span>
                            <span className="text-[9px] font-bold uppercase tracking-widest text-secondary/40">{label}</span>
                        </div>
                        <span className="text-xl md:text-2xl font-headline font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white to-white/60 group-hover:from-accent-purple group-hover:to-accent-orange transition-all duration-500 w-full text-right sm:text-left truncate">{value || "Not detected"}</span>
                    </div>
                  ))}
                </div>
            </section>

            {/* System Diagram */}
            <section className="mb-16 animate-reveal-up" style={{ animationDelay: '0.6s' }}>
              {/* Tab header */}
              <div className="flex items-center gap-4 mb-8">
                <div className="flex items-center gap-4 flex-1">
                  <h3 className="text-[9px] uppercase tracking-[0.3em] text-secondary/40 font-bold whitespace-nowrap">System Diagram</h3>
                  <div className="h-[1px] w-full bg-white/5" />
                </div>
                <div className="flex items-center gap-1 bg-white/[0.03] border border-white/5 rounded-lg p-1 flex-shrink-0">
                  <button
                    onClick={() => setDiagramView("interactive")}
                    className={`px-3 py-1.5 rounded text-[9px] font-bold uppercase tracking-widest transition-all ${
                      diagramView === "interactive"
                        ? "bg-accent-purple text-white"
                        : "text-secondary/40 hover:text-white"
                    }`}
                  >
                    Interactive
                  </button>
                  <button
                    onClick={() => setDiagramView("static")}
                    className={`px-3 py-1.5 rounded text-[9px] font-bold uppercase tracking-widest transition-all ${
                      diagramView === "static"
                        ? "bg-white/10 text-white"
                        : "text-secondary/40 hover:text-white"
                    }`}
                  >
                    Classic
                  </button>
                </div>
              </div>

              {diagramView === "interactive" ? (
                <div className="liquid-glass rounded-xl overflow-hidden">
                  <InteractiveDiagram
                    graphData={result.interactive_graph}
                    fallbackData={result}
                    onFileClick={(filePath) => setPreviewFile(filePath)}
                  />
                </div>
              ) : (
                <div className="liquid-glass p-8 rounded-xl overflow-x-auto scroll-hide">
                  <div className="min-w-max md:min-w-0 flex items-center justify-center">
                    {result.diagram ? (
                      <img src={result.diagram} alt="Architecture Diagram" className="max-w-none md:max-w-full h-auto object-contain rounded shadow-lg border border-white/5" />
                    ) : (
                      <div className="flex flex-col items-center gap-3 py-12 opacity-50">
                        <span className="material-symbols-outlined text-3xl text-secondary">schema</span>
                        <p className="text-secondary font-body text-sm font-medium tracking-wide">No system diagram available</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* AI Explanation */}
            <section className="mb-10 md:mb-16 animate-reveal-up" style={{ animationDelay: '0.6s' }}>
              <SectionHeader label="AI Interpretation" />
              <div className="liquid-glass p-6 md:p-8 rounded-xl">
                <p className="text-sm font-body leading-[1.75] text-white mb-5 font-light">{result.ai_explanation}</p>
                {result.folder_explanations && Object.keys(result.folder_explanations).length > 0 && (
                  <div className="flex flex-col gap-3 mb-4">
                    {Object.entries(result.folder_explanations).slice(0, 4).map(([folder, desc]) => {
                      const [label] = desc.split(" — ");
                      return (
                        <div key={folder} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-sm">
                          <code className="w-fit text-[10px] font-bold uppercase tracking-widest bg-white/5 border border-white/10 px-2 py-1 text-white rounded">/{folder}</code>
                          <span className="text-secondary font-light">{label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="flex items-center gap-3 border-t border-white/5 pt-4">
                  <span className="material-symbols-outlined text-secondary/40 text-sm">verified</span>
                  <span className="text-[8px] md:text-[9px] font-bold uppercase tracking-[0.2em] text-secondary/40">Static Analysis • Pattern Detection</span>
                </div>
              </div>
            </section>

            {/* API Routes */}
            {result.api_routes?.length > 0 && (
              <section className="mb-10 md:mb-16 animate-reveal-up" style={{ animationDelay: '0.6s' }}>
                <SectionHeader label={`API Surface · ${result.api_routes.length} routes`} />
                <div className="flex flex-col gap-2">
                  {result.api_routes.slice(0, 10).map((route, i) => {
                    const [method, ...rest] = route.split(" ");
                    const cls = methodBg(method);
                    return (
                      <div key={i} className="liquid-glass p-3 md:p-4 rounded-lg flex items-center gap-3 md:gap-4 overflow-hidden">
                        <span className={`flex-shrink-0 text-[8px] md:text-[9px] font-headline font-bold uppercase tracking-widest px-2 md:px-3 py-1 rounded border ${cls} min-w-[48px] md:min-w-[54px] text-center`}>
                          {method}
                        </span>
                        <code className="text-xs md:text-sm text-secondary font-mono truncate">{rest.join(" ")}</code>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Key Files */}
            {result.important_files?.length > 0 && (
              <section className="mb-10 md:mb-16 animate-reveal-up" style={{ animationDelay: '0.6s' }}>
                  <SectionHeader label="Core Entry Points" />
                  <div className="space-y-3">
                    {result.important_files.slice(0, 6).map((file, i) => {
                      const name = file.split("/").pop();
                      const icon = name.includes("Dockerfile") ? "deployed_code" : file.startsWith(".github") ? "hub" : name.endsWith(".json") ? "data_object" : name.endsWith(".py") ? "terminal" : "description";
                      return (
                        <div key={i} onClick={() => setPreviewFile(file)} className="group liquid-glass p-4 md:p-5 rounded-xl flex justify-between items-center hover:bg-white/[0.05] transition-all cursor-pointer">
                            <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
                                <div className="flex-shrink-0 w-8 h-8 md:w-10 md:h-10 flex items-center justify-center bg-white/5 group-hover:bg-accent-purple transition-colors rounded-lg">
                                    <span className="material-symbols-outlined text-secondary/40 group-hover:text-white text-sm md:text-base">{icon}</span>
                                </div>
                                <div className="flex flex-col overflow-hidden">
                                    <span className="text-sm font-bold font-headline tracking-tight text-white truncate">{name}</span>
                                    <span className="text-[9px] md:text-[10px] text-secondary/40 font-medium uppercase tracking-wider truncate">{file}</span>
                                </div>
                            </div>
                            <span className="material-symbols-outlined text-secondary/20 group-hover:text-accent-orange transition-all flex-shrink-0 ml-2">arrow_forward</span>
                        </div>
                      )
                    })}
                  </div>
              </section>
            )}

            {previewFile && <FilePreviewModal repoUrl={repoUrl} filePath={previewFile} onClose={() => setPreviewFile(null)} />}

            {/* Commit Activity */}
            {result.metadata?.commits?.length > 0 && (
              <section className="mb-10 md:mb-16 animate-reveal-up" style={{ animationDelay: '0.6s' }}>
                <SectionHeader label={`Commit Activity · ${result.metadata.total_commits || result.metadata.commits.length} commits`} />
                <div className="liquid-glass p-4 md:p-6 rounded-xl">
                  <CommitGraph commits={result.metadata.commits} />
                  <div className="mt-4 md:mt-6 flex flex-col gap-3">
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
              <section className="mb-10 md:mb-16 animate-reveal-up" style={{ animationDelay: '0.6s' }}>
                <SectionHeader label="Entry Points" />
                <div className="flex flex-wrap gap-2">
                  {result.entry_points.map(ep => (
                    <div key={ep} onClick={() => setPreviewFile(ep)}
                      className="liquid-glass px-3 md:px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer hover:bg-white/5 transition-colors">
                      <span className="material-symbols-outlined text-accent-purple !text-sm md:!text-base">play_circle</span>
                      <span className="text-xs md:text-sm font-medium text-white font-body truncate">{ep}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* README */}
            {result.readme && (
              <section className="mb-10 md:mb-16 animate-reveal-up" style={{ animationDelay: '0.6s' }}>
                <SectionHeader label="README · Documentation" />
                <div className="liquid-glass p-4 md:p-8 rounded-xl overflow-x-auto">
                  <div className="readme-prose max-w-none text-sm md:text-base">
                    <ReactMarkdown>{result.readme}</ReactMarkdown>
                  </div>
                </div>
              </section>
            )}

            {/* Footer (Mini) */}
            <footer className="pt-12 text-center bg-transparent">
                <p className="text-[10px] text-secondary/30 uppercase tracking-[0.2em] font-bold">© 2026 • RExplain AI Systems</p>
            </footer>

          </div>
        </main>

        {/* DIVIDER */}
        {!isMobile && (
            <div
            onMouseDown={onDividerDown}
            className="w-1.5 flex-shrink-0 cursor-col-resize flex items-center justify-center z-10 transition-colors hover:bg-white/5"
            >
            <div className="w-0.5 h-10 rounded-full bg-white/10 pointer-events-none" />
            </div>
        )}

        {/* Right Side: AI Chat */}
        <aside style={isMobile ? { width: '100%', flex: '1 1 auto', height: '50vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' } : { flex: `0 0 ${100 - splitPct}%`, width: `${100 - splitPct}%`, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <ChatSidebar repoUrl={result.repo_url || repoUrl} ragReady={result.rag_ready} />
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
  const [healthStatus, setHealthStatus] = useState("Checking backend...");

  useEffect(() => {
    (async () => {
      // Retry up to 3 times with 3s gap — Render sometimes needs a moment after wake
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await axios.get(`${API_URL}/health`, { timeout: 8000 });
          if (res.data.status === "ok") {
            setHealthStatus("Backend connected");
            return;
          }
        } catch (_) {
          if (attempt < 2) await new Promise(r => setTimeout(r, 3000));
        }
      }
      setHealthStatus("Backend offline");
    })();
  }, []);

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
      console.log("API URL:", API_URL);
      const res = await axios.post(`${API_URL}/analyze/`, { repo_url: repoUrl.trim() }, {
        timeout: 180000,  // 3 min — analysis can take ~90s on cold Render start
      });
      console.log("Response:", res.data);
      setResult({ ...res.data, _elapsed: ((Date.now() - t0) / 1000).toFixed(1) });
    } catch (err) {
      console.error("API Error:", err);
      if (err.response) {
        console.error("Backend response:", err.response.data);
      }
      setError(
        err.response?.data?.detail ||
        "Backend not reachable. Try again."
      );
    }
    setLoading(false);
  };

  const reset = () => { setResult(null); setError(null); };

  if (loading) return <LoadingState repoUrl={repoUrl} />;
  if (result) return <AnalysisView result={result} repoUrl={repoUrl} onReset={reset} theme={theme} toggleTheme={toggleTheme} />;
  return <LandingPage repoUrl={repoUrl} setRepoUrl={setRepoUrl} onAnalyze={analyze} loading={loading} error={error} theme={theme} toggleTheme={toggleTheme} healthStatus={healthStatus} />;
}