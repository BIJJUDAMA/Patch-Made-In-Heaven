'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Terminal,
  Code2,
  AlertTriangle,
  RefreshCw,
  Layers,
  CheckCircle2,
  XCircle,
  Clock,
  Copy,
  Check,
  ChevronDown,
  Cpu,
  Database,
  Hash,
  Activity,
  Box,
  ChevronRight,
} from 'lucide-react';

export interface KnowledgeCardView {
  id: string;
  problem: string;
  errorType: string;
  stacktrace: string;
  environment: {
    language: string;
    version?: string;
    framework?: string;
    packageVersions?: Record<string, string>;
  };
  patch: string;
  verification: {
    status: string;
    score: number;
    lastVerified: string;
    sandbox: string;
    exitCode: number;
    durationMs: number;
    stdout: string;
    stderr: string;
  };
  metrics: {
    reuseCount: number;
  };
  provenance?: {
    source: string;
    category: string;
    addedAt: string;
  };
}

const MCP_URL = 'https://patch-made-in-works-on-my-machine-amrita-university-coimbatore.app.nitrocloud.ai/mcp';

const TOOLS = [
  {
    name: 'search_fix',
    description: 'Finds verified patches and fixes matching a given stack trace or error log.',
  },
  {
    name: 'find_similar',
    description: 'Performs semantic vector search across the knowledge store to find related engineering fixes.',
  },
  {
    name: 'get_patch',
    description: 'Returns the raw unified git diff patch for a verified solution.',
  },
  {
    name: 'get_execution_log',
    description: 'Retrieves full stdout/stderr verification execution logs for a specific knowledge entry.',
  },
  {
    name: 'verify_fix',
    description:
      'Executes a candidate fix inside an isolated sandbox against a real test command and persists the outcome as a server-owned Verification Run, later matched (never trusted) by submit_fix.',
  },
  {
    name: 'submit_fix',
    description:
      'Publishes an execution-verified patch to the knowledge base. Only stores a fix backed by a real, matching, PASS-status Verification Run — never trusts a caller-supplied verification status.',
  },
];

