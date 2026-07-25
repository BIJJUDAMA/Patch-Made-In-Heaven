"use client";

import { useState, useEffect, useRef } from "react";

// ── Types ────────────────────────────────────────────────────────────────────
interface KnowledgeCard {
  id: string;
  problem: string;
  errorType: string;
  language: string;
  framework: string;
  status: string;
  score: number;
  reuseCount: number;
  patch: string;
  executionLog?: string;
}

const MCP_URL =
  "https://patch-made-in-works-on-my-machine-amrita-university-coimbatore.app.nitrocloud.ai/mcp";

const TOOLS = [
  {
    name: "search_fix",
    desc:
      "Finds verified patches matching a given stack trace or error log via BM25 full-text + dense vector hybrid search.",
  },
  {
    name: "find_similar",
    desc:
      "Performs semantic vector search across the knowledge store to surface related engineering fixes.",
  },
  {
    name: "get_patch",
    desc:
      "Returns the raw unified git diff patch for a verified solution by knowledge-entry ID.",
  },
  {
    name: "get_execution_log",
    desc:
      "Retrieves full stdout/stderr verification execution logs for a specific knowledge entry.",
  },
  {
    name: "verify_fix",
    desc:
      "Executes a candidate fix inside an isolated Docker sandbox and persists the outcome as a server-owned Verification Run.",
  },
  {
    name: "submit_fix",
    desc:
      "Publishes an execution-verified patch to the knowledge base after sandbox confirmation.",
  },
];

const LANG_OPTIONS = ["All", "Python", "TypeScript", "Go", "Rust", "Java", "C++"];
const STATUS_OPTIONS = ["All", "verified", "sandbox_passed", "pending", "failed"];

// ── Moth SVG (simplified) ────────────────────────────────────────────────────
const MothSVG = () => (
  <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Upper wings */}
    <path
      d="M100 100 C80 60, 20 40, 10 80 C5 105, 40 120, 100 100Z"
      fill="currentColor" opacity="0.9"
    />
    <path
      d="M100 100 C120 60, 180 40, 190 80 C195 105, 160 120, 100 100Z"
      fill="currentColor" opacity="0.9"
    />
    {/* Lower wings */}
    <path
      d="M100 100 C75 105, 30 120, 25 150 C20 175, 65 180, 100 110Z"
      fill="currentColor" opacity="0.7"
    />
    <path
      d="M100 100 C125 105, 170 120, 175 150 C180 175, 135 180, 100 110Z"
      fill="currentColor" opacity="0.7"
    />
    {/* Body */}
    <ellipse cx="100" cy="105" rx="5" ry="28" fill="currentColor" opacity="0.95" />
    {/* Antennae */}
    <path d="M97 78 Q85 50, 75 38" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.7" />
    <path d="M103 78 Q115 50, 125 38" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.7" />
    <circle cx="74" cy="37" r="3" fill="currentColor" opacity="0.7" />
    <circle cx="126" cy="37" r="3" fill="currentColor" opacity="0.7" />
    {/* Eye dots */}
    <circle cx="60" cy="78" r="6" fill="currentColor" opacity="0.45" />
    <circle cx="140" cy="78" r="6" fill="currentColor" opacity="0.45" />
  </svg>
);

// ── Helpers ──────────────────────────────────────────────────────────────────
function diffLines(patch: string) {
  if (!patch) return [];
  return patch.split("\n").map((line) => {
    if (line.startsWith("@@")) return { type: "hunk", line };
    if (line.startsWith("+")) return { type: "add", line };
    if (line.startsWith("-")) return { type: "del", line };
    return { type: "meta", line };
  });
}

