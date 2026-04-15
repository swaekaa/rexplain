import { useState } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import "./index.css";

// ─── Shared Nav ────────────────────────────────────────────────────────────
function Nav() {
  return (
    <nav className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-8 md:px-12 py-6 glass-card border-none">
      <div className="text-xl font-extrabold tracking-tighter text-primary font-headline pb-1">RExplain</div>
      <div className="hidden md:flex items-center space-x-10 font-headline font-semibold text-sm tracking-tight">
        <a className="text-stone-400 hover:text-primary transition-colors" href="#">Explore</a>
        <a className="text-stone-400 hover:text-primary transition-colors" href="#">Docs</a>
        <a className="text-stone-400 hover:text-primary transition-colors" href="#">Pricing</a>
      </div>
      <button className="text-primary font-bold text-xs px-5 py-2 hover:opacity-60 transition-opacity font-headline uppercase tracking-widest">
        Sign In
      </button>
    </nav>
  );
}

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

// ─── HTTP Method badge color ────────────────────────────────────────────────
function methodBg(method) {
  const m = { GET: "#dcfce7", POST: "#dbeafe", PUT: "#ffedd5", PATCH: "#ede9fe", DELETE: "#fee2e2", HEAD: "#f3f4f6", OPTIONS: "#f3f4f6", ALL: "#d1fae5" };
  const t = { GET: "#166534", POST: "#1e40af", PUT: "#9a3412", PATCH: "#5b21b6", DELETE: "#991b1b", HEAD: "#374151", OPTIONS: "#374151", ALL: "#065f46" };
  return { bg: m[method] || "#f3f4f6", color: t[method] || "#374151" };
}

