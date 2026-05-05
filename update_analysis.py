import re

def update_file():
    with open('frontend/src/App.js', 'r', encoding='utf-8') as f:
        content = f.read()

    # We want to replace everything from "function ChatSidebar" down to just before "export default function App() {"

    start_str = "// ─── Chat Sidebar ───────────────────────────────────────────────────────────"
    end_str = "// ─── App Root ───────────────────────────────────────────────────────────────"

    start_idx = content.find(start_str)
    end_idx = content.find(end_str)

    if start_idx == -1 or end_idx == -1:
        print("Could not find start or end bounds.")
        return

    new_code = """// ─── Chat Sidebar ───────────────────────────────────────────────────────────
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
              .replace(/^```(?:json)?\\s*/m, "")
              .replace(/```\\s*$/m, "")
              .trim();
            const parsed = JSON.parse(cleaned);
            if (parsed && typeof parsed.answer === "string" && parsed.answer.trim()) {
              finalText = parsed.answer.trim();
            }
          } catch (_) {
            const m = accText.match(/"answer"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"/s);
            if (m) {
              finalText = m[1]
                .replace(/\\\\n/g, "\\n")
                .replace(/\\\\t/g, "\\t")
                .replace(/\\\\"/g, '\\"')
                .replace(/\\\\\\\\/g, "\\\\");
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
        const token = data.replace(/\\\\n/g, "\\n");
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
    <div className="bg-background text-on-background font-body selection:bg-tertiary selection:text-white antialiased min-h-screen overflow-hidden flex flex-col">
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-8 py-4 bg-transparent backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-8">
            <div className="flex items-center">
                <span className="liquid-glass-text text-xl font-extrabold tracking-tighter font-headline pb-1">RExplain</span>
            </div>
            <nav className="hidden md:flex items-center gap-8 font-['Manrope'] text-sm tracking-tight font-medium">
                <a className="text-white border-b-2 border-white pb-1" href="#">Analysis</a>
                <a className="text-secondary hover:text-white transition-colors" href="#">Docs</a>
                <a className="text-secondary hover:text-white transition-colors" href="#">Pricing</a>
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

      <div ref={containerRef} className="flex flex-1 pt-16">
        {/* Left Side: AI Chat Interface */}
        <aside style={{ width: `${splitPct}%` }} className="border-r border-white/5 flex flex-col bg-white/[0.01]">
          <ChatSidebar repoUrl={repoUrl} ragReady={result.rag_ready} />
        </aside>

        {/* DIVIDER */}
        <div
          onMouseDown={onDividerDown}
          className="w-1.5 flex-shrink-0 cursor-col-resize flex items-center justify-center z-10 transition-colors hover:bg-white/5"
        >
          <div className="w-0.5 h-10 rounded-full bg-white/10 pointer-events-none" />
        </div>

        {/* Right Side: Analysis Content */}
        <main style={{ width: `${100 - splitPct}%` }} className="overflow-y-auto bg-transparent scroll-hide">
          <div className="max-w-3xl mx-auto px-8 pt-20 pb-24">
            
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
                <SectionHeader label="API Surface" />
                <div className="flex flex-col gap-2">
                  {result.api_routes.slice(0, 8).map((route, i) => {
                    const [method, ...rest] = route.split(" ");
                    const isGet = method === "GET";
                    const methodColor = isGet ? "text-green-400 bg-green-400/10 border-green-400/20" : "text-blue-400 bg-blue-400/10 border-blue-400/20";
                    return (
                      <div key={i} className="liquid-glass p-4 rounded-lg flex items-center gap-4">
                        <span className={`text-[9px] font-headline font-bold uppercase tracking-widest px-3 py-1 rounded border ${methodColor} min-w-[50px] text-center`}>
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

            {/* Footer (Mini) */}
            <footer className="pt-12 text-center bg-transparent">
                <p className="text-[10px] text-secondary/30 uppercase tracking-[0.2em] font-bold">© 2024 • RExplain AI Systems</p>
            </footer>

          </div>
        </main>
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

"""

    new_content = content[:start_idx] + new_code + content[end_idx:]
    with open('frontend/src/App.js', 'w', encoding='utf-8') as f:
        f.write(new_content)

if __name__ == "__main__":
    update_file()
