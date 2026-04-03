import { useState } from "react";
import axios from "axios";
import "./index.css";

// ── Inline style tokens (mirrors index.css variables for JS usage) ──
const C = {
  bgBase:       "#0d1117",
  bgCard:       "#161b22",
  bgCardHover:  "#1c2230",
  bgInput:      "#21262d",
  border:       "#30363d",
  borderAccent: "#388bfd",
  textPrimary:  "#e6edf3",
  textSecondary:"#8b949e",
  textMuted:    "#484f58",
  accentBlue:   "#388bfd",
  accentGreen:  "#3fb950",
  accentPurple: "#bc8cff",
  accentOrange: "#ffa657",
  accentRed:    "#f85149",
};

// ── Stack card config ──
const STACK_CARDS = [
  {
    key: "backend_framework",
    label: "Backend",
    icon: "⚙️",
    accentColor: C.accentBlue,
  },
  {
    key: "frontend_framework",
    label: "Frontend",
    icon: "🖥️",
    accentColor: C.accentPurple,
  },
  {
    key: "database",
    label: "Database",
    icon: "🗄️",
    accentColor: C.accentGreen,
  },
];

// Extension → display color mapping
function extColor(ext) {
  const map = {
    ".py":   "#3572A5",
    ".js":   "#F1E05A",
    ".ts":   "#2B7489",
    ".tsx":  "#2B7489",
    ".jsx":  "#F1E05A",
    ".html": "#E34C26",
    ".css":  "#563D7C",
    ".json": "#292929",
    ".md":   "#083FA1",
    ".go":   "#00ADD8",
    ".rs":   "#DEA584",
    ".java": "#B07219",
    ".rb":   "#701516",
    ".php":  "#4F5D95",
  };
  return map[ext] || "#484f58";
}

