import re

app_path = r"c:\Users\Ekaansh\OneDrive\Desktop\AB\projects\rexplain\frontend\src\App.js"

with open(app_path, "r", encoding="utf-8") as f:
    code = f.read()

# 1. Restore the Theme Toggle in App Root
code = re.sub(
    r'export default function App\(\) \{\n  const \[repoUrl, setRepoUrl\] = useState\(""\);',
    r'''export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");
  useEffect(() => {
    localStorage.setItem("theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  const toggleTheme = () => setTheme(t => t === "dark" ? "light" : "dark");
  const [repoUrl, setRepoUrl] = useState("");''',
    code
)

# 2. Pass theme to components
code = code.replace(
    '''if (result) return <AnalysisView result={result} repoUrl={repoUrl} onReset={reset} />;
  return <LandingPage repoUrl={repoUrl} setRepoUrl={setRepoUrl} onAnalyze={analyze} loading={loading} error={error} />;''',
    '''if (result) return <AnalysisView result={result} repoUrl={repoUrl} onReset={reset} theme={theme} toggleTheme={toggleTheme} />;
  return <LandingPage repoUrl={repoUrl} setRepoUrl={setRepoUrl} onAnalyze={analyze} loading={loading} error={error} theme={theme} toggleTheme={toggleTheme} />;'''
)

code = code.replace(
    '''function LandingPage({ repoUrl, setRepoUrl, onAnalyze, loading, error }) {''',
    '''function LandingPage({ repoUrl, setRepoUrl, onAnalyze, loading, error, theme, toggleTheme }) {'''
)
code = code.replace(
    '''function AnalysisView({ result, repoUrl, onReset }) {''',
    '''function AnalysisView({ result, repoUrl, onReset, theme, toggleTheme }) {'''
)
code = code.replace(
    '''function LoadingState({ repoUrl }) {''',
    '''function LoadingState({ repoUrl, theme }) {'''
)

# 3. Add toggle button to Navs
code = code.replace(
    '''<div className="hidden md:flex items-center space-x-10 font-headline font-semibold text-sm tracking-tight">''',
    '''<div className="hidden md:flex items-center space-x-10 font-headline font-semibold text-sm tracking-tight">
          <button onClick={toggleTheme} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-colors border border-white/10">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>{theme === "dark" ? "light_mode" : "dark_mode"}</span>
          </button>'''
)
code = code.replace(
    '''<nav className="hidden md:flex items-center gap-8 font-headline text-sm tracking-tight font-medium">''',
    '''<nav className="hidden md:flex items-center gap-8 font-headline text-sm tracking-tight font-medium">
            <button onClick={toggleTheme} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-colors border border-white/10">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>{theme === "dark" ? "light_mode" : "dark_mode"}</span>
            </button>'''
)

# 4. Clean up hardcoded light colors
code = code.replace('background: "#f3f3f1"', 'background: "var(--bg-page)"')
code = code.replace('background: "#f9f9f7"', 'background: "var(--bg-page)"')
code = code.replace('background: "#fafaf9"', 'background: "var(--bg-page)"')

code = code.replace('bg-black/20', 'bg-white/20') # Divider
code = code.replace('text-stone-300', 'text-secondary')
code = code.replace('text-stone-400', 'text-secondary')
code = code.replace('text-stone-500', 'text-secondary')
code = code.replace('text-stone-600', 'text-primary')
code = code.replace('text-stone-900', 'text-primary')
code = code.replace('text-stone-950', 'text-primary')
code = code.replace('bg-white/40', 'bg-white/5')
code = code.replace('bg-[#18181b]/50', 'bg-white/5')

code = code.replace('border-stone-200', 'border-white/10')
code = code.replace('border-stone-100', 'border-white/10')

code = code.replace(
    '''style={{ background: "rgba(249,249,247,0.88)", height: NAV_H }}>''',
    '''style={{ height: NAV_H }}>'''
)
code = code.replace(
    '''className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-8 border-b border-stone-200/40 backdrop-blur-xl"''',
    '''className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-8 border-b border-white/5 backdrop-blur-xl glass-card border-x-0 border-t-0"'''
)

# Fix Chat Sidebar
code = code.replace(
    '''<div style={{ display: "flex", flexDirection: "column", height: "100%", background: "rgba(255,255,255,0.6)", backdropFilter: "blur(20px)" }}>''',
    '''<div style={{ display: "flex", flexDirection: "column", height: "100%", background: "transparent", backdropFilter: "blur(20px)" }}>'''
)
code = code.replace(
    '''<div style={{ padding: "18px 20px 14px", borderBottom: "1px solid rgba(0,0,0,0.06)", flexShrink: 0 }}>''',
    '''<div style={{ padding: "18px 20px 14px", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0 }}>'''
)
code = code.replace(
    '''<span className="material-symbols-outlined" style={{ fontSize: 16, color: "#111" }}>smart_toy</span>''',
    '''<span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>smart_toy</span>'''
)
code = code.replace(
    '''<span className="font-headline font-bold text-xs uppercase tracking-widest" style={{ color: "#111" }}>Repository AI Chat</span>''',
    '''<span className="font-headline font-bold text-xs uppercase tracking-widest text-primary">Repository AI Chat</span>'''
)
code = code.replace(
    '''<div style={{ borderTop: "1px solid rgba(0,0,0,0.06)", padding: "10px 12px", flexShrink: 0, display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.75)" }}>''',
    '''<div className="glass-card" style={{ borderTop: "1px solid var(--border-subtle)", borderRight: "none", borderLeft: "none", borderBottom: "none", borderRadius: 0, padding: "16px", flexShrink: 0, display: "flex", alignItems: "center", gap: 10 }}>'''
)
code = code.replace(
    '''style={{ flex: 1, border: "none", outline: "none", background: "rgba(0,0,0,0.04)", borderRadius: 8, padding: "9px 12px", fontFamily: "Inter, sans-serif", fontSize: 13, color: "#111" }}''',
    '''style={{ flex: 1, border: "1px solid var(--border-subtle)", outline: "none", background: "var(--bg-subtle)", backdropFilter: "blur(12px)", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.1)", borderRadius: 10, padding: "12px 16px", fontFamily: "Inter, sans-serif", fontSize: 14, color: "var(--text-primary)" }}'''
)
code = code.replace(
    '''background: asking || !input.trim() || !ragReady ? "#e5e5e5" : "#111",''',
    '''background: asking || !input.trim() || !ragReady ? "var(--border-medium)" : "var(--accent-purple)",'''
)
code = code.replace(
    '''color: asking || !input.trim() || !ragReady ? "#999" : "#fff",''',
    '''color: asking || !input.trim() || !ragReady ? "rgba(255,255,255,0.3)" : "var(--text-primary)",'''
)

code = code.replace(
    '''background: "#111", color: "#fff",''',
    '''background: "var(--accent-purple)", color: "#fff", backdropFilter: "blur(12px)", boxShadow: "0 4px 15px var(--accent-purple-light)", border: "1px solid var(--accent-purple-border)",'''
)
code = code.replace(
    '''background: "rgba(0,0,0,0.04)",''',
    '''background: "var(--bg-card)",'''
)
code = code.replace(
    '''border: "1px solid rgba(0,0,0,0.06)",''',
    '''border: "1px solid var(--border-subtle)", backdropFilter: "blur(12px)", boxShadow: "var(--glass-shadow)",'''
)
code = code.replace(
    '''color: "#1a1c1b"''',
    '''color: "var(--text-primary)"'''
)

with open(app_path, "w", encoding="utf-8") as f:
    f.write(code)

print("Theme restoring applied to App.js")
