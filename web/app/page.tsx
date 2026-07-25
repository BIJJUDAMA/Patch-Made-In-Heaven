"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";

// ── Dynamic import — Three.js must be client-only ──────────────────────────
const ToolCarousel = dynamic(() => import("./components/ToolCarousel"), { ssr: false });

// ── Types ──────────────────────────────────────────────────────────────────
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
  { num: "01", name: "search_fix",       tag: "Retrieval", desc: "Finds verified patches matching a given stack trace or error log via BM25 full-text + dense vector hybrid search." },
  { num: "02", name: "find_similar",     tag: "Semantic",  desc: "Performs semantic vector search across the knowledge store to surface related engineering fixes." },
  { num: "03", name: "get_patch",        tag: "Retrieval", desc: "Returns the raw unified git diff patch for a verified solution by knowledge-entry ID." },
  { num: "04", name: "get_execution_log",tag: "Logs",      desc: "Retrieves full stdout/stderr verification execution logs for a specific knowledge entry." },
  { num: "05", name: "verify_fix",       tag: "Sandbox",   desc: "Executes a candidate fix inside an isolated Docker sandbox and persists the outcome as a Verification Run." },
  { num: "06", name: "submit_fix",       tag: "Write",     desc: "Publishes an execution-verified patch to the knowledge base after sandbox confirmation." },
];

const LANG_OPTIONS   = ["All", "Python", "TypeScript", "Go", "Rust", "Java", "C++"];
const STATUS_OPTIONS = ["All", "verified", "sandbox_passed", "pending", "failed"];

// ── Moth SVG ───────────────────────────────────────────────────────────────
const Moth = () => (
  <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%", color: "currentColor" }}>
    <path d="M100 100 C80 60, 20 40, 10 80 C5 105, 40 120, 100 100Z" fill="currentColor" opacity="0.85" />
    <path d="M100 100 C120 60, 180 40, 190 80 C195 105, 160 120, 100 100Z" fill="currentColor" opacity="0.85" />
    <path d="M100 100 C75 105, 30 120, 25 150 C20 175, 65 180, 100 110Z" fill="currentColor" opacity="0.6" />
    <path d="M100 100 C125 105, 170 120, 175 150 C180 175, 135 180, 100 110Z" fill="currentColor" opacity="0.6" />
    <ellipse cx="100" cy="105" rx="4.5" ry="27" fill="currentColor" opacity="0.95" />
    <path d="M97 78 Q85 50, 75 38" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.65" />
    <path d="M103 78 Q115 50, 125 38" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.65" />
    <circle cx="74" cy="37" r="2.5" fill="currentColor" opacity="0.65" />
    <circle cx="126" cy="37" r="2.5" fill="currentColor" opacity="0.65" />
    <circle cx="62" cy="78"  r="5" fill="currentColor" opacity="0.35" />
    <circle cx="138" cy="78" r="5" fill="currentColor" opacity="0.35" />
  </svg>
);

// ── Diff helpers ───────────────────────────────────────────────────────────
function diffLines(patch: string) {
  return (patch || "").split("\n").map((line) => {
    if (line.startsWith("@@")) return { type: "hunk", line };
    if (line.startsWith("+"))  return { type: "add",  line };
    if (line.startsWith("-"))  return { type: "del",  line };
    return { type: "meta", line };
  });
}

