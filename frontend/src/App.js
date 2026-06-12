import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import { LineChart, Line, BarChart, Bar, YAxis, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import InteractiveDiagram from "./InteractiveDiagram";
import VantaBackground from "./VantaBackground";
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
    <footer className="border-t border-outline py-16 px-8 bg-stone-100/50 backdrop-blur-sm">
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
    GET: "text-green-400 bg-green-400/10 border-green-400/20",
    POST: "text-blue-400 bg-blue-400/10 border-blue-400/20",
    PUT: "text-orange-400 bg-orange-400/10 border-orange-400/20",
    PATCH: "text-purple-400 bg-purple-400/10 border-purple-400/20",
    DELETE: "text-red-400 bg-red-400/10 border-red-400/20",
    HEAD: "text-secondary bg-white/5 border-white/10",
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
      <div className="bg-surface-container-lowest w-full max-w-4xl max-h-full rounded-2xl overflow-hidden flex flex-col shadow-[0_20px_40px_rgba(0,0,0,0.1)] border border-outline" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center px-6 py-4 border-b border-outline bg-primary/[0.02]">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-secondary !text-lg">description</span>
            <span className="text-primary font-body font-semibold text-sm">{filePath}</span>
          </div>
          <button onClick={onClose} className="bg-transparent border-none text-secondary hover:text-primary transition-colors cursor-pointer flex items-center">
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

  // Use only the latest 30 commits (most recent activity)
  const recent = [...commits].slice(0, 30);

  // Group by date for granularity (30 commits = individual days)
  const dataMap = {};
  recent.forEach(c => {
    if (!c.date) return;
    const d = new Date(c.date);
    if (isNaN(d)) return;
    const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const ts = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    dataMap[ts] = { date: key, count: (dataMap[ts]?.count || 0) + 1 };
  });

  // Sort chronologically
  const data = Object.keys(dataMap)
    .sort((a, b) => Number(a) - Number(b))
    .map(k => dataMap[k]);

  if (data.length === 0) return null;

  return (
    <div className="h-[220px] w-full mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <XAxis dataKey="date" stroke="#d1d5db" fontSize={9} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis stroke="#d1d5db" fontSize={9} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: "#ffffff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 10, color: "#111827", fontSize: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}
            itemStyle={{ color: "#a855f7" }}
            formatter={(val) => [val, 'Commits']}
          />
          <Line type="monotone" dataKey="count" stroke="#a855f7" strokeWidth={2.5} dot={{ r: 3, fill: "#a855f7" }} activeDot={{ r: 5, fill: "#a855f7" }} />
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
            contentStyle={{ background: "#ffffff", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 8, color: "#111827", fontSize: 12 }}
            itemStyle={{ color: "#a855f7" }}
            cursor={{ fill: "rgba(0,0,0,0.05)" }}
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
    <div className="text-on-background font-body selection:bg-accent-purple/20 selection:text-primary antialiased min-h-[100dvh] relative" style={{ background: 'transparent' }}>
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-4 md:px-8 py-4 md:py-6 bg-white/60 backdrop-blur-md border-b border-outline">
        <div className="flex items-center gap-4 md:gap-12">
          <div className="flex items-center">
            <span className="text-xl font-extrabold tracking-tighter font-headline text-primary">RExplain</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 font-['Manrope'] text-sm tracking-tight font-semibold text-secondary">
          </nav>
        </div>
        <div>
        </div>
      </header>

      <main className="pt-32 md:pt-40 flex flex-col items-center justify-center px-4 md:px-6 relative z-10 overflow-hidden">
        <div className="w-full max-w-5xl text-center mb-12 md:mb-16 relative z-10 flex flex-col items-center">
          <div className="mb-8 inline-flex items-center gap-2 px-3 py-1">
          </div>

          <h1 className="font-headline font-extrabold mb-4 md:mb-6 leading-[0.95] tracking-tighter liquid-glass-text animate-reveal-up" style={{ fontSize: "clamp(4.5rem, 14vw, 10rem)", animationDelay: '0.1s' }}>
            RExplain
          </h1>

          <p className="font-headline font-extrabold text-primary mb-6 md:mb-8 leading-[1.05] tracking-tight animate-reveal-up" style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", animationDelay: '0.2s' }}>
            Unfold the complexity of any GitHub repository<br />with <span className="italic font-light text-primary">clarity </span>and <span className="text-accent-orange">intent.</span>
          </p>
        </div>

        <div className="w-full max-w-3xl relative group mb-16 md:mb-32 animate-reveal-up z-10" style={{ animationDelay: '0.2s' }}>
          <div className="relative flex flex-col md:flex-row items-center bg-white rounded-[28px] md:rounded-2xl p-2 md:pl-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] gap-2 md:gap-0 z-10">
            {/* Animated Fluid Glow - Toned down for readability */}
            <div className="absolute -inset-1 bg-gradient-to-r from-purple-500/60 via-orange-500/60 to-purple-500/60 rounded-[32px] md:rounded-[20px] blur-md opacity-30 group-hover:opacity-60 transition duration-1000 group-hover:duration-300 animate-shine bg-[length:200%_auto] -z-10 pointer-events-none"></div>
            
            <div className="flex w-full items-center pl-4 md:pl-0">
              <span className="text-gray-400 font-body text-base md:text-lg whitespace-nowrap hidden sm:inline">github.com/</span>
              <input
                className="w-full bg-transparent border-none text-gray-800 focus:outline-none focus:ring-0 font-body text-base md:text-lg py-4 pl-1"
                placeholder="username/repo_name"
                type="text"
                value={repoUrl}
                onChange={e => {
                  let val = e.target.value;
                  val = val.replace(/^(https?:\/\/)?(www\.)?github\.com\//i, '');
                  setRepoUrl(val);
                }}
                onKeyDown={handleKey}
                disabled={loading}
              />
            </div>
            <button
              className="w-full md:w-auto md:ml-4 bg-gradient-to-r from-purple-500/90 to-orange-500/90 text-white px-8 py-3.5 rounded-[20px] md:rounded-xl font-headline font-bold text-[11px] uppercase tracking-[0.2em] hover:opacity-100 hover:scale-[1.02] transition-all flex items-center justify-center gap-2 disabled:opacity-50 drop-shadow-md"
              onClick={onAnalyze}
              disabled={loading || !repoUrl.trim()}
            >
              <span>Explain</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>
          {error && (
            <div className="mt-6 p-4 rounded-xl text-red-500 text-sm font-body border border-red-500/20 bg-red-500/5 text-center">
              ⚠️ {error}
            </div>
          )}

        </div>

        {/* Feature Grid */}
        <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10 animate-reveal-up px-4 mb-20 md:mb-32" style={{ animationDelay: '0.4s' }}>
          <div className="bg-[#0B1120] p-6 md:p-8 rounded-[2rem] flex flex-col justify-between h-auto md:h-80 group gap-6 md:gap-0 relative overflow-hidden border border-accent-orange/20 hover:border-accent-orange/50 hover:shadow-[0_8px_32px_rgba(249,115,22,0.15)] transition-all duration-300">
            <div className="flex justify-between items-start z-10">
              <div>
                <span className="text-[9px] uppercase tracking-[0.3em] text-accent-orange font-bold mb-2 block">System Intelligence</span>
                <h3 className="font-headline text-2xl md:text-3xl font-bold text-white leading-tight">Instant Architecture<br />Mapping</h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-accent-orange/10 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-accent-orange">account_tree</span>
              </div>
            </div>
            <p className="font-body text-sm text-gray-400 leading-relaxed font-light z-10 max-w-[85%] mt-4 md:mt-0">Visualize the skeleton of your project. We parse every connection, dependency, and flow to generate a living map of your codebase.</p>
          </div>

          <div className="bg-[#0B1120] p-6 md:p-8 rounded-[2rem] flex flex-col justify-between h-auto md:h-80 group gap-6 md:gap-0 relative overflow-hidden border border-accent-purple/20 hover:border-accent-purple/50 hover:shadow-[0_8px_32px_rgba(168,85,247,0.15)] transition-all duration-300">
            <div className="flex justify-between items-start z-10">
              <div>
                <span className="text-[9px] uppercase tracking-[0.3em] text-accent-purple font-bold mb-2 block">Cognitive Parsing</span>
                <h3 className="font-headline text-2xl md:text-3xl font-bold text-white leading-tight">Deep Semantics</h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-accent-purple/10 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-accent-purple">psychology</span>
              </div>
            </div>
            <p className="font-body text-sm text-gray-400 leading-relaxed font-light z-10 max-w-[85%] mt-4 md:mt-0">Beyond syntax. RExplain understands the developer's intent, surfacing the "why" behind the logic patterns and structural choices.</p>
          </div>

          <div className="bg-[#0B1120] p-6 md:p-8 rounded-[2rem] flex flex-col justify-between h-auto md:h-80 group gap-6 md:gap-0 relative overflow-hidden border border-white/5 hover:border-white/20 hover:shadow-[0_8px_32px_rgba(255,255,255,0.05)] transition-all duration-300">
            <div className="flex justify-between items-start z-10">
              <div>
                <span className="text-[9px] uppercase tracking-[0.3em] text-white font-bold mb-2 block">Zero Config</span>
                <h3 className="font-headline text-2xl md:text-3xl font-bold text-white leading-tight">Instant Access</h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-white">terminal</span>
              </div>
            </div>
            <p className="font-body text-sm text-gray-400 leading-relaxed font-light z-10 max-w-[85%] mt-4 md:mt-0">Paste a URL and explore. No installation, no complex setup required. Just immediate architectural insight.</p>
          </div>
        </div>

        {/* Fun Use Cases Section */}
        <div className="w-full max-w-6xl mt-12 md:mt-20 mb-20 md:mb-32 relative z-10 px-4 animate-reveal-up" style={{ animationDelay: '0.6s' }}>
          <div className="text-center mb-16 relative z-10">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent-orange mb-4 block">Why RExplain</span>
            <h2 className="font-headline text-3xl md:text-5xl font-extrabold text-black mb-6">Built for every dev workflow</h2>
            <p className="text-secondary/80 font-body text-base md:text-lg">One URL. Instant architectural clarity no setup, no noise.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Bluff */}
            <div className="bg-[#0B1120] p-6 rounded-[2rem] flex flex-col relative overflow-hidden border border-white/5 hover:border-purple-500/80 hover:shadow-[0_8px_32px_rgba(168,85,247,0.4)] transition-all duration-500 animate-reveal-up group" style={{ animationDelay: '0.6s', animationFillMode: 'both' }}>
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600/30 to-purple-900/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
              <div className="flex items-center gap-4 mb-4 relative z-10">
                <div className="w-10 h-10 rounded-full bg-accent-purple/10 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-accent-purple animate-[spin_4s_linear_infinite]">psychology_alt</span>
                </div>
                <h3 className="font-headline text-lg font-bold text-white leading-tight">The "I Totally Read the Codebase" Bluff</h3>
              </div>
              <p className="font-body text-sm text-gray-400 leading-relaxed font-light relative z-10">Drop a 50k-line repo into RExplain and instantly act like you've studied it for weeks. Become the 10x engineer on day one.</p>
            </div>
            {/* Spaghetti */}
            <div className="bg-[#0B1120] p-6 rounded-[2rem] flex flex-col relative overflow-hidden border border-white/5 hover:border-orange-500/80 hover:shadow-[0_8px_32px_rgba(249,115,22,0.4)] transition-all duration-500 animate-reveal-up group" style={{ animationDelay: '0.7s', animationFillMode: 'both' }}>
              <div className="absolute inset-0 bg-gradient-to-br from-orange-600/30 to-orange-900/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
              <div className="flex items-center gap-4 mb-4 relative z-10">
                <div className="w-10 h-10 rounded-full bg-accent-orange/10 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-accent-orange animate-bounce">route</span>
                </div>
                <h3 className="font-headline text-lg font-bold text-white leading-tight">The Spaghetti Code Autopsy</h3>
              </div>
              <p className="font-body text-sm text-gray-400 leading-relaxed font-light relative z-10">Untangle that open-source project where 40 files import each other. RExplain is your X-Ray machine for pasta code.</p>
            </div>
            {/* Roast */}
            <div className="bg-[#0B1120] p-6 rounded-[2rem] flex flex-col relative overflow-hidden border border-white/5 hover:border-red-500/80 hover:shadow-[0_8px_32px_rgba(239,68,68,0.4)] transition-all duration-500 animate-reveal-up group" style={{ animationDelay: '0.8s', animationFillMode: 'both' }}>
              <div className="absolute inset-0 bg-gradient-to-br from-red-600/30 to-red-900/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
              <div className="flex items-center gap-4 mb-4 relative z-10">
                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-red-500 animate-pulse">local_fire_department</span>
                </div>
                <h3 className="font-headline text-lg font-bold text-white leading-tight">"Roast My Architecture"</h3>
              </div>
              <p className="font-body text-sm text-gray-400 leading-relaxed font-light relative z-10">Paste your friend's repo and instantly ask the AI to find their most questionable architectural decisions. Absolute chaos ensues.</p>
            </div>
            {/* Vibe Coded */}
            <div className="bg-[#0B1120] p-6 rounded-[2rem] flex flex-col relative overflow-hidden border border-white/5 hover:border-green-400/80 hover:shadow-[0_8px_32px_rgba(74,222,128,0.4)] transition-all duration-500 animate-reveal-up group" style={{ animationDelay: '0.9s', animationFillMode: 'both' }}>
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/30 to-green-900/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
              <div className="flex items-center gap-4 mb-4 relative z-10">
                <div className="w-10 h-10 rounded-full bg-green-400/10 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-green-400 animate-[bounce_3s_infinite]">quiz</span>
                </div>
                <h3 className="font-headline text-lg font-bold text-white leading-tight">The "Vibe Coded" Interview Panic</h3>
              </div>
              <p className="font-body text-sm text-gray-400 leading-relaxed font-light relative z-10">You just vibe-coded an entire project with AI, and now the interviewer is grilling you on it. Paste it in and let RExplain save your career.</p>
            </div>
            {/* Hackathon */}
            <div className="bg-[#0B1120] p-6 rounded-[2rem] flex flex-col relative overflow-hidden border border-white/5 hover:border-yellow-400/80 hover:shadow-[0_8px_32px_rgba(250,204,21,0.4)] transition-all duration-500 animate-reveal-up group" style={{ animationDelay: '1.0s', animationFillMode: 'both' }}>
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/30 to-yellow-900/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
              <div className="flex items-center gap-4 mb-4 relative z-10">
                <div className="w-10 h-10 rounded-full bg-yellow-400/10 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-yellow-400 animate-[spin_3s_linear_infinite]">local_pizza</span>
                </div>
                <h3 className="font-headline text-lg font-bold text-white leading-tight">The 3 AM Hackathon Savior</h3>
              </div>
              <p className="font-body text-sm text-gray-400 leading-relaxed font-light relative z-10">When nobody has the brain cells left to read a library's source code at 3 AM. Throw it in and beg the AI to explain the WebSockets.</p>
            </div>
            {/* Tourism */}
            <div className="bg-[#0B1120] p-6 rounded-[2rem] flex flex-col relative overflow-hidden border border-white/5 hover:border-blue-400/80 hover:shadow-[0_8px_32px_rgba(96,165,250,0.4)] transition-all duration-500 animate-reveal-up group" style={{ animationDelay: '1.1s', animationFillMode: 'both' }}>
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600/30 to-blue-900/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
              <div className="flex items-center gap-4 mb-4 relative z-10">
                <div className="w-10 h-10 rounded-full bg-blue-400/10 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-blue-400 animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]">flight_takeoff</span>
                </div>
                <h3 className="font-headline text-lg font-bold text-white leading-tight">Architectural Tourism</h3>
              </div>
              <p className="font-body text-sm text-gray-400 leading-relaxed font-light relative z-10">Take a VIP helicopter tour over React or FastAPI's architecture without actually reading 100,000 lines of code.</p>
            </div>
          </div>
        </div>

      </main>

      <footer className="relative z-10 bg-[#0B1120] border-t border-white/5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8 py-12 px-8">
          <div className="flex items-center gap-6">
            <span className="text-lg font-extrabold tracking-tighter font-headline text-white">RExplain</span>
            <a
              href="https://github.com/swaekaa/rexplain"
              target="_blank"
              rel="noopener noreferrer"
              className="font-body text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 hover:text-white transition-colors flex items-center gap-1"
            >
              GitHub
              <span className="material-symbols-outlined !text-[12px]">open_in_new</span>
            </a>
          </div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
            © 2026 RExplain AI. Architectural Intelligence.
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
    <div className="text-on-background font-body antialiased h-[100dvh] overflow-hidden flex flex-col" style={{ background: 'transparent' }}>
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-4 md:px-8 py-3 md:py-4 bg-transparent backdrop-blur-sm md:backdrop-blur-md border-b border-outline">
        <div className="flex items-center gap-4 md:gap-8">
          <div className="flex items-center">
            <span className="rexplain-logo text-lg md:text-xl font-extrabold tracking-tighter font-headline text-primary">RExplain</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 font-['Manrope'] text-sm tracking-tight font-medium">
            <a className="text-primary border-b-2 border-primary pb-1" href="#">Analysis</a>
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
                <h1 className="text-4xl md:text-5xl font-headline font-extrabold tracking-tight leading-[1.1] text-primary animate-breathing">
                  {waking ? "Waking Backend" : "Analyzing"}<br />Repository
                </h1>
                <p className="text-secondary font-body text-sm md:text-base leading-relaxed font-light max-w-sm mx-auto opacity-80 px-4">
                  {waking ? "Render free tier takes ~50s to wake up. Retrying..." : "Mapping structural architecture and functional logic pathways."}
                </p>
              </div>
            </div>
          </div>

          <div className="w-64 h-[1px] bg-primary/10 overflow-hidden relative mb-16">
            <div className="absolute inset-0 w-1/3 h-full bg-accent-purple animate-shimmer"></div>
          </div>

          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="liquid-glass p-6 h-32 flex flex-col justify-between rounded-xl group shadow-sm border border-outline/50">
              <div className="flex justify-between items-start">
                <span className="text-[9px] font-bold uppercase tracking-widest text-secondary/60">Repository</span>
                <span className="material-symbols-outlined text-secondary/40 group-hover:text-accent-purple transition-colors">folder</span>
              </div>
              <span className="text-2xl font-headline font-bold tracking-tight text-primary truncate">{repoName}</span>
            </div>
            <div className="liquid-glass p-6 h-32 flex flex-col justify-between rounded-xl group shadow-sm border border-outline/50">
              <div className="flex justify-between items-start">
                <span className="text-[9px] font-bold uppercase tracking-widest text-secondary/60">Source</span>
                <span className="material-symbols-outlined text-secondary/40 group-hover:text-accent-purple transition-colors">cloud</span>
              </div>
              <span className="text-2xl font-headline font-bold tracking-tight text-primary truncate">GitHub URL</span>
            </div>
          </div>
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
    high: { bg: "bg-green-400/10", border: "border-green-400/20", color: "text-primary", dot: "bg-green-400", label: "High confidence" },
    medium: { bg: "bg-yellow-400/10", border: "border-yellow-400/20", color: "text-primary", dot: "bg-yellow-400", label: "Medium confidence" },
    low: { bg: "bg-red-400/10", border: "border-red-400/20", color: "text-primary", dot: "bg-red-400", label: "Low confidence" },
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
      className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-outline bg-primary/5 hover:bg-accent-purple/10 hover:border-accent-purple/40 hover:text-accent-purple transition-all cursor-pointer group"
    >
      <span className="material-symbols-outlined !text-[10px] text-primary group-hover:text-accent-purple transition-colors">description</span>
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
      <span className="whitespace-pre-wrap break-words text-primary font-medium">{text}</span>
      {showCursor && (
        <span className="inline-block w-0.5 h-[0.9em] bg-primary/50 ml-0.5 align-text-bottom animate-breathing" />
      )}
      {footerVisible && (
        <div className="mt-3 flex flex-wrap gap-1.5 items-center border-t border-outline pt-2.5">
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
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "transparent" }}>
      <div className="p-4 md:p-8 pb-3 md:pb-4 flex items-center justify-between border-b border-outline flex-shrink-0">
        <div className="flex items-center gap-2 md:gap-3">
          <button onClick={handleResetChat} title="Reset Chat" className="text-secondary/40 hover:text-primary transition-colors flex items-center justify-center p-2 md:p-1 rounded-md hover:bg-primary/5 active:scale-95">
            <span className="material-symbols-outlined">refresh</span>
          </button>
          <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-accent-purple/20 flex items-center justify-center ml-1 md:ml-2">
            <span className="material-symbols-outlined text-accent-purple !text-base md:!text-lg">auto_awesome</span>
          </div>
          <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-[0.3em] text-primary">Assistant Core</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-4 md:py-6 space-y-4 md:space-y-6 scroll-hide">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 opacity-70">
            <span className="material-symbols-outlined text-3xl text-primary">forum</span>
            <p className="text-xs text-primary text-center max-w-[200px] font-body leading-relaxed font-medium">
              Ask about files, functions, frameworks, API routes, or architecture.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={msg._id ?? i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === "user" && (
              <div className="p-4 rounded-xl max-w-[85%] bg-primary/5 backdrop-blur-md border border-outline text-primary font-body text-sm leading-relaxed">
                {msg.text}
              </div>
            )}
            {msg.role === "assistant" && (
              <div className="p-4 rounded-xl max-w-[85%] bg-accent-purple/10 border border-accent-purple/60 backdrop-blur-md text-primary font-body text-sm leading-relaxed shadow-sm">
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

      <div className="p-4 md:p-6 bg-transparent border-t border-outline flex-shrink-0 pb-[env(safe-area-inset-bottom,16px)]">
        <div className="relative group">
          <textarea
            rows={1}
            className="w-full bg-primary/5 border border-outline rounded-xl py-3 md:py-4 pl-4 md:pl-5 pr-12 md:pr-14 text-sm focus:outline-none focus:ring-1 focus:ring-accent-purple/30 focus:border-accent-purple/50 transition-all placeholder:text-primary/70 text-primary font-body resize-none overflow-hidden min-h-[48px] max-h-[120px]"
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
            className="absolute right-2 md:right-3 bottom-2 md:top-1/2 md:-translate-y-1/2 w-8 h-8 bg-primary text-background rounded-lg flex items-center justify-center hover:bg-accent-purple hover:text-white transition-colors disabled:opacity-50 disabled:bg-primary/50 active:scale-95"
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
  const commits = result.metadata?.commits || [];
  const repoName = repoUrl.replace("https://github.com/", "").replace("http://github.com/", "");
  const stackItems = [
    { label: "Backend", value: fw.backend_framework, icon: "terminal" },
    { label: "Frontend", value: fw.frontend_framework, icon: "web_asset" },
    { label: "Database", value: fw.database, icon: "database" },
  ];

  const [splitPct, setSplitPct] = useState(60);
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
  const [chatOpen, setChatOpen] = useState(false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close chat drawer when switching to desktop
  useEffect(() => { if (!isMobile) setChatOpen(false); }, [isMobile]);

  return (
    <div className="text-on-background font-body antialiased h-[100dvh] overflow-hidden flex flex-col" style={{ background: 'transparent' }}>
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-4 md:px-8 py-3 md:py-4 bg-transparent backdrop-blur-sm md:backdrop-blur-md border-b border-outline">
        <div className="flex items-center gap-4 md:gap-8">
          <div className="flex items-center">
            <span className="rexplain-logo text-lg md:text-xl font-extrabold tracking-tighter font-headline text-primary">RExplain</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 font-['Manrope'] text-sm tracking-tight font-medium">
            <a className="text-primary border-b-2 border-primary pb-1" href="#">Analysis</a>
          </nav>
        </div>
        <div className="flex items-center gap-3 md:gap-4">
          <button onClick={onReset} className="px-4 md:px-5 py-2 text-[10px] md:text-xs font-bold uppercase tracking-widest hover:text-accent-purple transition-colors duration-200 text-primary border border-outline md:border-none rounded-lg md:rounded-none bg-primary/5 md:bg-transparent active:scale-95">New Analysis</button>
        </div>
      </header>

      <div ref={containerRef} className="flex flex-col md:flex-row flex-1 overflow-hidden" style={{ marginTop: isMobile ? '56px' : '64px' }}>
        {/* Left Side: Analysis Content */}
        <main
          style={isMobile
            ? { width: '100%', flex: '1 1 0', overflowY: 'auto' }
            : { flex: `0 0 ${splitPct}%`, width: `${splitPct}%`, overflowY: 'auto' }}
          className="scroll-hide md:border-r border-outline/40"
        >
          <div className="w-full px-4 md:px-6 pt-8 md:pt-20 pb-28 md:pb-24 max-w-[100vw] overflow-x-hidden">

            {/* Hero Analysis Header */}
            <section className="mb-10 md:mb-16 space-y-3 md:space-y-4 animate-reveal-up">
              <div className="inline-flex items-center gap-2 md:gap-3">
                <div className="w-6 md:w-8 h-[1px] bg-accent-orange"></div>
                <span className="text-[8px] md:text-[9px] uppercase tracking-[0.4em] font-bold text-accent-orange">Structural Mapping</span>
              </div>
              <h1 className="text-3xl md:text-5xl font-headline font-extrabold tracking-tight leading-[1.1] text-primary break-words">
                Repository<br />Analysis
              </h1>
              <p className="text-primary font-body text-sm md:text-base leading-relaxed font-light break-words">
                Breakdown of <a href={repoUrl} target="_blank" rel="noopener noreferrer" className="text-transparent bg-clip-text bg-gradient-to-r from-accent-purple to-accent-orange font-bold border-b border-outline pb-[1px] hover:border-accent-purple transition-colors duration-300 break-all">{repoName}</a>. Analyzed in <span className="font-medium text-primary drop-shadow-none">{result._elapsed || "~5"}s</span>.
              </p>
            </section>

            {/* Repo Stats */}
            <section className="mb-8 md:mb-12 animate-reveal-up" style={{ animationDelay: '0.2s' }}>
              <div className="liquid-glass p-6 md:p-8 flex flex-col gap-4 md:gap-6 shadow-sm rounded-xl">
                <div className="space-y-1">
                  <span className="block text-[8px] md:text-[9px] uppercase tracking-[0.3em] text-secondary/60 font-bold">Comprehensive Scan</span>
                  <h2 className="text-3xl md:text-4xl font-headline font-bold tracking-tight text-primary">
                    {scan.total_files?.toLocaleString() || 0} <span className="text-lg md:text-xl font-light text-secondary/60 drop-shadow-none">files</span>
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {langs.map(([ext, count]) => (
                    <span key={ext} className="px-4 py-1.5 bg-primary/5 border border-outline text-secondary text-[9px] font-bold tracking-[0.1em] uppercase">
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

            {/* Commit Activity Graph */}
            <section className="mb-12 animate-reveal-up" style={{ animationDelay: '0.3s' }}>
              <SectionHeader label="Commit Activity" />
              <div className="liquid-glass p-6 rounded-xl">
                {commits && commits.length > 0 ? (
                  <CommitGraph commits={commits} />
                ) : (
                  <div className="flex flex-col items-center gap-2 py-8 opacity-50">
                    <span className="material-symbols-outlined text-3xl text-secondary">commit</span>
                    <p className="text-secondary font-body text-sm">Re-analyze to load commit history</p>
                  </div>
                )}
              </div>
            </section>

            {/* Tech Stack */}
            <section className="mb-10 md:mb-16 animate-reveal-up" style={{ animationDelay: '0.4s' }}>
              <SectionHeader label="Ecosystem" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                {stackItems.map(({ label, value, icon }) => (
                  <div key={label} className="liquid-glass p-5 md:p-6 h-auto sm:h-40 flex sm:flex-col justify-between items-center sm:items-stretch group rounded-xl gap-2 sm:gap-0">
                    <div className="flex sm:justify-between items-center sm:items-start w-full sm:w-auto gap-3 sm:gap-0">
                      <span className="material-symbols-outlined text-secondary/40 group-hover:text-accent-purple transition-colors order-first sm:order-last">{icon}</span>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-secondary/60">{label}</span>
                    </div>
                    <span className="text-xl md:text-2xl font-headline font-bold tracking-tight text-primary group-hover:text-accent-purple transition-all duration-300 w-full text-right sm:text-left truncate">{value || "Not detected"}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* System Diagram */}
            <section className="mb-16 animate-reveal-up" style={{ animationDelay: '0.6s' }}>
              {/* Tab header */}
              <div className="flex items-center gap-4 mb-8">
                <div className="flex items-center gap-4 flex-1">
                  <h3 className="text-[9px] uppercase tracking-[0.3em] text-secondary/60 font-bold whitespace-nowrap">System Diagram</h3>
                  <div className="h-[1px] w-full bg-outline" />
                </div>
                <div className="flex items-center gap-1 bg-primary/5 border border-outline rounded-lg p-1 flex-shrink-0">
                  <button
                    onClick={() => setDiagramView("interactive")}
                    className={`px-3 py-1.5 rounded text-[9px] font-bold uppercase tracking-widest transition-all ${diagramView === "interactive"
                        ? "bg-accent-purple text-white"
                        : "text-secondary/40 hover:text-primary"
                      }`}
                  >
                    Interactive
                  </button>
                  <button
                    onClick={() => setDiagramView("static")}
                    className={`px-3 py-1.5 rounded text-[9px] font-bold uppercase tracking-widest transition-all ${diagramView === "static"
                        ? "bg-primary/10 text-primary"
                        : "text-secondary/40 hover:text-primary"
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
                <div className="rounded-xl overflow-x-auto scroll-hide" style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.07)', padding: '2rem' }}>
                  <div className="min-w-max md:min-w-0 flex items-center justify-center" style={{ background: '#ffffff' }}>
                    {result.diagram ? (
                      <img src={result.diagram} alt="Architecture Diagram" className="max-w-none md:max-w-full h-auto object-contain rounded" style={{ background: '#ffffff', display: 'block' }} />
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
                <p className="text-sm font-body leading-[1.75] text-primary mb-5 font-light">{result.ai_explanation}</p>
                {result.folder_explanations && Object.keys(result.folder_explanations).length > 0 && (
                  <div className="flex flex-col gap-3 mb-4">
                    {Object.entries(result.folder_explanations).slice(0, 4).map(([folder, desc]) => {
                      const [label] = desc.split(" — ");
                      return (
                        <div key={folder} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-sm">
                          <code className="w-fit text-[10px] font-bold uppercase tracking-widest bg-primary/5 border border-outline px-2 py-1 text-primary rounded">/{folder}</code>
                          <span className="text-primary font-medium">{label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="flex items-center gap-3 border-t border-outline pt-4">
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
                        <code className="text-xs md:text-sm text-primary font-mono font-medium truncate">{rest.join(" ")}</code>
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
                      <div key={i} onClick={() => setPreviewFile(file)} className="group liquid-glass p-4 md:p-5 rounded-xl flex justify-between items-center hover:bg-primary/[0.05] transition-all cursor-pointer">
                        <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
                          <div className="flex-shrink-0 w-8 h-8 md:w-10 md:h-10 flex items-center justify-center bg-primary/5 group-hover:bg-accent-purple transition-colors rounded-lg">
                            <span className="material-symbols-outlined text-secondary/60 group-hover:text-white text-sm md:text-base">{icon}</span>
                          </div>
                          <div className="flex flex-col overflow-hidden">
                            <span className="text-sm font-bold font-headline tracking-tight text-primary truncate">{name}</span>
                            <span className="text-[9px] md:text-[10px] text-secondary/60 font-medium uppercase tracking-wider truncate">{file}</span>
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
                      <div key={i} className="flex items-start gap-3 pb-3 border-b border-outline last:border-0 last:pb-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-accent-purple mt-2 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="text-sm text-primary font-medium truncate">{c.message}</div>
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
                      className="liquid-glass px-3 md:px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer hover:bg-primary/5 transition-colors">
                      <span className="material-symbols-outlined text-accent-purple !text-sm md:!text-base">play_circle</span>
                      <span className="text-xs md:text-sm font-medium text-primary font-body truncate">{ep}</span>
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
            className="w-1.5 flex-shrink-0 cursor-col-resize flex items-center justify-center z-10 transition-colors hover:bg-primary/5"
          >
            <div className="w-0.5 h-10 rounded-full bg-primary/20 pointer-events-none" />
          </div>
        )}

        {/* Desktop: Right Side AI Chat */}
        {!isMobile && (
          <aside style={{ flex: `0 0 ${100 - splitPct}%`, width: `${100 - splitPct}%`, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <ChatSidebar repoUrl={result.repo_url || repoUrl} ragReady={result.rag_ready} />
          </aside>
        )}
      </div>

      {/* Mobile: Floating Chat Button */}
      {isMobile && (
        <>
          {/* FAB */}
          <button
            onClick={() => setChatOpen(true)}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-accent-purple shadow-[0_8px_32px_rgba(168,85,247,0.5)] flex items-center justify-center active:scale-95 transition-transform"
            aria-label="Open AI Chat"
          >
            <span className="material-symbols-outlined text-white !text-2xl">auto_awesome</span>
          </button>

          {/* Slide-up drawer backdrop */}
          {chatOpen && (
            <div
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={() => setChatOpen(false)}
            />
          )}

          {/* Slide-up drawer */}
          <div
            className="fixed left-0 right-0 bottom-0 z-50 flex flex-col bg-background border-t border-outline rounded-t-2xl shadow-[0_-8px_40px_rgba(0,0,0,0.1)] transition-transform duration-300 ease-out"
            style={{
              height: '85dvh',
              transform: chatOpen ? 'translateY(0)' : 'translateY(105%)',
            }}
          >
            {/* Drawer handle + header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-accent-purple/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-accent-purple !text-base">auto_awesome</span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-secondary/50">AI Assistant</span>
              </div>
              <button
                onClick={() => setChatOpen(false)}
                className="w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center hover:bg-primary/10 transition-colors active:scale-95"
                aria-label="Close chat"
              >
                <span className="material-symbols-outlined text-secondary !text-lg">close</span>
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <ChatSidebar repoUrl={result.repo_url || repoUrl} ragReady={result.rag_ready} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Section header helper ──────────────────────────────────────────────────
function SectionHeader({ label }) {
  return (
    <div className="flex items-center gap-4 mb-8">
      <h3 className="text-[9px] uppercase tracking-[0.3em] text-secondary/60 font-bold whitespace-nowrap">{label}</h3>
      <div className="h-[1px] w-full bg-outline"></div>
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
      console.log("[debug] metadata:", res.data?.metadata);
      console.log("[debug] commits:", res.data?.metadata?.commits);
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

  if (loading) return <><VantaBackground subtle /><LoadingState repoUrl={repoUrl} /></>;
  if (result) return <><VantaBackground subtle /><AnalysisView result={result} repoUrl={repoUrl} onReset={reset} theme={theme} toggleTheme={toggleTheme} /></>;
  return <><VantaBackground /><LandingPage repoUrl={repoUrl} setRepoUrl={setRepoUrl} onAnalyze={analyze} loading={loading} error={error} theme={theme} toggleTheme={toggleTheme} healthStatus={healthStatus} /></>;
}