export default function Dashboard() {
  const [cards, setCards] = useState<KnowledgeCardView[]>([]);
  const [selectedCard, setSelectedCard] = useState<KnowledgeCardView | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isLiveElastic, setIsLiveElastic] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [selectedErrorType, setSelectedErrorType] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'diff' | 'logs' | 'trace'>('diff');
  const [copied, setCopied] = useState<boolean>(false);
  const [langDropdownOpen, setLangDropdownOpen] = useState<boolean>(false);
  const [errorDropdownOpen, setErrorDropdownOpen] = useState<boolean>(false);

  const langRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const fetchCards = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/cards');
      const data = await res.json();
      if (!data.ok) throw new Error(data.error?.message || 'Failed to fetch cards');
      setCards(data.cards || []);
      setIsLiveElastic(data.isLiveElastic ?? false);
      if (data.cards?.length > 0) {
        setSelectedCard((prev) =>
          prev ? data.cards.find((c: KnowledgeCardView) => c.id === prev.id) || data.cards[0] : data.cards[0]
        );
      } else {
        setSelectedCard(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCards(); }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (langRef.current && !langRef.current.contains(event.target as Node)) setLangDropdownOpen(false);
      if (errorRef.current && !errorRef.current.contains(event.target as Node)) setErrorDropdownOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const languages = useMemo(() => {
    const set = new Set<string>();
    cards.forEach((c) => { if (c.environment?.language) set.add(c.environment.language); });
    return Array.from(set).sort();
  }, [cards]);

  const errorTypes = useMemo(() => {
    const set = new Set<string>();
    cards.forEach((c) => { if (c.errorType) set.add(c.errorType); });
    return Array.from(set).sort();
  }, [cards]);

  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      const matchesSearch =
        !searchQuery ||
        card.problem.toLowerCase().includes(searchQuery.toLowerCase()) ||
        card.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        card.errorType.toLowerCase().includes(searchQuery.toLowerCase()) ||
        card.stacktrace.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesLang = selectedLanguage === 'all' || card.environment?.language?.toLowerCase() === selectedLanguage.toLowerCase();
      const matchesError = selectedErrorType === 'all' || card.errorType?.toLowerCase() === selectedErrorType.toLowerCase();
      return matchesSearch && matchesLang && matchesError;
    });
  }, [cards, searchQuery, selectedLanguage, selectedErrorType]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderFormattedDiff = (patch: string) => {
    if (!patch) return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-low)', fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
        No patch available.
      </div>
    );
    const lines = patch.split('\n');
    return (
      <div className="diff-container" style={{ padding: '0.5rem 0' }}>
        {lines.map((line, i) => {
          let bg = 'transparent';
          let color = 'var(--text-medium)';
          if (line.startsWith('+') && !line.startsWith('+++')) { bg = 'rgba(110, 231, 183, 0.07)'; color = 'var(--status-pass)'; }
          else if (line.startsWith('-') && !line.startsWith('---')) { bg = 'rgba(252, 165, 165, 0.07)'; color = 'var(--status-fail)'; }
          else if (line.startsWith('@@')) { bg = 'rgba(232, 160, 32, 0.07)'; color = 'var(--accent-primary)'; }
          else if (line.startsWith('diff') || line.startsWith('---') || line.startsWith('+++')) { color = 'var(--text-low)'; }
          return (
            <div
              key={i}
              className="diff-line"
              style={{
                backgroundColor: bg,
                color,
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                lineHeight: 1.6,
                padding: '0.0625rem 1rem',
              }}
            >
              {line || ' '}
            </div>
          );
        })}
      </div>
    );
  };

  /* ── Shared input/button styles ── */
  const inputBase: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem 1rem',
    borderRadius: '6px',
    backgroundColor: 'var(--surface-subtle)',
    border: '1px solid var(--border-muted)',
    color: 'var(--text-high)',
    fontSize: '0.875rem',
    fontFamily: 'var(--font-body)',
    outline: 'none',
    transition: 'border-color 160ms ease',
  };

  const dropdownItemStyle = (active: boolean): React.CSSProperties => ({
    padding: '0.5rem 0.75rem',
    borderRadius: '4px',
    fontSize: '0.8125rem',
    fontFamily: 'var(--font-body)',
    color: active ? 'var(--text-high)' : 'var(--text-medium)',
    backgroundColor: active ? 'var(--surface-hover)' : 'transparent',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    transition: 'background-color 120ms ease',
  });

  /* ────────────────────────────────────────────────
     RENDER
  ──────────────────────────────────────────────── */
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-app)', color: 'var(--text-high)' }}>

      {/* ══════════════════════════════════════════
          HERO — full viewport, only thing visible on load
      ══════════════════════════════════════════ */}
      <section
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Top bar */}
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1.5rem 3rem',
            borderBottom: '1px solid var(--border-muted)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '1.75rem',
                height: '1.75rem',
                borderRadius: '4px',
                backgroundColor: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ color: '#0e0e0e', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '0.75rem', lineHeight: 1 }}>P</span>
            </div>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.9375rem', letterSpacing: '-0.01em', color: 'var(--text-high)' }}>
              Patch Made In Heaven
            </span>
          </div>

          <button
            onClick={fetchCards}
            disabled={loading}
            className="active-press"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.5rem 0.875rem',
              borderRadius: '6px',
              backgroundColor: 'var(--surface-panel)',
              border: '1px solid var(--border-muted)',
              color: 'var(--text-medium)',
              fontSize: '0.8125rem',
              fontFamily: 'var(--font-body)',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            <RefreshCw style={{ width: '0.875rem', height: '0.875rem', animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
        </header>

        {/* Main hero content — centered */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4rem 2rem',
            textAlign: 'center',
            maxWidth: '760px',
            margin: '0 auto',
            width: '100%',
          }}
        >
          {/* Eyebrow */}
          <div
            className="stagger-1"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.25rem 0.875rem',
              borderRadius: '100px',
              border: '1px solid var(--border-strong)',
              backgroundColor: 'var(--surface-subtle)',
              color: 'var(--text-low)',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.04em',
              marginBottom: '2.5rem',
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)', display: 'inline-block' }} />
            MCP Server
          </div>

          {/* Title */}
          <h1
            className="stagger-2 display-font"
            style={{
              fontSize: 'clamp(2.5rem, 7vw, 4.5rem)',
              fontWeight: 800,
              letterSpacing: '-0.04em',
              lineHeight: 1.0,
              color: 'var(--text-high)',
              marginBottom: '1.5rem',
            }}
          >
            Patch Made<br />
            <span style={{ color: 'var(--accent-primary)' }}>In Heaven</span>
          </h1>

          {/* Subtitle */}
          <p
            className="stagger-3"
            style={{
              fontSize: '1.0625rem',
              color: 'var(--text-medium)',
              lineHeight: 1.7,
              fontWeight: 300,
              maxWidth: '520px',
              marginBottom: '3rem',
            }}
          >
            A powerful MCP server built with NitroStack. Connect directly using the Server-Sent Events endpoint:
          </p>

          {/* Endpoint card */}
          <div
            className="stagger-4"
            style={{
              width: '100%',
              maxWidth: '600px',
              backgroundColor: 'var(--surface-subtle)',
              border: '1px solid var(--border-strong)',
              borderRadius: '10px',
              padding: '1.25rem 1.5rem',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
            }}
          >
            <div
              className="endpoint-text"
              style={{ flex: 1, textAlign: 'left', wordBreak: 'break-all', lineHeight: 1.5 }}
            >
              {MCP_URL}
            </div>
            <button
              onClick={() => copyToClipboard(MCP_URL)}
              className="active-press"
              style={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.5rem 0.875rem',
                borderRadius: '6px',
                backgroundColor: copied ? 'var(--status-pass-subtle)' : 'var(--accent-primary)',
                color: copied ? 'var(--status-pass)' : '#0e0e0e',
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                fontSize: '0.8125rem',
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'background-color 200ms ease, color 200ms ease',
              }}
            >
              {copied ? <Check style={{ width: '0.875rem', height: '0.875rem' }} /> : <Copy style={{ width: '0.875rem', height: '0.875rem' }} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          {/* CTA scroll hint */}
          <a
            className="stagger-5 active-press"
            href="#tools"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--text-low)',
              fontSize: '0.8125rem',
              fontFamily: 'var(--font-mono)',
              textDecoration: 'none',
              letterSpacing: '0.03em',
              transition: 'color 200ms ease',
            }}
          >
            View available tools
            <ChevronRight style={{ width: '0.875rem', height: '0.875rem' }} />
          </a>
        </div>

        {/* Ambient glow — behind the title */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: '30%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '600px',
            height: '400px',
            background: 'radial-gradient(ellipse at center, rgba(232, 160, 32, 0.07) 0%, transparent 70%)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
      </section>

      {/* ══════════════════════════════════════════
          AVAILABLE TOOLS
      ══════════════════════════════════════════ */}
      <section
        id="tools"
        style={{
          borderTop: '1px solid var(--border-muted)',
          padding: '5rem 3rem',
          backgroundColor: 'var(--bg-app)',
        }}
      >
        <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
          {/* Section heading */}
          <div style={{ marginBottom: '3rem' }}>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.6875rem',
                letterSpacing: '0.12em',
                color: 'var(--text-low)',
                textTransform: 'uppercase',
                marginBottom: '0.75rem',
              }}
            >
              01 — Tools
            </div>
            <h2
              className="display-font"
              style={{
                fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)',
                fontWeight: 700,
                letterSpacing: '-0.03em',
                lineHeight: 1.1,
                color: 'var(--text-high)',
              }}
            >
              Available Tools
            </h2>
          </div>

          {/* Tool grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '1px',
              backgroundColor: 'var(--border-muted)',
              border: '1px solid var(--border-muted)',
              borderRadius: '10px',
              overflow: 'hidden',
            }}
          >
            {TOOLS.map((tool, i) => (
              <div
                key={tool.name}
                className="tool-card"
                style={{
                  backgroundColor: 'var(--surface-subtle)',
                  padding: '2rem',
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: 'var(--accent-primary)',
                    marginBottom: '0.875rem',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {tool.name}
                </div>
                <p
                  style={{
                    fontSize: '0.875rem',
                    color: 'var(--text-medium)',
                    lineHeight: 1.65,
                    fontWeight: 300,
                    margin: 0,
                  }}
                >
                  {tool.description}
                </p>
              </div>
            ))}
          </div>

          {/* Footer attribution */}
          <div
            style={{
              marginTop: '3rem',
              paddingTop: '2rem',
              borderTop: '1px solid var(--border-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-low)', letterSpacing: '0.02em' }}>
              Powered by NitroStack — TypeScript MCP Framework
            </span>
            <a
              href="#inspector"
              className="active-press"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                backgroundColor: 'var(--surface-panel)',
                border: '1px solid var(--border-strong)',
                color: 'var(--text-medium)',
                fontSize: '0.8125rem',
                fontFamily: 'var(--font-body)',
                textDecoration: 'none',
                transition: 'color 160ms ease, border-color 160ms ease',
              }}
            >
              Open Live Inspector
              <ChevronRight style={{ width: '0.875rem', height: '0.875rem' }} />
            </a>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          LIVE KNOWLEDGE BASE INSPECTOR
      ══════════════════════════════════════════ */}
      <section
        id="inspector"
        style={{
          borderTop: '1px solid var(--border-muted)',
          padding: '5rem 3rem 6rem',
          backgroundColor: 'var(--surface-subtle)',
        }}
      >
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>

          {/* Section heading */}
          <div style={{ marginBottom: '2.5rem' }}>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.6875rem',
                letterSpacing: '0.12em',
                color: 'var(--text-low)',
                textTransform: 'uppercase',
                marginBottom: '0.75rem',
              }}
            >
              02 — Inspector
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
              <h2
                className="display-font"
                style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-high)' }}
              >
                Knowledge Base
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: isLiveElastic ? 'var(--status-pass)' : 'var(--text-low)',
                  }}
                />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-low)', letterSpacing: '0.02em' }}>
                  {isLiveElastic ? 'Elasticsearch · Live' : 'Seed Data'}
                </span>
              </div>
            </div>
          </div>

          {/* Error state */}
          {error && (
            <div
              style={{
                marginBottom: '2rem',
                padding: '1rem 1.25rem',
                borderRadius: '8px',
                backgroundColor: 'var(--status-fail-subtle)',
                border: '1px solid var(--status-fail-border)',
                color: 'var(--status-fail)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                fontSize: '0.875rem',
              }}
            >
              <AlertTriangle style={{ width: '1.125rem', height: '1.125rem', flexShrink: 0 }} />
              {error}
            </div>
          )}

          {/* Filters */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.75rem', marginBottom: '2rem' }}>
            {/* Search */}
            <div style={{ position: 'relative' }}>
              <Search
                style={{
                  position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)',
                  width: '1rem', height: '1rem', color: 'var(--text-low)',
                }}
              />
              <input
                type="text"
                placeholder="Search errors, stack traces..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ ...inputBase, paddingLeft: '2.75rem' }}
              />
            </div>

            {/* Language dropdown */}
            <div ref={langRef} style={{ position: 'relative' }}>
              <button
                onClick={() => { setLangDropdownOpen(!langDropdownOpen); setErrorDropdownOpen(false); }}
                className="active-press"
                style={{
                  ...inputBase,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  border: langDropdownOpen ? '1px solid var(--accent-primary)' : '1px solid var(--border-muted)',
                }}
              >
                <span style={{ color: selectedLanguage === 'all' ? 'var(--text-low)' : 'var(--text-high)' }}>
                  {selectedLanguage === 'all' ? `All Runtimes (${cards.length})` : selectedLanguage.toUpperCase()}
                </span>
                <ChevronDown style={{ width: '0.875rem', height: '0.875rem', color: 'var(--text-low)', transform: langDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease' }} />
              </button>
              {langDropdownOpen && (
                <div className="apple-menu-anim" style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50, backgroundColor: 'var(--surface-panel)', border: '1px solid var(--border-strong)', borderRadius: '8px', boxShadow: '0 16px 40px rgba(0,0,0,0.5)', padding: '0.25rem', maxHeight: '220px', overflowY: 'auto' }}>
                  <div onClick={() => { setSelectedLanguage('all'); setLangDropdownOpen(false); }} style={dropdownItemStyle(selectedLanguage === 'all')}>
                    <span>All Runtimes</span>
                    {selectedLanguage === 'all' && <Check style={{ width: '0.75rem', height: '0.75rem', color: 'var(--accent-primary)' }} />}
                  </div>
                  {languages.map((lang) => (
                    <div key={lang} onClick={() => { setSelectedLanguage(lang); setLangDropdownOpen(false); }} style={dropdownItemStyle(selectedLanguage === lang)}>
                      <span>{lang.toUpperCase()}</span>
                      {selectedLanguage === lang && <Check style={{ width: '0.75rem', height: '0.75rem', color: 'var(--accent-primary)' }} />}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Error type dropdown */}
            <div ref={errorRef} style={{ position: 'relative' }}>
              <button
                onClick={() => { setErrorDropdownOpen(!errorDropdownOpen); setLangDropdownOpen(false); }}
                className="active-press"
                style={{
                  ...inputBase,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  border: errorDropdownOpen ? '1px solid var(--accent-primary)' : '1px solid var(--border-muted)',
                }}
              >
                <span style={{ color: selectedErrorType === 'all' ? 'var(--text-low)' : 'var(--text-high)' }}>
                  {selectedErrorType === 'all' ? 'All Error Classes' : selectedErrorType}
                </span>
                <ChevronDown style={{ width: '0.875rem', height: '0.875rem', color: 'var(--text-low)', transform: errorDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease' }} />
              </button>
              {errorDropdownOpen && (
                <div className="apple-menu-anim" style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50, backgroundColor: 'var(--surface-panel)', border: '1px solid var(--border-strong)', borderRadius: '8px', boxShadow: '0 16px 40px rgba(0,0,0,0.5)', padding: '0.25rem', maxHeight: '220px', overflowY: 'auto' }}>
                  <div onClick={() => { setSelectedErrorType('all'); setErrorDropdownOpen(false); }} style={dropdownItemStyle(selectedErrorType === 'all')}>
                    <span>All Error Classes</span>
                    {selectedErrorType === 'all' && <Check style={{ width: '0.75rem', height: '0.75rem', color: 'var(--accent-primary)' }} />}
                  </div>
                  {errorTypes.map((err) => (
                    <div key={err} onClick={() => { setSelectedErrorType(err); setErrorDropdownOpen(false); }} style={dropdownItemStyle(selectedErrorType === err)}>
                      <span>{err}</span>
                      {selectedErrorType === err && <Check style={{ width: '0.75rem', height: '0.75rem', color: 'var(--accent-primary)' }} />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 3-Pane Inspector Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr 300px', gap: '1rem', alignItems: 'stretch' }}>

            {/* ── Pane 1: Card List ── */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', letterSpacing: '0.1em', color: 'var(--text-low)', textTransform: 'uppercase' }}>
                  Entries ({filteredCards.length})
                </span>
                {searchQuery && (
                  <button onClick={() => { setSearchQuery(''); setSelectedLanguage('all'); setSelectedErrorType('all'); }}
                    style={{ background: 'none', border: 'none', color: 'var(--text-low)', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                    Clear
                  </button>
                )}
              </div>

              {loading ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 1rem', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-muted)', borderRadius: '8px', color: 'var(--text-low)', gap: '0.75rem' }}>
                  <RefreshCw style={{ width: '1.25rem', height: '1.25rem', animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>Loading…</span>
                </div>
              ) : filteredCards.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 1rem', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-muted)', borderRadius: '8px', color: 'var(--text-low)', gap: '0.5rem', textAlign: 'center' }}>
                  <Search style={{ width: '1.25rem', height: '1.25rem', opacity: 0.4 }} />
                  <span style={{ fontSize: '0.8125rem' }}>No matches</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 'calc(100vh - 320px)', overflowY: 'auto', paddingRight: '0.25rem', flex: 1 }}>
                  {filteredCards.map((card) => {
                    const isSelected = selectedCard?.id === card.id;
                    const isPass = card.verification?.status === 'PASS';
                    return (
                      <div
                        key={card.id}
                        onClick={() => setSelectedCard(card)}
                        className="active-press"
                        style={{
                          padding: '1rem',
                          borderRadius: '8px',
                          backgroundColor: isSelected ? 'var(--surface-panel)' : 'var(--bg-app)',
                          border: isSelected ? '1px solid var(--accent-primary-border)' : '1px solid var(--border-muted)',
                          cursor: 'pointer',
                          transition: 'border-color 160ms ease, background-color 160ms ease',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--text-low)', letterSpacing: '0.02em' }}>{card.errorType}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            {isPass
                              ? <CheckCircle2 style={{ width: '0.75rem', height: '0.75rem', color: 'var(--status-pass)' }} />
                              : <XCircle style={{ width: '0.75rem', height: '0.75rem', color: 'var(--status-fail)' }} />}
                            <span style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', color: isPass ? 'var(--status-pass)' : 'var(--status-fail)' }}>
                              {card.verification?.status || 'PASS'}
                            </span>
                          </div>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 400, color: isSelected ? 'var(--text-high)' : 'var(--text-medium)', lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {card.problem}
                        </p>
                        <div style={{ marginTop: '0.625rem', display: 'flex', gap: '0.75rem', fontSize: '0.6875rem', color: 'var(--text-low)', fontFamily: 'var(--font-mono)' }}>
                          <span>{card.environment?.language}</span>
                          <span>·</span>
                          <span>{card.verification?.sandbox || 'docker'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Pane 2: Diff / Logs / Trace ── */}
            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              {selectedCard ? (
                <div style={{ backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-muted)', borderRadius: '8px', padding: '1.5rem', display: 'flex', flexDirection: 'column', flex: 1, height: '100%' }}>
                  {/* Header */}
                  <div style={{ borderBottom: '1px solid var(--border-muted)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.625rem' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--accent-primary)', letterSpacing: '-0.01em' }}>{selectedCard.id}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', color: 'var(--status-pass)', backgroundColor: 'var(--status-pass-subtle)', padding: '0.25rem 0.625rem', borderRadius: '100px', border: '1px solid var(--status-pass-border)' }}>
                        <CheckCircle2 style={{ width: '0.75rem', height: '0.75rem' }} />
                        VERIFIED
                      </span>
                    </div>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 500, color: 'var(--text-high)', lineHeight: 1.4, fontFamily: 'var(--font-body)' }}>
                      {selectedCard.problem}
                    </h3>
                  </div>

                  {/* Tab bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', gap: '0.125rem', backgroundColor: 'var(--surface-subtle)', padding: '0.25rem', borderRadius: '6px' }}>
                      {(['diff', 'logs', 'trace'] as const).map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setActiveTab(tab)}
                          className="active-press"
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.375rem',
                            padding: '0.375rem 0.75rem', borderRadius: '4px', border: 'none',
                            backgroundColor: activeTab === tab ? 'var(--surface-panel)' : 'transparent',
                            color: activeTab === tab ? 'var(--text-high)' : 'var(--text-low)',
                            fontSize: '0.8125rem', fontFamily: 'var(--font-body)', cursor: 'pointer',
                            transition: 'background-color 150ms ease, color 150ms ease',
                          }}
                        >
                          {tab === 'diff' && <Code2 style={{ width: '0.875rem', height: '0.875rem' }} />}
                          {tab === 'logs' && <Terminal style={{ width: '0.875rem', height: '0.875rem' }} />}
                          {tab === 'trace' && <Layers style={{ width: '0.875rem', height: '0.875rem' }} />}
                          {tab === 'diff' ? 'Patch' : tab === 'logs' ? 'Logs' : 'Trace'}
                        </button>
                      ))}
                    </div>
                    {activeTab === 'diff' && (
                      <button onClick={() => copyToClipboard(selectedCard.patch)} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.375rem 0.625rem', borderRadius: '4px', backgroundColor: 'var(--surface-subtle)', border: '1px solid var(--border-muted)', color: copied ? 'var(--status-pass)' : 'var(--text-low)', fontSize: '0.75rem', fontFamily: 'var(--font-body)', cursor: 'pointer' }}>
                        {copied ? <Check style={{ width: '0.75rem', height: '0.75rem' }} /> : <Copy style={{ width: '0.75rem', height: '0.75rem' }} />}
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                    )}
                  </div>

                  {/* Tab content */}
                  <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                    {activeTab === 'diff' && (
                      <div style={{ backgroundColor: 'var(--surface-subtle)', border: '1px solid var(--border-muted)', borderRadius: '6px', overflow: 'hidden' }}>
                        {renderFormattedDiff(selectedCard.patch)}
                      </div>
                    )}
                    {activeTab === 'logs' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--status-pass)', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>STDOUT</div>
                          <pre style={{ backgroundColor: 'var(--surface-subtle)', border: '1px solid var(--border-muted)', borderRadius: '6px', padding: '1rem', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--status-pass)', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                            {selectedCard.verification?.stdout || '(empty)'}
                          </pre>
                        </div>
                        {selectedCard.verification?.stderr && (
                          <div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--status-fail)', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>STDERR</div>
                            <pre style={{ backgroundColor: 'var(--surface-subtle)', border: '1px solid var(--status-fail-border)', borderRadius: '6px', padding: '1rem', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--status-fail)', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                              {selectedCard.verification.stderr}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                    {activeTab === 'trace' && (
                      <pre style={{ backgroundColor: 'var(--surface-subtle)', border: '1px solid var(--border-muted)', borderRadius: '6px', padding: '1rem', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--status-fail)', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                        {selectedCard.stacktrace || 'No stacktrace provided.'}
                      </pre>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-muted)', borderRadius: '8px', color: 'var(--text-low)', fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                  Select an entry to inspect
                </div>
              )}
            </div>

            {/* ── Pane 3: Metadata Drawer ── */}
            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              {selectedCard ? (
                <div style={{ backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-muted)', borderRadius: '8px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', flex: 1, height: '100%' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--text-low)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Context</span>

                  {/* Runtime info */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {[
                      { label: 'Runtime', value: `${selectedCard.environment?.language}${selectedCard.environment?.version ? ` ${selectedCard.environment.version}` : ''}`, icon: <Cpu style={{ width: '0.875rem', height: '0.875rem' }} /> },
                      ...(selectedCard.environment?.framework ? [{ label: 'Framework', value: selectedCard.environment.framework, icon: <Box style={{ width: '0.875rem', height: '0.875rem' }} /> }] : []),
                      { label: 'Error Class', value: selectedCard.errorType, icon: <Hash style={{ width: '0.875rem', height: '0.875rem' }} /> },
                    ].map((row) => (
                      <div key={row.label} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem' }}>
                        <span style={{ color: 'var(--text-low)', marginTop: '0.125rem', flexShrink: 0 }}>{row.icon}</span>
                        <div>
                          <div style={{ fontSize: '0.6875rem', color: 'var(--text-low)', marginBottom: '0.125rem' }}>{row.label}</div>
                          <div style={{ fontSize: '0.8125rem', color: 'var(--text-high)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.value}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ height: '1px', backgroundColor: 'var(--border-muted)' }} />

                  {/* Sandbox evidence */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {[
                      { label: 'Duration', value: `${selectedCard.verification?.durationMs ?? 0} ms`, icon: <Activity style={{ width: '0.875rem', height: '0.875rem' }} /> },
                      { label: 'Sandbox', value: selectedCard.verification?.sandbox || 'docker', icon: <Database style={{ width: '0.875rem', height: '0.875rem' }} /> },
                      { label: 'Verified', value: new Date(selectedCard.verification?.lastVerified || Date.now()).toLocaleDateString(), icon: <Clock style={{ width: '0.875rem', height: '0.875rem' }} /> },
                    ].map((row) => (
                      <div key={row.label} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem' }}>
                        <span style={{ color: 'var(--text-low)', marginTop: '0.125rem', flexShrink: 0 }}>{row.icon}</span>
                        <div>
                          <div style={{ fontSize: '0.6875rem', color: 'var(--text-low)', marginBottom: '0.125rem' }}>{row.label}</div>
                          <div style={{ fontSize: '0.8125rem', color: 'var(--text-high)', fontFamily: 'var(--font-mono)' }}>{row.value}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ height: '1px', backgroundColor: 'var(--border-muted)' }} />

                  {/* Metrics */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {[
                      { k: 'Reuse Hits', v: String(selectedCard.metrics?.reuseCount || 0) },
                      { k: 'Source', v: selectedCard.provenance?.source || 'seed' },
                      { k: 'Confidence', v: `${((selectedCard.verification?.score || 0) * 100).toFixed(0)}%` },
                    ].map(({ k, v }) => (
                      <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                        <span style={{ color: 'var(--text-low)' }}>{k}</span>
                        <span style={{ color: 'var(--text-high)', fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-muted)', borderRadius: '8px', color: 'var(--text-low)', fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                  No selection
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