// ── Filter select ──────────────────────────────────────────────────────────
function FilterSelect({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} className="filter-select-wrap">
      <button className={`filter-select-btn${open ? " open" : ""}`} onClick={() => setOpen(!open)}>
        <span>{value}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div className="filter-dropdown">
          {options.map((o) => (
            <div key={o} className={`filter-option${value === o ? " active" : ""}`} onClick={() => { onChange(o); setOpen(false); }}>{o}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function Page() {
  const [cards, setCards]         = useState<KnowledgeCard[]>([]);
  const [loading, setLoading]     = useState(false);
  const [selected, setSelected]   = useState<KnowledgeCard | null>(null);
  const [tab, setTab]             = useState<"patch" | "log">("patch");
  const [search, setSearch]       = useState("");
  const [langFilter, setLangFilter]     = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [copied, setCopied]       = useState(false);

  const fetchCards = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/cards");
      if (r.ok) {
        const data = await r.json();
        setCards(Array.isArray(data) ? data : (data?.cards ?? data?.data ?? []));
      }
    } catch (_) {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchCards(); }, []);

  const filtered = cards.filter((c) => {
    const q = search.toLowerCase();
    const matchQ = !q || c.problem?.toLowerCase().includes(q) || c.errorType?.toLowerCase().includes(q) || c.language?.toLowerCase().includes(q);
    const matchL = langFilter   === "All" || c.language === langFilter;
    const matchS = statusFilter === "All" || c.status   === statusFilter;
    return matchQ && matchL && matchS;
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(MCP_URL).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  return (
    <>
      {/* ── Frames ──────────────────────────────────────────────────── */}
      <div className="frame top" id="top">
        <div className="nav-inner">
          <div className="nav-left">
            <span className="nav-brand">Patch Made In Heaven</span>
            <span className="nav-dot">·</span>
            <a href={MCP_URL} target="_blank" rel="noopener noreferrer">MCP</a>
            <span className="nav-dot">·</span>
            <a href="https://deerflow.tech" target="_blank" rel="noopener noreferrer">Deerflow</a>
          </div>
          <div className="nav-right">
            <a href="#tools">Tools</a>
            <a href="#inspector">Inspector</a>
          </div>
        </div>
      </div>
      <div className="frame left" />
      <div className="frame right">
        <div className="nav-right-side">
          <a href="#top">↑</a>
          <a href="#tools">⚙</a>
          <a href="#inspector">◫</a>
          <a href="#top">↓</a>
        </div>
      </div>
      <div className="frame bottom">
        <span>Patch Made In Heaven &nbsp;·&nbsp; MCP Knowledge Base &nbsp;·&nbsp;
          <a href="https://deerflow.tech" target="_blank" rel="noopener noreferrer"
             style={{ color: "var(--accent2)", opacity: 1, marginLeft: 6 }}>
            Deerflow
          </a>
        </span>
      </div>

      {/* ── Main ────────────────────────────────────────────────────── */}
      <div className="wrapper">
        <div className="inner">

          {/* ── Hero ────────────────────────────────────────────────── */}
          <section className="hero">
            <div className="hero-moth" style={{ color: "var(--accent1)" }}>
              <Moth />
            </div>

            <div className="hero-eyebrow">
              <span className="hero-eyebrow-dot" />
              MCP Server · Live
            </div>

            <h1 className="hero-title">
              <span>Patch Made</span>
              <span>In Heaven</span>
            </h1>

            <p className="hero-sub">MCP Knowledge Base &nbsp;·&nbsp; {TOOLS.length} registered tools</p>

            <div className="hero-endpoint">
              <span className="hero-url">{MCP_URL}</span>
              <button className="hero-copy" onClick={handleCopy}>
                {copied ? "Copied" : "Copy"}
              </button>
            </div>

            <div className="hero-scroll-hint">
              <div className="scroll-mouse" />
              <span>Scroll to explore</span>
            </div>
          </section>

          {/* ── 01 — Tools ──────────────────────────────────────────── */}
          <section id="tools">
            <div className="section-divider">
              <div className="section-divider-line" />
              <div className="section-divider-label">
                <span className="section-divider-num">01</span>
                Available
                <span className="section-divider-tag">Tools</span>
              </div>
              <div className="section-divider-line" style={{ maxWidth: 60 }} />
            </div>

            {/* Three.js rotating carousel */}
            <ToolCarousel tools={TOOLS} />

            <div className="carousel-hint">
              <span className="carousel-hint-line" />
              Drag to rotate
              <span className="carousel-hint-line" />
            </div>

            {/* Connection strip */}
            <div className="connect-strip" style={{ marginTop: "2.5rem" }}>
              <div className="connect-strip-cell">
                <div className="connect-cell-label">Transport</div>
                <div className="connect-cell-value">SSE &mdash; Server-Sent Events</div>
                <div className="connect-cell-sub">No authentication required</div>
              </div>
              <div className="connect-strip-cell">
                <div className="connect-cell-label">Compatible Clients</div>
                <div className="connect-cell-value">Claude Desktop &nbsp;· Cursor &nbsp;· Zed</div>
                <div className="connect-cell-sub">Any MCP-compliant host</div>
              </div>
              <div className="connect-strip-cell">
                <div className="connect-cell-label">Status</div>
                <div className="connect-cell-value" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="badge badge-pass">✓ Live</span>
                </div>
                <div className="connect-cell-sub">NitroCloud · Amrita</div>
              </div>
            </div>
          </section>

          {/* ── 02 — Inspector ──────────────────────────────────────── */}
          <section id="inspector">
            <div className="section-divider">
              <div className="section-divider-line" />
              <div className="section-divider-label">
                <span className="section-divider-num">02</span>
                Knowledge
                <span className="section-divider-tag">Inspector</span>
              </div>
              <div className="section-divider-line" style={{ maxWidth: 60 }} />
              <button className="btn-refresh" onClick={fetchCards} disabled={loading} style={{ marginLeft: "auto", flexShrink: 0 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={loading ? "spin" : ""}>
                  <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
                {loading ? "Loading" : `${cards.length} entries`}
              </button>
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
                <FilterSelect value={langFilter}   options={LANG_OPTIONS}   onChange={setLangFilter} />
                <FilterSelect value={statusFilter} options={STATUS_OPTIONS} onChange={setStatusFilter} />
              </div>

              {/* 3 panes */}
              <div className="inspector-panes">

                {/* — List — */}
                <div className="pane">
                  <div className="pane-head">
                    <span>Entries</span>
                    <span style={{ color: "var(--accent2)" }}>{filtered.length}</span>
                  </div>
                  <div className="pane-body">
                    {loading && filtered.length === 0 && <div className="empty-state">Loading…</div>}
                    {!loading && filtered.length === 0 && <div className="empty-state">No entries match filters.</div>}
                    {filtered.map((c) => (
                      <div
                        key={c.id}
                        className={`card-item${selected?.id === c.id ? " active" : ""}`}
                        onClick={() => { setSelected(c); setTab("patch"); }}
                      >
                        <div className="card-item-top">
                          <span className="card-item-error">{c.errorType || "—"}</span>
                          <span className={`badge ${c.status === "verified" || c.status === "sandbox_passed" ? "badge-pass" : "badge-fail"}`}>
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

                {/* — Diff / Log — */}
                <div className="pane">
                  {!selected ? (
                    <div className="empty-state" style={{ flex: 1, padding: "4rem" }}>Select an entry</div>
                  ) : (
                    <>
                      <div className="tab-row">
                        <button className={`tab-btn${tab === "patch" ? " active" : ""}`} onClick={() => setTab("patch")}>Patch Diff</button>
                        <button className={`tab-btn${tab === "log"   ? " active" : ""}`} onClick={() => setTab("log")  }>Exec Log</button>
                      </div>
                      <div className="pane-body">
                        {tab === "patch" ? (
                          selected.patch ? (
                            diffLines(selected.patch).map((dl, i) => (
                              <div key={i} className={`diff-line diff-${dl.type}`}>{dl.line}</div>
                            ))
                          ) : <div className="empty-state">No patch data.</div>
                        ) : selected.executionLog ? (
                          <pre>{selected.executionLog}</pre>
                        ) : <div className="empty-state">No execution log.</div>}
                      </div>
                    </>
                  )}
                </div>

                {/* — Metadata — */}
                <div className="pane" style={{ borderLeft: "1px solid var(--line)" }}>
                  <div className="pane-head"><span>Metadata</span></div>
                  <div className="pane-body">
                    {!selected ? (
                      <div className="empty-state">—</div>
                    ) : (
                      <>
                        <div className="meta-row">
                          <span className="meta-key">Status</span>
                          <span className={`badge ${selected.status === "verified" || selected.status === "sandbox_passed" ? "badge-pass" : "badge-fail"}`}>
                            {selected.status === "verified" || selected.status === "sandbox_passed" ? "✓" : "✗"} {selected.status}
                          </span>
                        </div>
                        {[
                          ["Language",   selected.language  || "—"],
                          ["Framework",  selected.framework || "—"],
                          ["Error Type", selected.errorType || "—"],
                          ["Score",      String(selected.score ?? "—")],
                          ["Reuse",      String(selected.reuseCount ?? 0)],
                        ].map(([k, v]) => (
                          <div className="meta-row" key={k}>
                            <span className="meta-key">{k}</span>
                            <span className="meta-val" style={k === "Error Type" ? { color: "var(--accent2)" } : {}}>{v}</span>
                          </div>
                        ))}
                        <div className="meta-row" style={{ flexDirection: "column", gap: 8 }}>
                          <span className="meta-key">Problem</span>
                          <span style={{ fontSize: 11, color: "var(--cream)", opacity: 0.75, lineHeight: 1.55 }}>
                            {selected.problem}
                          </span>
                        </div>
                        <div className="meta-row">
                          <span className="meta-key">ID</span>
                          <span className="meta-val" style={{ fontSize: 9, fontFamily: "var(--font-mono)", opacity: 0.55 }}>
                            {selected.id}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

              </div>
            </div>
          </section>

          {/* ── Footer ──────────────────────────────────────────────── */}
          <footer className="page-footer">
            <span>Patch Made In Heaven &nbsp;·&nbsp; MCP Knowledge Base</span>
            <span>
              Created by&nbsp;
              <a href="https://deerflow.tech" target="_blank" rel="noopener noreferrer"
                 style={{ opacity: 1, color: "var(--accent2)" }}>Deerflow</a>
            </span>
          </footer>

        </div>
      </div>
    </>
  );
}