// ── Custom Select ────────────────────────────────────────────────────────────
function FilterSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        className={`inspector-select-btn${open ? " open" : ""}`}
        onClick={() => setOpen(!open)}
      >
        <span style={{ textTransform: "uppercase", letterSpacing: "0.06em", fontSize: "12px" }}>
          {value}
        </span>
        <span style={{ opacity: 0.5, fontSize: "10px" }}>▼</span>
      </button>
      {open && (
        <div className="inspector-dropdown">
          {options.map((opt) => (
            <div
              key={opt}
              className={`inspector-dropdown-item${value === opt ? " active" : ""}`}
              onClick={() => { onChange(opt); setOpen(false); }}
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function Page() {
  const [cards, setCards] = useState<KnowledgeCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<KnowledgeCard | null>(null);
  const [tab, setTab] = useState<"patch" | "log">("patch");
  const [search, setSearch] = useState("");
  const [langFilter, setLangFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [copied, setCopied] = useState(false);
  const [heroVisible, setHeroVisible] = useState(true);

  const fetchCards = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/cards");
      if (r.ok) setCards(await r.json());
    } catch (_) {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchCards(); }, []);

  const filtered = cards.filter((c) => {
    const q = search.toLowerCase();
    const matchQ =
      !q ||
      c.problem?.toLowerCase().includes(q) ||
      c.errorType?.toLowerCase().includes(q) ||
      c.language?.toLowerCase().includes(q);
    const matchL = langFilter === "All" || c.language === langFilter;
    const matchS = statusFilter === "All" || c.status === statusFilter;
    return matchQ && matchL && matchS;
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(MCP_URL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const scrollToInspector = () => {
    document.getElementById("inspector")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <>
      {/* ── Frames ─────────────────────────────────────────────────────── */}
      <div className="frame top" id="top">
        <div className="nav-top-inner">
          <div className="nav-top-left">
            <span style={{ color: "var(--color-main2)" }}>—</span>
            <span style={{ color: "var(--color-main)", fontWeight: 600 }}>Patch Made In Heaven</span>
            <span className="nav-separator">•</span>
            <a href={MCP_URL} target="_blank" rel="noopener noreferrer">MCP Server</a>
            <span className="nav-separator">•</span>
            <a
              href="https://deerflow.tech"
              target="_blank"
              rel="noopener noreferrer"
            >
              Deerflow
            </a>
          </div>
          <div className="nav-top-right">
            <a href="#tools">Tools</a>
            <a href="#inspector">Inspector</a>
          </div>
        </div>
      </div>
      <div className="frame left" />
      <div className="frame right">
        <div className="nav-right">
          <a href="#top" title="Top">↑</a>
          <a href="#tools" title="Tools">⚙</a>
          <a href="#inspector" title="Inspector">◫</a>
          <a href="#top" title="Bottom">↓</a>
        </div>
      </div>
      <div className="frame bottom">
        <span>Patch Made In Heaven — MCP Knowledge Base &nbsp;•&nbsp; Created by&nbsp;<a href="https://deerflow.tech" target="_blank" rel="noopener noreferrer" style={{opacity:1,color:"var(--color-accent2)"}}>Deerflow</a></span>
      </div>

      {/* ── Main ───────────────────────────────────────────────────────── */}
      <div className="page-wrapper">
        <div style={{ maxWidth: "1240px", margin: "0 auto", padding: "0 1.5rem" }}>

          {/* ── Hero ─────────────────────────────────────────────────── */}
          <div className="hh-header">
            {/* Background moth */}
            <div className="hh-header-svg" style={{ color: "var(--color-accent1)" }}>
              <MothSVG />
            </div>

            {/* Pill badge */}
            <div style={{ position: "relative", zIndex: 2, marginBottom: "1.5rem", display: "flex", justifyContent: "center" }}>
              <div className="hh-subtitle-pill">
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#6ee7b7", display: "inline-block" }} />
                MCP Server · Live
              </div>
            </div>

            {/* Title */}
            <h1 className="hh-title">
              Patch Made
              <span className="hh-title-line2">In Heaven</span>
            </h1>

            {/* Endpoint */}
            <div style={{ display: "flex", justifyContent: "center", marginTop: "2.5rem" }}>
              <div className="hh-endpoint-card">
                <span style={{ color: "var(--color-main2)", fontSize: 11, opacity: 0.5, flexShrink: 0, letterSpacing: "0.06em" }}>SSE</span>
                <span className="hh-endpoint-url">{MCP_URL}</span>
                <button className="hh-copy-btn" onClick={handleCopy}>
                  <span>{copied ? "Copied!" : "Copy"}</span>
                </button>
              </div>
            </div>

            {/* CTA */}
            <div style={{ position: "relative", zIndex: 2, marginTop: "2rem", display: "flex", justifyContent: "center", gap: "1.5rem" }}>
              <button
                onClick={scrollToInspector}
                style={{
                  background: "none",
                  border: "1px solid rgba(255,255,255,0.18)",
                  color: "var(--color-main)",
                  padding: "10px 28px",
                  fontFamily: "var(--font-main)",
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  cursor: "pointer",
                  transition: "border-color 0.2s ease, color 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-accent2)";
                  (e.currentTarget as HTMLButtonElement).style.color = "var(--color-accent2)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.18)";
                  (e.currentTarget as HTMLButtonElement).style.color = "var(--color-main)";
                }}
              >
                Open Inspector ↓
              </button>
            </div>
          </div>

          {/* ── 01 — Available Tools ───────────────────────────────────── */}
          <div id="tools">
            <div className="category-title">
              <span className="category-number">01</span>
              <span>Available</span>
              <span className="category-highlight">Tools</span>
            </div>

            <div className="tools-grid">
              {TOOLS.map((t) => (
                <div className="tool-card-hh" key={t.name}>
                  <div className="tool-card-hh-name">{t.name.replace(/_/g, "_\u200B")}</div>
                  <div className="tool-card-hh-desc">{t.desc}</div>
                </div>
              ))}
            </div>

            {/* Quick connect */}
            <div className="forum-box" style={{ marginBottom: "0" }}>
              <div className="forum-box-inner">
                <div className="forum-box-title"><span>Connection Setup</span></div>
                <p className="forum-box-desc">
                  Connect directly using the Server-Sent Events (SSE) endpoint. Add it to your
                  Claude Desktop config, Cursor, or any MCP-compatible client. Supports
                  <code style={{ color: "var(--color-accent2)", margin: "0 4px" }}>search_fix</code>,
                  <code style={{ color: "var(--color-accent2)", margin: "0 4px" }}>find_similar</code>, and all
                  6 registered tools.
                </p>
                <div className="subforum-list" style={{ marginTop: "1rem" }}>
                  <a href="https://modelcontextprotocol.io" target="_blank" rel="noopener noreferrer">MCP Docs</a>
                  <a href="https://deerflow.tech" target="_blank" rel="noopener noreferrer">Deerflow</a>
                </div>
              </div>
              <div className="forum-box-right">
                <div className="forum-box-right-label">Transport</div>
                <div className="forum-box-right-value">SSE</div>
                <div className="forum-box-right-meta" style={{ marginTop: 8 }}>
                  <div className="forum-box-right-label">Auth</div>
                  <div className="forum-box-right-value">None Required</div>
                </div>
                <div style={{ marginTop: 14 }}>
                  <div className="forum-box-right-label">Status</div>
                  <span className="badge-pass">✓ Live</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── 02 — Knowledge Inspector ───────────────────────────────── */}
          <div id="inspector">
            <div className="category-title" style={{ alignItems: "center" }}>
              <span className="category-number">02</span>
              <span>Knowledge</span>
              <span className="category-highlight">Inspector</span>
              <div style={{ marginLeft: "auto" }}>
                <button
                  className="refresh-btn"
                  onClick={fetchCards}
                  disabled={loading}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    className={loading ? "spin" : ""}
                  >
                    <polyline points="23 4 23 10 17 10" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                  {loading ? "Loading…" : `Refresh (${cards.length})`}
                </button>
              </div>
            </div>

            <div className="inspector-wrap">
              {/* Filters */}
              <div className="inspector-filters">
                <input
                  className="inspector-input"
                  placeholder="Search problem, error type, language…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <FilterSelect value={langFilter} options={LANG_OPTIONS} onChange={setLangFilter} />
                <FilterSelect value={statusFilter} options={STATUS_OPTIONS} onChange={setStatusFilter} />
              </div>

              {/* 3-pane */}
              <div className="inspector-panes">

                {/* — List pane — */}
                <div className="inspector-pane">
                  <div className="inspector-pane-head">
                    <span>Entries</span>
                    <span style={{ color: "var(--color-accent2)" }}>{filtered.length}</span>
                  </div>
                  <div className="inspector-pane-body">
                    {loading && filtered.length === 0 && (
                      <div className="empty-state">Loading…</div>
                    )}
                    {!loading && filtered.length === 0 && (
                      <div className="empty-state">No entries match filters.</div>
                    )}
                    {filtered.map((c) => (
                      <div
                        key={c.id}
                        className={`card-item${selected?.id === c.id ? " selected" : ""}`}
                        onClick={() => { setSelected(c); setTab("patch"); }}
                      >
                        <div className="card-item-top">
                          <span className="card-item-error">{c.errorType || "—"}</span>
                          <span className={c.status === "verified" || c.status === "sandbox_passed" ? "badge-pass" : "badge-fail"}>
                            {c.status === "verified" || c.status === "sandbox_passed" ? "✓" : "✗"}&nbsp;{c.status}
                          </span>
                        </div>
                        <div className="card-item-title">{c.problem}</div>
                        <div className="card-item-footer">
                          <span>{c.language || "—"}</span>
                          {c.framework && <span>{c.framework}</span>}
                          <span style={{ marginLeft: "auto" }}>↻ {c.reuseCount}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* — Diff / Log pane — */}
                <div className="inspector-pane" style={{ borderRight: "none" }}>
                  {!selected ? (
                    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div className="empty-state">
                        <div className="hh-plus-group" style={{ fontSize: 20, opacity: 0.3 }}>
                          <span>+</span><span>+</span><span>+</span>
                        </div>
                        Select an entry to inspect
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="tab-bar">
                        <button
                          className={`tab-btn${tab === "patch" ? " active" : ""}`}
                          onClick={() => setTab("patch")}
                        >
                          Patch Diff
                        </button>
                        <button
                          className={`tab-btn${tab === "log" ? " active" : ""}`}
                          onClick={() => setTab("log")}
                        >
                          Execution Log
                        </button>
                      </div>
                      <div className="inspector-pane-body">
                        {tab === "patch" ? (
                          selected.patch ? (
                            <div className="diff-view">
                              {diffLines(selected.patch).map((dl, i) => (
                                <div
                                  key={i}
                                  className={`diff-line ${
                                    dl.type === "add"
                                      ? "diff-add"
                                      : dl.type === "del"
                                      ? "diff-del"
                                      : dl.type === "hunk"
                                      ? "diff-hunk"
                                      : "diff-meta"
                                  }`}
                                >
                                  {dl.line}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="empty-state">No patch data.</div>
                          )
                        ) : selected.executionLog ? (
                          <pre style={{ margin: "14px 18px", fontSize: 11 }}>{selected.executionLog}</pre>
                        ) : (
                          <div className="empty-state">No execution log.</div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* — Meta pane — */}
                <div className="inspector-pane" style={{ borderLeft: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="inspector-pane-head">
                    <span>Metadata</span>
                  </div>
                  <div className="inspector-pane-body">
                    {!selected ? (
                      <div className="empty-state" style={{ paddingTop: "2rem" }}>—</div>
                    ) : (
                      <>
                        <div className="meta-row">
                          <span className="meta-key">Status</span>
                          <span>
                            {selected.status === "verified" || selected.status === "sandbox_passed" ? (
                              <span className="badge-pass">✓ {selected.status}</span>
                            ) : (
                              <span className="badge-fail">✗ {selected.status}</span>
                            )}
                          </span>
                        </div>
                        <div className="meta-row">
                          <span className="meta-key">Language</span>
                          <span className="meta-val">{selected.language || "—"}</span>
                        </div>
                        <div className="meta-row">
                          <span className="meta-key">Framework</span>
                          <span className="meta-val">{selected.framework || "—"}</span>
                        </div>
                        <div className="meta-row">
                          <span className="meta-key">Error Type</span>
                          <span className="meta-val" style={{ color: "var(--color-accent2)" }}>{selected.errorType || "—"}</span>
                        </div>
                        <div className="meta-row">
                          <span className="meta-key">Score</span>
                          <span className="meta-val">{selected.score ?? "—"}</span>
                        </div>
                        <div className="meta-row">
                          <span className="meta-key">Reuse Count</span>
                          <span className="meta-val">{selected.reuseCount ?? 0}</span>
                        </div>
                        <div className="meta-row">
                          <span className="meta-key">ID</span>
                          <span className="meta-val" style={{ fontSize: 10, fontFamily: "monospace", opacity: 0.7 }}>
                            {selected.id}
                          </span>
                        </div>
                        <div style={{ padding: "18px" }}>
                          <div className="forum-box-right-label" style={{ marginBottom: 8 }}>Problem</div>
                          <p style={{ fontSize: 11, color: "var(--color-main)", opacity: 0.75, lineHeight: 1.6 }}>
                            {selected.problem}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Footer ──────────────────────────────────────────────── */}
          <div className="hh-footer">
            <span>Patch Made In Heaven &nbsp;•&nbsp; MCP Knowledge Base</span>
            <span>
              Created by&nbsp;
              <a
                href="https://deerflow.tech"
                target="_blank"
                rel="noopener noreferrer"
                style={{ opacity: 1, color: "var(--color-accent2)" }}
              >
                Deerflow
              </a>
            </span>
          </div>

        </div>
      </div>
    </>
  );
}