// ─── Landing Page ──────────────────────────────────────────────────────────
function LandingPage({ repoUrl, setRepoUrl, onAnalyze, loading, error }) {
  const handleKey = (e) => { if (e.key === "Enter") onAnalyze(); };

  return (
    <>
      <Nav />
      <main className="min-h-screen pt-48 pb-32 px-6 flex flex-col items-center" style={{ background: "#f3f3f1", backgroundImage: "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.4) 0%, transparent 100%)" }}>

        {/* Architectural marker */}
        <div className="w-12 h-[1px] bg-black/20 mb-16" style={{ animation: "fadeInTitle 2s ease-out 0.8s forwards", opacity: 0 }} />

        {/* Hero */}
        <div className="max-w-4xl w-full text-center mb-24">
          <h1 className="liquid-glass-text font-headline font-extrabold tracking-tighter mb-8 leading-tight pb-4"
            style={{ fontSize: "clamp(4rem, 12vw, 9rem)" }}>
            RExplain
          </h1>
          <p className="hero-sub font-body text-secondary text-lg md:text-2xl tracking-tight font-light max-w-xl mx-auto leading-relaxed">
            Unfold the complexity of any GitHub repository with clarity and intent.
          </p>
        </div>

        {/* Search */}
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
            <button
              id="analyze-btn"
              onClick={onAnalyze}
              disabled={loading || !repoUrl.trim()}
              className="bg-primary hover:bg-black text-white font-headline font-bold px-8 md:px-10 py-5 rounded-xl transition-all duration-500 ease-out flex items-center gap-3 text-xs uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Analyze
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_forward</span>
            </button>
          </div>

          {/* Hints */}
          <div className="mt-10 flex justify-center gap-12 items-center text-[11px] font-headline font-bold uppercase tracking-[0.3em] text-stone-400">
            {["Zero Install", "Markdown", "AI Logic"].map(h => (
              <div key={h} className="flex items-center gap-3">
                <span className="w-1 h-1 bg-stone-300 rounded-full" />
                <span>{h}</span>
              </div>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="mt-6 glass-card rounded-xl p-4 text-red-700 text-sm font-body border border-red-200">
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* Bento cards */}
        <div className="max-w-6xl w-full grid grid-cols-1 md:grid-cols-12 gap-8 px-4 mb-32">
          {/* Feature 1 */}
          <div className="md:col-span-7 glass-card rounded-3xl p-12 flex flex-col justify-between overflow-hidden relative group">
            <div className="relative z-10">
              <span className="text-[11px] font-headline font-bold uppercase tracking-[0.25em] text-stone-400 mb-6 block">The Process</span>
              <h3 className="font-headline text-4xl font-extrabold text-primary mb-6 leading-tight tracking-tight">Instant Architecture<br />Mapping</h3>
              <p className="font-body text-stone-500 text-lg font-light leading-relaxed max-w-sm">We traverse your repository's dependency graph to visualize how components interact, saving hours of manual audit.</p>
            </div>
            <div className="mt-16 rounded-2xl overflow-hidden translate-y-6 group-hover:translate-y-2 transition-transform duration-700 ease-out border border-white/20" style={{ boxShadow: "0 20px 40px rgba(0,0,0,0.04)" }}>
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuANIUqkQKetZNqCvI31fkSSD4lQdFAmcu8sn6ZXPDectSxl--1dcR0eKgRsT6lUZkPuYbSXMHqC5CKgmm2oF2SarZWja038lDMSytaTrXN3QxdXJ1mn_00on3JyLMCIf42Ue46SkTRrKV03HeV_VivCBznNORm8_yPBAQ5RoSdns3LnK4ZulsgLqerjraBSDsUHjkhTyp08RtFDezrKwiRvis3ELhaJajrSU__Gr3Ww_Xg0NSePUQSVGJrfYFUm4SRPSW29qVWAVCc"
                alt="Abstract visualization of software architecture"
                className="w-full h-64 object-cover grayscale opacity-90 contrast-125"
              />
            </div>
          </div>

          {/* Feature 2 */}
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

        {/* Testimonial */}
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

      <main
        className="min-h-screen flex flex-col items-center justify-center px-6"
        style={{ background: "#fafaf9", backgroundImage: "radial-gradient(circle at center, rgba(0,0,0,0.02) 0%, transparent 100%)" }}
      >
        <div className="w-full max-w-sm flex flex-col items-center">
          <div className="text-center space-y-6 mb-12">
            <div className="flex flex-col items-center gap-8">
              {/* Loader */}
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

          {/* Shimmer bar */}
          <div className="w-48 h-[1px] bg-stone-100 overflow-hidden relative">
            <div className="absolute inset-0 w-1/3 h-full bg-stone-300" style={{ animation: "shimmer 2.5s cubic-bezier(0.4,0,0.2,1) infinite" }} />
          </div>

          {/* Metadata grid */}
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

        {/* Decorative */}
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

// ─── Analysis View ─────────────────────────────────────────────────────────
function AnalysisView({ result, repoUrl, onReset }) {
  const fw = result.framework_detection || {};
  const scan = result.scan_results || {};
  const langs = Object.entries(scan.languages || {}).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const repoName = repoUrl.replace("https://github.com/", "");

  const stackItems = [
    { label: "Backend",  value: fw.backend_framework,  icon: "terminal" },
    { label: "Frontend", value: fw.frontend_framework, icon: "web_asset" },
    { label: "Database", value: fw.database,           icon: "database" },
  ];

  return (
    <>
      {/* Nav */}
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-8 py-6 border-b border-stone-200/40 backdrop-blur-xl" style={{ background: "rgba(249,249,247,0.6)" }}>
        <div className="flex items-center gap-8">
          <div className="logo-glass flex items-center">
            <span className="text-xl font-bold tracking-tighter text-stone-950 font-headline pb-1">RExplain</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 font-headline text-sm tracking-tight font-medium">
            <button onClick={onReset} className="text-stone-500 hover:text-stone-950 transition-colors">← New Analysis</button>
            <a className="text-stone-500 hover:text-stone-950 transition-colors" href="#">Docs</a>
          </nav>
        </div>
        <button onClick={onReset} className="px-5 py-2 text-xs font-bold uppercase tracking-widest hover:opacity-70 transition-opacity text-stone-950">New →</button>
      </header>

      <main className="pt-40 pb-24 max-w-6xl mx-auto px-8" style={{ background: "#f9f9f7" }}>

        {/* Hero header */}
        <section className="mb-24 space-y-6 reveal-up reveal-hidden">
          <div className="inline-flex items-center gap-3">
            <div className="w-12 h-[1px] bg-black" />
            <span className="text-[10px] uppercase tracking-[0.4em] font-bold text-stone-400">System Insight</span>
          </div>
          <h1 className="font-headline font-bold tracking-tight leading-[0.9] text-primary" style={{ fontSize: "clamp(3rem,8vw,5.5rem)" }}>
            Repository<br />Analysis
          </h1>
          <p className="text-stone-500 font-body max-w-xl text-xl leading-relaxed font-light">
            A structural breakdown of{" "}
            <span className="text-primary font-medium border-b border-black/20">{repoName}</span>.{" "}
            Analysis completed in <span className="font-medium">{result._elapsed || "~5"}s</span>.
          </p>
        </section>

        {/* Repo stats */}
        <section className="mb-16 reveal-up reveal-hidden delay-1">
          <div className="glass-card glass-card-hover p-10 md:p-12 flex flex-col md:flex-row md:items-end justify-between gap-12 shadow-sm">
            <div className="space-y-2">
              <span className="block text-[10px] uppercase tracking-[0.3em] text-stone-400 font-bold">Comprehensive Scan</span>
              <h2 className="font-headline font-bold tracking-tight" style={{ fontSize: "clamp(2rem,5vw,3.5rem)" }}>
                {scan.total_files?.toLocaleString()}{" "}
                <span className="text-2xl font-light text-stone-400">files</span>
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {langs.map(([ext, count]) => (
                <span key={ext} className="px-5 py-2 bg-white/40 border border-white/60 text-stone-600 text-[10px] font-bold font-label tracking-[0.1em] uppercase">
                  {ext} ({count})
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Tech Stack */}
        <section className="mb-32 reveal-up reveal-hidden delay-2">
          <div className="flex items-center gap-4 mb-10">
            <h3 className="text-[10px] uppercase tracking-[0.3em] text-stone-400 font-bold whitespace-nowrap">Detected Ecosystem</h3>
            <div className="h-[1px] w-full bg-stone-200" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {stackItems.map(({ label, value, icon }) => {
              const missing = !value;
              return (
                <div key={label}
                  className={`glass-card p-8 h-56 flex flex-col justify-between stack-card transition-all duration-500 ${missing ? "opacity-50 grayscale hover:grayscale-0 hover:opacity-80" : "glass-card-hover"}`}
                >
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">{label}</span>
                    <span className="material-symbols-outlined text-stone-300" style={{ fontSize: 20 }}>{icon}</span>
                  </div>
                  <div>
                    {missing
                      ? <span className="text-2xl font-headline font-light italic text-stone-400 tracking-tight">Not detected</span>
                      : <>
                          <span className="text-3xl font-headline font-bold tracking-tight">{value}</span>
                          <div className="stack-underline" />
                        </>
                    }
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* AI Explanation */}
        <section className="mb-32 reveal-up reveal-hidden delay-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-16">
            <div className="md:col-span-4">
              <div className="sticky top-40 space-y-4">
                <h3 className="text-3xl font-headline font-bold tracking-tight">AI Interpretation</h3>
                <p className="text-stone-500 text-sm font-body leading-relaxed font-light">
                  Our engine analyzed the directory structure and logic flow to provide a narrative overview of the codebase intent.
                </p>
              </div>
            </div>
            <div className="md:col-span-8">
              <div className="glass-card p-10 md:p-16 shadow-2xl shadow-stone-200/50">
                <p className="text-xl md:text-2xl font-body leading-[1.6] text-primary mb-8 font-light">
                  {result.ai_explanation}
                </p>
                <div className="h-[1px] w-full bg-stone-100 mb-8" />
                {result.folder_explanations && Object.keys(result.folder_explanations).length > 0 && (
                  <div className="space-y-3">
                    {Object.entries(result.folder_explanations).slice(0, 4).map(([folder, desc]) => {
                      const [label] = desc.split(" — ");
                      return (
                        <div key={folder} className="flex items-center gap-4 text-sm">
                          <code className="text-[10px] font-bold uppercase tracking-widest bg-stone-100 px-2 py-1 text-stone-600">/{folder}</code>
                          <span className="text-stone-500 font-light">{label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="flex items-center gap-4 text-stone-900 mt-8">
                  <span className="material-symbols-outlined text-stone-400" style={{ fontSize: 18 }}>verified</span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Static Analysis • Pattern Detection</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Architecture Diagram */}
        {result.diagram && (
          <section className="mb-32 reveal-up reveal-hidden delay-4">
            <h3 className="text-[10px] uppercase tracking-[0.4em] text-stone-400 mb-16 font-bold text-center">System Topology</h3>
            <div className="relative glass-card p-12 md:p-24 flex flex-col md:flex-row items-center justify-center gap-16 md:gap-32 bg-stone-50/40 overflow-hidden border-0">
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-1/2 draw-container"><div className="draw-line-inner" /></div>
              </div>
              <div className="z-10 text-center">
                <img
                  src={result.diagram}
                  alt="Architecture Diagram"
                  style={{ maxWidth: "100%", maxHeight: "340px", objectFit: "contain", filter: "invert(1) hue-rotate(180deg) brightness(0.9)" }}
                />
              </div>
            </div>
          </section>
        )}

        {/* API Routes */}
        {result.api_routes?.length > 0 && (
          <section className="mb-32 reveal-up reveal-hidden delay-4">
            <div className="flex items-center gap-4 mb-10">
              <h3 className="text-[10px] uppercase tracking-[0.3em] text-stone-400 font-bold whitespace-nowrap">API Surface</h3>
              <div className="h-[1px] w-full bg-stone-200" />
              <span className="text-[10px] text-stone-400 whitespace-nowrap">{result.api_routes.length} routes</span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {result.api_routes.slice(0, 12).map((route, i) => {
                const [method, ...rest] = route.split(" ");
                const path = rest.join(" ");
                const { bg, color } = methodBg(method);
                return (
                  <div key={i} className="glass-card glass-card-hover p-5 flex items-center gap-5 cursor-default">
                    <span className="text-[10px] font-headline font-bold uppercase tracking-widest px-3 py-1 rounded"
                      style={{ background: bg, color, minWidth: 56, textAlign: "center" }}>
                      {method}
                    </span>
                    <code className="text-sm text-stone-700 font-mono">{path}</code>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Key Files */}
        {result.important_files?.length > 0 && (
          <section className="mb-32 reveal-up reveal-hidden delay-5">
            <div className="flex items-center gap-4 mb-10">
              <h3 className="text-[10px] uppercase tracking-[0.3em] text-stone-400 font-bold whitespace-nowrap">Core Entry Points</h3>
              <div className="h-[1px] w-full bg-stone-200" />
            </div>
            <div className="grid grid-cols-1 gap-4">
              {result.important_files.slice(0, 6).map((file, i) => {
                const name = file.split("/").pop();
                const sub = file.includes("/") ? file : null;
                const icon = name.includes("Dockerfile") || name.includes("docker") ? "deployed_code" :
                             name.startsWith(".github") || file.startsWith(".github") ? "hub" :
                             name.endsWith(".json") ? "data_object" :
                             name.endsWith(".py") ? "terminal" : "description";
                return (
                  <div key={i} className="group glass-card p-6 md:p-8 flex justify-between items-center cursor-pointer key-file-row" style={{ transition: "background 0.3s" }}>
                    <div className="flex items-center gap-6 md:gap-8">
                      <div className="w-12 h-12 flex items-center justify-center bg-stone-100 key-file-icon">
                        <span className="material-symbols-outlined text-stone-400" style={{ fontSize: 20 }}>{icon}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-lg md:text-xl font-bold font-headline tracking-tight key-file-name">{name}</span>
                        {sub && <span className="text-xs text-stone-400 font-medium uppercase tracking-wider mt-1">{file}</span>}
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-stone-300 key-file-arrow" style={{ fontSize: 20 }}>arrow_forward</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* README */}
        {result.readme && (
          <section className="mb-24 reveal-up reveal-hidden delay-6">
            <div className="flex items-center gap-4 mb-12">
              <h3 className="text-[10px] uppercase tracking-[0.3em] text-stone-400 font-bold whitespace-nowrap">Documentation Preview</h3>
              <div className="h-[1px] w-full bg-stone-200" />
            </div>
            <div className="glass-card p-10 md:p-16 max-w-4xl mx-auto shadow-2xl shadow-stone-200/40 relative">
              <div className="absolute top-0 right-0 p-8">
                <span className="text-[8px] font-bold uppercase tracking-[0.5em] text-stone-300">README.MD</span>
              </div>
              <div className="readme-prose" style={{ maxHeight: 600, overflowY: "auto" }}>
                <ReactMarkdown>{result.readme}</ReactMarkdown>
              </div>
            </div>
          </section>
        )}

      </main>

      <footer className="bg-white/40 backdrop-blur-md border-t border-stone-200/60 py-16 px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-12 text-[10px] uppercase tracking-[0.2em] font-bold font-headline">
          <div className="logo-glass flex items-center">
            <span className="text-lg font-bold tracking-tighter text-stone-950 font-headline pb-1">RExplain</span>
          </div>
          <div className="flex gap-10">
            {["Github", "Privacy", "Terms", "Status"].map(l => (
              <a key={l} className="text-stone-400 hover:text-stone-950 transition-colors" href="#">{l}</a>
            ))}
          </div>
          <span className="text-stone-400 normal-case tracking-normal font-normal text-[11px]">© 2024. Built for clarity.</span>
        </div>
      </footer>
    </>
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
    setLoading(true);
    setError(null);
    setResult(null);
    const t0 = Date.now();
    try {
      const res = await axios.post("http://127.0.0.1:8000/analyze/", { repo_url: repoUrl.trim() });
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      setResult({ ...res.data, _elapsed: elapsed });
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
        err?.message ||
        "Failed to analyze repository. Check the URL and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { setResult(null); setError(null); };

  if (loading) return <LoadingState repoUrl={repoUrl} />;
  if (result)  return <AnalysisView result={result} repoUrl={repoUrl} onReset={reset} />;
  return <LandingPage repoUrl={repoUrl} setRepoUrl={setRepoUrl} onAnalyze={analyze} loading={loading} error={error} />;
}