function App() {
  const [repoUrl, setRepoUrl]   = useState("");
  const [result, setResult]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  const analyzeRepo = async () => {
    if (!repoUrl.trim()) return;
    try {
      setLoading(true);
      setResult(null);
      setError(null);

      const response = await axios.post(
        "http://127.0.0.1:8000/analyze/",
        { repo_url: repoUrl.trim() }
      );

      setResult(response.data);
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        "Failed to analyze repository. Check the URL and try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") analyzeRepo();
  };

  // ── Top-8 languages by count ──
  const topLangs = result
    ? Object.entries(result.scan_results?.languages || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
    : [];

  return (
    <div style={{ minHeight: "100vh", background: C.bgBase }}>

      {/* ── HERO ── */}
      <header style={{
        padding: "64px 24px 48px",
        textAlign: "center",
      }}>
        <div style={{
          display: "inline-block",
          background: "linear-gradient(135deg, #388bfd 0%, #bc8cff 100%)",
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          fontSize: "clamp(2.4rem, 6vw, 4rem)",
          fontWeight: 700,
          letterSpacing: "-0.03em",
          lineHeight: 1.1,
          marginBottom: "12px",
        }}>
          RExplain
        </div>
        <p style={{
          color: C.textSecondary,
          fontSize: "1.05rem",
          maxWidth: "480px",
          margin: "0 auto",
        }}>
          Instantly understand any GitHub repository — architecture, stack, and structure at a glance.
        </p>
      </header>

      {/* ── INPUT BAR ── */}
      <div style={{
        maxWidth: "720px",
        margin: "0 auto",
        padding: "0 24px",
        display: "flex",
        gap: "10px",
      }}>
        <input
          id="repo-url-input"
          type="text"
          placeholder="https://github.com/owner/repository"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          style={{
            flex: 1,
            padding: "14px 18px",
            background: C.bgInput,
            border: `1.5px solid ${loading ? C.textMuted : C.border}`,
            borderRadius: "10px",
            color: C.textPrimary,
            fontSize: "0.95rem",
            outline: "none",
            transition: "border-color 0.2s",
            fontFamily: "inherit",
          }}
          onFocus={(e) => (e.target.style.borderColor = C.accentBlue)}
          onBlur={(e)  => (e.target.style.borderColor = C.border)}
        />
        <button
          id="analyze-btn"
          onClick={analyzeRepo}
          disabled={loading || !repoUrl.trim()}
          style={{
            padding: "14px 26px",
            background: loading || !repoUrl.trim()
              ? C.bgInput
              : "linear-gradient(135deg, #388bfd, #bc8cff)",
            color: loading || !repoUrl.trim() ? C.textMuted : "#fff",
            border: "none",
            borderRadius: "10px",
            fontSize: "0.95rem",
            fontWeight: 600,
            cursor: loading || !repoUrl.trim() ? "not-allowed" : "pointer",
            transition: "opacity 0.2s, transform 0.15s",
            fontFamily: "inherit",
            whiteSpace: "nowrap",
          }}
          onMouseEnter={(e) => { if (!loading) e.target.style.opacity = "0.88"; }}
          onMouseLeave={(e) => { e.target.style.opacity = "1"; }}
        >
          {loading ? "Analyzing…" : "Analyze →"}
        </button>
      </div>

      {/* ── LOADING SPINNER ── */}
      {loading && (
        <div style={{
          textAlign: "center",
          marginTop: "56px",
          animation: "fadeInUp 0.3s ease",
        }}>
          <div style={{
            width: "44px",
            height: "44px",
            border: `3px solid ${C.border}`,
            borderTop: `3px solid ${C.accentBlue}`,
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
            margin: "0 auto 16px",
          }} />
          <p style={{ color: C.textSecondary, fontSize: "0.9rem" }}>
            Cloning &amp; analyzing repository…
          </p>
        </div>
      )}

      {/* ── ERROR STATE ── */}
      {error && !loading && (
        <div className="fade-in" style={{
          maxWidth: "720px",
          margin: "32px auto 0",
          padding: "0 24px",
        }}>
          <div style={{
            background: "#1a0d0d",
            border: `1px solid ${C.accentRed}`,
            borderRadius: "10px",
            padding: "16px 20px",
            color: C.accentRed,
            fontSize: "0.9rem",
          }}>
            ⚠️ {error}
          </div>
        </div>
      )}

      {/* ── RESULTS ── */}
      {result && !loading && (
        <div className="fade-in" style={{
          maxWidth: "900px",
          margin: "48px auto 80px",
          padding: "0 24px",
        }}>

          {/* ── STACK CARDS ── */}
          <section style={{ marginBottom: "36px" }}>
            <SectionLabel>Tech Stack</SectionLabel>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "14px",
              marginTop: "14px",
            }}>
              {STACK_CARDS.map(({ key, label, icon, accentColor }) => {
                const value = result.framework_detection?.[key];
                return (
                  <div key={key} style={{
                    background: C.bgCard,
                    border: `1px solid ${value ? accentColor + "55" : C.border}`,
                    borderRadius: "12px",
                    padding: "20px 22px",
                    transition: "border-color 0.2s",
                  }}>
                    <div style={{ fontSize: "1.5rem", marginBottom: "8px" }}>{icon}</div>
                    <div style={{
                      fontSize: "0.75rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: C.textMuted,
                      marginBottom: "4px",
                    }}>
                      {label}
                    </div>
                    <div style={{
                      fontSize: "1.15rem",
                      fontWeight: 600,
                      color: value ? accentColor : C.textMuted,
                    }}>
                      {value || "Not detected"}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── FILE STATS ── */}
          <section style={{ marginBottom: "36px" }}>
            <SectionLabel>Repository Stats</SectionLabel>
            <div style={{
              background: C.bgCard,
              border: `1px solid ${C.border}`,
              borderRadius: "12px",
              padding: "20px 22px",
              marginTop: "14px",
            }}>
              <div style={{
                fontSize: "2rem",
                fontWeight: 700,
                color: C.accentBlue,
                marginBottom: "4px",
              }}>
                {result.scan_results?.total_files?.toLocaleString()}
              </div>
              <div style={{ color: C.textSecondary, fontSize: "0.85rem", marginBottom: "16px" }}>
                total files scanned
              </div>

              {topLangs.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {topLangs.map(([ext, count]) => (
                    <span key={ext} style={{
                      background: extColor(ext) + "22",
                      border: `1px solid ${extColor(ext)}55`,
                      color: extColor(ext),
                      borderRadius: "6px",
                      padding: "3px 10px",
                      fontSize: "0.78rem",
                      fontWeight: 500,
                      fontFamily: "monospace",
                    }}>
                      {ext} <span style={{ opacity: 0.7 }}>({count})</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* ── ARCHITECTURE DIAGRAM ── */}
          {result.diagram && (
            <section style={{ marginBottom: "36px" }}>
              <SectionLabel>Architecture Diagram</SectionLabel>
              <div style={{
                background: C.bgCard,
                border: `1px solid ${C.border}`,
                borderRadius: "12px",
                padding: "24px",
                marginTop: "14px",
                textAlign: "center",
              }}>
                <img
                  src={result.diagram}
                  alt="Architecture Diagram"
                  style={{
                    maxWidth: "100%",
                    borderRadius: "8px",
                    background: "#fff",
                    padding: "8px",
                  }}
                />
              </div>
            </section>
          )}

          {/* ── AI EXPLANATION ── */}
          <section>
            <SectionLabel>AI Explanation</SectionLabel>
            <div style={{
              background: C.bgCard,
              border: `1px solid ${C.border}`,
              borderRadius: "12px",
              padding: "22px 24px",
              marginTop: "14px",
              color: C.textSecondary,
              fontSize: "0.95rem",
              lineHeight: 1.75,
            }}>
              {result.ai_explanation}
            </div>
          </section>

        </div>
      )}
    </div>
  );
}

// ── Shared section label component ──
function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: "0.75rem",
      textTransform: "uppercase",
      letterSpacing: "0.12em",
      color: "#484f58",
      fontWeight: 600,
    }}>
      {children}
    </div>
  );
}

export default App;