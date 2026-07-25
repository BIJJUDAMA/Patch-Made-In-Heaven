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

  // Custom Apple Dropdown Open States
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
      if (!data.ok) {
        throw new Error(data.error?.message || 'Failed to fetch cards');
      }
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
      const msg = err instanceof Error ? err.message : 'Connection failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCards();
  }, []);

  // Outside click listener for custom floating menus
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (langRef.current && !langRef.current.contains(event.target as Node)) {
        setLangDropdownOpen(false);
      }
      if (errorRef.current && !errorRef.current.contains(event.target as Node)) {
        setErrorDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const languages = useMemo(() => {
    const set = new Set<string>();
    cards.forEach((c) => {
      if (c.environment?.language) set.add(c.environment.language);
    });
    return Array.from(set).sort();
  }, [cards]);

  const errorTypes = useMemo(() => {
    const set = new Set<string>();
    cards.forEach((c) => {
      if (c.errorType) set.add(c.errorType);
    });
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

      const matchesLang =
        selectedLanguage === 'all' || card.environment?.language?.toLowerCase() === selectedLanguage.toLowerCase();

      const matchesError =
        selectedErrorType === 'all' || card.errorType?.toLowerCase() === selectedErrorType.toLowerCase();

      return matchesSearch && matchesLang && matchesError;
    });
  }, [cards, searchQuery, selectedLanguage, selectedErrorType]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderFormattedDiff = (patch: string) => {
    if (!patch)
      return (
        <div style={{ color: 'var(--text-low)', fontStyle: 'italic', fontFamily: "'JetBrains Mono', monospace", padding: '1.25rem' }}>
          No patch diff available for this entry.
        </div>
      );
    const lines = patch.split('\n');

    return (
      <pre
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.8125rem',
          lineHeight: 1.6,
          margin: 0,
          overflowX: 'auto',
        }}
      >
        {lines.map((line, idx) => {
          let bgColor = 'transparent';
          let textColor = 'var(--text-high)';

          if (line.startsWith('+') && !line.startsWith('+++')) {
            bgColor = 'var(--status-pass-subtle)';
            textColor = 'var(--status-pass)';
          } else if (line.startsWith('-') && !line.startsWith('---')) {
            bgColor = 'var(--status-fail-subtle)';
            textColor = 'var(--status-fail)';
          } else if (line.startsWith('@@') || line.startsWith('===')) {
            textColor = 'var(--text-medium)';
          }

          return (
            <div
              key={idx}
              style={{
                backgroundColor: bgColor,
                color: textColor,
                padding: '0.125rem 1.25rem',
                display: 'flex',
                gap: '1.5rem',
                whiteSpace: 'pre',
              }}
            >
              <span
                style={{
                  color: 'var(--text-low)',
                  userSelect: 'none',
                  fontSize: '0.75rem',
                  width: '32px',
                  textAlign: 'right',
                  flexShrink: 0,
                }}
              >
                {idx + 1}
              </span>
              <span>{line}</span>
            </div>
          );
        })}
      </pre>
    );
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-app)', color: 'var(--text-high)' }}>
      {/* Clean Header */}
      <header
        style={{
          borderBottom: '1px solid var(--border-muted)',
          backgroundColor: 'var(--surface-subtle)',
          padding: '1.25rem 2.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--text-high)' }}>
            Hacks On My Machine
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <button
            onClick={fetchCards}
            disabled={loading}
            className="active-press"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1.125rem',
              borderRadius: '10px',
              backgroundColor: 'var(--surface-panel)',
              border: '1px solid var(--border-muted)',
              color: 'var(--text-high)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            <RefreshCw
              style={{
                width: '0.875rem',
                height: '0.875rem',
                animation: loading ? 'spin 1s linear infinite' : 'none',
              }}
            />
            Refresh
          </button>
        </div>

      </header>

      {/* Main Container */}
      <main style={{ maxWidth: '100%', padding: '2rem 2.5rem 4rem' }}>
        {/* Error Alert */}
        {error && (
          <div
            style={{
              marginBottom: '2rem',
              padding: '1.25rem 1.5rem',
              borderRadius: '10px',
              backgroundColor: 'var(--status-fail-subtle)',
              border: '1px solid var(--status-fail-border)',
              color: 'var(--status-fail)',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
            }}
          >
            <AlertTriangle style={{ width: '1.375rem', height: '1.375rem', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>Service Warning</div>
              <div style={{ fontSize: '0.8125rem', color: '#fca5a5' }}>{error}</div>
            </div>
          </div>
        )}

        {/* Custom Apple Floating Dropdowns & Search Controls */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr',
            gap: '1.25rem',
            marginBottom: '2rem',
          }}
        >
          {/* Search Bar */}
          <div style={{ position: 'relative' }}>
            <Search
              style={{
                position: 'absolute',
                left: '1.25rem',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '1.125rem',
                height: '1.125rem',
                color: 'var(--text-low)',
              }}
            />
            <input
              type="text"
              placeholder="Search stacktrace, error class, or problem..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.875rem 1.25rem 0.875rem 3.25rem',
                borderRadius: '10px',
                backgroundColor: 'var(--surface-subtle)',
                border: '1px solid var(--border-muted)',
                color: 'var(--text-high)',
                fontSize: '0.875rem',
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                transition: 'border-color 180ms ease, background-color 180ms ease',
              }}
            />
          </div>

          {/* Custom Apple Floating Language Dropdown */}
          <div ref={langRef} style={{ position: 'relative' }}>
            <button
              onClick={() => {
                setLangDropdownOpen(!langDropdownOpen);
                setErrorDropdownOpen(false);
              }}
              className="active-press"
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.875rem 1.25rem',
                borderRadius: '10px',
                backgroundColor: 'var(--surface-subtle)',
                border: langDropdownOpen ? '1px solid var(--accent-primary)' : '1px solid var(--border-muted)',
                color: 'var(--text-high)',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
              <span>
                {selectedLanguage === 'all'
                  ? `All Runtimes (${cards.length})`
                  : selectedLanguage.toUpperCase()}
              </span>
              <ChevronDown
                style={{
                  width: '1rem',
                  height: '1rem',
                  color: 'var(--text-medium)',
                  transform: langDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              />
            </button>

            {langDropdownOpen && (
              <div
                className="apple-menu-anim"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  right: 0,
                  zIndex: 50,
                  backgroundColor: 'var(--surface-panel)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  borderRadius: '10px',
                  border: '1px solid var(--border-strong)',
                  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5)',
                  padding: '0.375rem',
                  maxHeight: '260px',
                  overflowY: 'auto',
                }}
              >
                <div
                  onClick={() => {
                    setSelectedLanguage('all');
                    setLangDropdownOpen(false);
                  }}
                  style={{
                    padding: '0.625rem 0.875rem',
                    borderRadius: '6px',
                    fontSize: '0.8125rem',
                    color: selectedLanguage === 'all' ? 'var(--text-high)' : 'var(--text-medium)',
                    backgroundColor: selectedLanguage === 'all' ? 'var(--surface-hover)' : 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'background-color 120ms ease',
                  }}
                >
                  <span>All Runtimes</span>
                  {selectedLanguage === 'all' && <Check style={{ width: '0.875rem', height: '0.875rem', color: 'var(--accent-primary)' }} />}
                </div>

                {languages.map((lang) => {
                  const isSel = selectedLanguage === lang;
                  return (
                    <div
                      key={lang}
                      onClick={() => {
                        setSelectedLanguage(lang);
                        setLangDropdownOpen(false);
                      }}
                      style={{
                        padding: '0.625rem 0.875rem',
                        borderRadius: '6px',
                        fontSize: '0.8125rem',
                        color: isSel ? 'var(--text-high)' : 'var(--text-medium)',
                        backgroundColor: isSel ? 'var(--surface-hover)' : 'transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'background-color 120ms ease',
                      }}
                    >
                      <span>{lang.toUpperCase()}</span>
                      {isSel && <Check style={{ width: '0.875rem', height: '0.875rem', color: 'var(--accent-primary)' }} />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Custom Apple Floating Error Type Dropdown */}
          <div ref={errorRef} style={{ position: 'relative' }}>
            <button
              onClick={() => {
                setErrorDropdownOpen(!errorDropdownOpen);
                setLangDropdownOpen(false);
              }}
              className="active-press"
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.875rem 1.25rem',
                borderRadius: '10px',
                backgroundColor: 'var(--surface-subtle)',
                border: errorDropdownOpen ? '1px solid var(--accent-primary)' : '1px solid var(--border-muted)',
                color: 'var(--text-high)',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
              <span>
                {selectedErrorType === 'all'
                  ? 'All Error Classes'
                  : selectedErrorType}
              </span>
              <ChevronDown
                style={{
                  width: '1rem',
                  height: '1rem',
                  color: 'var(--text-medium)',
                  transform: errorDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              />
            </button>

            {errorDropdownOpen && (
              <div
                className="apple-menu-anim"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  right: 0,
                  zIndex: 50,
                  backgroundColor: 'var(--surface-panel)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  borderRadius: '10px',
                  border: '1px solid var(--border-strong)',
                  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5)',
                  padding: '0.375rem',
                  maxHeight: '260px',
                  overflowY: 'auto',
                }}
              >
                <div
                  onClick={() => {
                    setSelectedErrorType('all');
                    setErrorDropdownOpen(false);
                  }}
                  style={{
                    padding: '0.625rem 0.875rem',
                    borderRadius: '6px',
                    fontSize: '0.8125rem',
                    color: selectedErrorType === 'all' ? 'var(--text-high)' : 'var(--text-medium)',
                    backgroundColor: selectedErrorType === 'all' ? 'var(--surface-hover)' : 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'background-color 120ms ease',
                  }}
                >
                  <span>All Error Classes</span>
                  {selectedErrorType === 'all' && <Check style={{ width: '0.875rem', height: '0.875rem', color: 'var(--accent-primary)' }} />}
                </div>

                {errorTypes.map((err) => {
                  const isSel = selectedErrorType === err;
                  return (
                    <div
                      key={err}
                      onClick={() => {
                        setSelectedErrorType(err);
                        setErrorDropdownOpen(false);
                      }}
                      style={{
                        padding: '0.625rem 0.875rem',
                        borderRadius: '6px',
                        fontSize: '0.8125rem',
                        color: isSel ? 'var(--text-high)' : 'var(--text-medium)',
                        backgroundColor: isSel ? 'var(--surface-hover)' : 'transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'background-color 120ms ease',
                      }}
                    >
                      <span>{err}</span>
                      {isSel && <Check style={{ width: '0.875rem', height: '0.875rem', color: 'var(--accent-primary)' }} />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 3-Pane Equal Height Architecture (Items Align Flex Stretch) */}
        <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr 340px', gap: '1.5rem', width: '100%', alignItems: 'stretch' }}>
          {/* Pane 1: Master Card List */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-low)' }}>
                Knowledge Base ({filteredCards.length})
              </h2>
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedLanguage('all');
                    setSelectedErrorType('all');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-medium)',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Clear Filters
                </button>
              )}
            </div>

            {loading ? (
              <div
                style={{
                  padding: '5rem 2rem',
                  textAlign: 'center',
                  backgroundColor: 'var(--surface-subtle)',
                  borderRadius: '10px',
                  border: '1px solid var(--border-muted)',
                  color: 'var(--text-low)',
                  flex: 1,
                }}
              >
                <RefreshCw style={{ width: '1.75rem', height: '1.75rem', margin: '0 auto 1rem', animation: 'spin 1s linear infinite', color: 'var(--text-medium)' }} />
                <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>Loading Knowledge Cards...</div>
              </div>
            ) : filteredCards.length === 0 ? (
              <div
                style={{
                  padding: '5rem 2rem',
                  textAlign: 'center',
                  backgroundColor: 'var(--surface-subtle)',
                  borderRadius: '10px',
                  border: '1px solid var(--border-muted)',
                  color: 'var(--text-low)',
                  flex: 1,
                }}
              >
                <Search style={{ width: '2rem', height: '2rem', margin: '0 auto 1rem', opacity: 0.3 }} />
                <div style={{ fontWeight: 700, color: 'var(--text-medium)', marginBottom: '0.25rem' }}>No Matches Found</div>
                <div style={{ fontSize: '0.8125rem' }}>Adjust your search query or runtime filters.</div>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.875rem',
                  maxHeight: 'calc(100vh - 260px)',
                  overflowY: 'auto',
                  paddingRight: '0.375rem',
                  flex: 1,
                }}
              >
                {filteredCards.map((card) => {
                  const isSelected = selectedCard?.id === card.id;
                  const isPass = card.verification?.status === 'PASS';

                  return (
                    <div
                      key={card.id}
                      onClick={() => setSelectedCard(card)}
                      className="active-press"
                      style={{
                        height: '140px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        padding: '1.125rem',
                        borderRadius: '10px',
                        backgroundColor: isSelected ? 'var(--surface-panel)' : 'var(--surface-subtle)',
                        border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-muted)',
                        cursor: 'pointer',
                        boxSizing: 'border-box',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            padding: '0.2rem 0.5rem',
                            borderRadius: '10px',
                            backgroundColor: 'var(--surface-panel)',
                            border: '1px solid var(--border-muted)',
                            color: 'var(--text-medium)',
                            fontFamily: "'JetBrains Mono', monospace",
                          }}
                        >
                          {card.errorType}
                        </span>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          {isPass ? (
                            <CheckCircle2 style={{ width: '0.875rem', height: '0.875rem', color: 'var(--status-pass)' }} />
                          ) : (
                            <XCircle style={{ width: '0.875rem', height: '0.875rem', color: 'var(--status-fail)' }} />
                          )}
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: isPass ? 'var(--status-pass)' : 'var(--status-fail)' }}>
                            {card.verification?.status || 'PASS'}
                          </span>
                        </div>
                      </div>

                      <h3
                        style={{
                          margin: 0,
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: 'var(--text-high)',
                          lineHeight: 1.4,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {card.problem}
                      </h3>

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '0.75rem',
                          color: 'var(--text-low)',
                          paddingTop: '0.5rem',
                          borderTop: '1px solid var(--border-muted)',
                        }}
                      >
                        <span>
                          Lang: <strong style={{ color: 'var(--text-medium)' }}>{card.environment?.language}</strong>
                        </span>
                        <span>
                          Sandbox: <strong style={{ color: 'var(--text-medium)' }}>{card.verification?.sandbox || 'docker'}</strong>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pane 2: Middle Diff & Execution Evidence Inspector (Equal Height Stretch) */}
          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            {selectedCard ? (
              <div
                style={{
                  backgroundColor: 'var(--surface-subtle)',
                  borderRadius: '10px',
                  border: '1px solid var(--border-muted)',
                  padding: '1.75rem',
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                  height: '100%',
                }}
              >
                {/* Header Metadata */}
                <div style={{ borderBottom: '1px solid var(--border-muted)', paddingBottom: '1.25rem', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '0.8125rem',
                        color: 'var(--accent-primary)',
                        backgroundColor: 'var(--accent-primary-subtle)',
                        border: '1px solid var(--border-muted)',
                        padding: '0.25rem 0.625rem',
                        borderRadius: '10px',
                      }}
                    >
                      {selectedCard.id}
                    </div>

                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.375rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: 'var(--status-pass)',
                        backgroundColor: 'var(--status-pass-subtle)',
                        padding: '0.375rem 0.875rem',
                        borderRadius: '10px',
                        border: '1px solid var(--status-pass-border)',
                      }}
                    >
                      <CheckCircle2 style={{ width: '0.875rem', height: '0.875rem' }} />
                      VERIFIED {selectedCard.verification?.status}
                    </span>
                  </div>

                  <h2 style={{ margin: '0.75rem 0 0.5rem', fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-high)', lineHeight: 1.4 }}>
                    {selectedCard.problem}
                  </h2>
                </div>

                {/* Tab Switcher */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-muted)', marginBottom: '1.25rem', paddingBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                      onClick={() => setActiveTab('diff')}
                      className="active-press"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 1.125rem',
                        borderRadius: '10px',
                        border: 'none',
                        backgroundColor: activeTab === 'diff' ? 'var(--surface-panel)' : 'transparent',
                        color: activeTab === 'diff' ? 'var(--text-high)' : 'var(--text-medium)',
                        fontWeight: activeTab === 'diff' ? 600 : 500,
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                      }}
                    >
                      <Code2 style={{ width: '1rem', height: '1rem' }} />
                      Patch Diff
                    </button>

                    <button
                      onClick={() => setActiveTab('logs')}
                      className="active-press"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 1.125rem',
                        borderRadius: '10px',
                        border: 'none',
                        backgroundColor: activeTab === 'logs' ? 'var(--surface-panel)' : 'transparent',
                        color: activeTab === 'logs' ? 'var(--text-high)' : 'var(--text-medium)',
                        fontWeight: activeTab === 'logs' ? 600 : 500,
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                      }}
                    >
                      <Terminal style={{ width: '1rem', height: '1rem' }} />
                      Verification Logs
                    </button>

                    <button
                      onClick={() => setActiveTab('trace')}
                      className="active-press"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 1.125rem',
                        borderRadius: '10px',
                        border: 'none',
                        backgroundColor: activeTab === 'trace' ? 'var(--surface-panel)' : 'transparent',
                        color: activeTab === 'trace' ? 'var(--text-high)' : 'var(--text-medium)',
                        fontWeight: activeTab === 'trace' ? 600 : 500,
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                      }}
                    >
                      <Layers style={{ width: '1rem', height: '1rem' }} />
                      Stacktrace
                    </button>
                  </div>

                  {activeTab === 'diff' && (
                    <button
                      onClick={() => copyToClipboard(selectedCard.patch)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.375rem',
                        padding: '0.375rem 0.875rem',
                        borderRadius: '10px',
                        backgroundColor: 'var(--bg-app)',
                        border: '1px solid var(--border-muted)',
                        color: copied ? 'var(--status-pass)' : 'var(--text-medium)',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                      }}
                    >
                      {copied ? <Check style={{ width: '0.875rem', height: '0.875rem' }} /> : <Copy style={{ width: '0.875rem', height: '0.875rem' }} />}
                      {copied ? 'Copied' : 'Copy Diff'}
                    </button>
                  )}
                </div>

                {/* Tab Views (Fills Available Height) */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  {activeTab === 'diff' && (
                    <div
                      style={{
                        backgroundColor: 'var(--bg-app)',
                        border: '1px solid var(--border-muted)',
                        borderRadius: '10px',
                        padding: '1rem 0',
                        flex: 1,
                        overflowY: 'auto',
                      }}
                    >
                      {renderFormattedDiff(selectedCard.patch)}
                    </div>
                  )}

                  {activeTab === 'logs' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', flex: 1, overflowY: 'auto' }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-medium)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                          Captured STDOUT Output
                        </div>
                        <pre
                          style={{
                            backgroundColor: 'var(--bg-app)',
                            border: '1px solid var(--border-muted)',
                            borderRadius: '10px',
                            padding: '1.25rem',
                            fontSize: '0.8125rem',
                            fontFamily: "'JetBrains Mono', monospace",
                            color: 'var(--status-pass)',
                            margin: 0,
                            whiteSpace: 'pre-wrap',
                            lineHeight: 1.5,
                          }}
                        >
                          {selectedCard.verification?.stdout || '(empty stdout)'}
                        </pre>
                      </div>

                      {selectedCard.verification?.stderr && (
                        <div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--status-fail)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                            STDERR Error Log Output
                          </div>
                          <pre
                            style={{
                              backgroundColor: 'var(--bg-app)',
                              border: '1px solid var(--status-fail-border)',
                              borderRadius: '10px',
                              padding: '1.25rem',
                              fontSize: '0.8125rem',
                              fontFamily: "'JetBrains Mono', monospace",
                              color: 'var(--status-fail)',
                              margin: 0,
                              whiteSpace: 'pre-wrap',
                              lineHeight: 1.5,
                            }}
                          >
                            {selectedCard.verification.stderr}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'trace' && (
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                      <pre
                        style={{
                          backgroundColor: 'var(--bg-app)',
                          border: '1px solid var(--border-muted)',
                          borderRadius: '10px',
                          padding: '1.25rem',
                          fontSize: '0.8125rem',
                          fontFamily: "'JetBrains Mono', monospace",
                          color: 'var(--status-fail)',
                          margin: 0,
                          whiteSpace: 'pre-wrap',
                          lineHeight: 1.6,
                        }}
                      >
                        {selectedCard.stacktrace || 'No full stacktrace provided for this fixture.'}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div
                style={{
                  backgroundColor: 'var(--surface-subtle)',
                  borderRadius: '10px',
                  border: '1px solid var(--border-muted)',
                  padding: '6rem 2rem',
                  textAlign: 'center',
                  color: 'var(--text-low)',
                  flex: 1,
                }}
              >
                Select a Knowledge Entry on the left to inspect execution evidence.
              </div>
            )}
          </div>

          {/* Pane 3: Right Context & Provenance Drawer (Equal Height Stretch) */}
          <div style={{ minWidth: 0, boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
            {selectedCard ? (
              <div
                style={{
                  backgroundColor: 'var(--surface-subtle)',
                  borderRadius: '10px',
                  border: '1px solid var(--border-muted)',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                  boxSizing: 'border-box',
                  flex: 1,
                  height: '100%',
                }}
              >
                <h3 style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-low)' }}>
                  Entry Metadata & Context
                </h3>

                {/* Runtime & Class info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', backgroundColor: 'var(--bg-app)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Cpu style={{ width: '1rem', height: '1rem', color: 'var(--accent-primary)', flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-low)' }}>Language Runtime</div>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-high)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {selectedCard.environment?.language} {selectedCard.environment?.version ? `(${selectedCard.environment.version})` : ''}
                      </div>
                    </div>
                  </div>

                  {selectedCard.environment?.framework && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <Box style={{ width: '1rem', height: '1rem', color: 'var(--accent-primary)', flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-low)' }}>Framework</div>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-high)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {selectedCard.environment.framework}
                        </div>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Hash style={{ width: '1rem', height: '1rem', color: 'var(--accent-primary)', flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-low)' }}>Error Class</div>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-high)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {selectedCard.errorType}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sandbox Run Evidence */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', backgroundColor: 'var(--bg-app)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Activity style={{ width: '1rem', height: '1rem', color: 'var(--accent-primary)', flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-low)' }}>Execution Duration</div>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-high)' }}>
                        {selectedCard.verification?.durationMs ?? 100} ms
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Database style={{ width: '1rem', height: '1rem', color: 'var(--accent-primary)', flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-low)' }}>Sandbox Provider</div>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-high)' }}>
                        {selectedCard.verification?.sandbox || 'docker'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Clock style={{ width: '1rem', height: '1rem', color: 'var(--accent-primary)', flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-low)' }}>Last Verified</div>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-high)' }}>
                        {new Date(selectedCard.verification?.lastVerified || Date.now()).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Provenance & Metrics */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', backgroundColor: 'var(--bg-app)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-muted)', marginTop: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                    <span style={{ color: 'var(--text-low)' }}>Reuse Hits</span>
                    <strong style={{ color: 'var(--text-high)' }}>{selectedCard.metrics?.reuseCount || 0}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                    <span style={{ color: 'var(--text-low)' }}>Source</span>
                    <strong style={{ color: 'var(--text-high)' }}>{selectedCard.provenance?.source || 'seed'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                    <span style={{ color: 'var(--text-low)' }}>Confidence Score</span>
                    <strong style={{ color: 'var(--status-pass)' }}>{(selectedCard.verification?.score * 100).toFixed(0)}%</strong>
                  </div>
                </div>
              </div>
            ) : (
              <div
                style={{
                  backgroundColor: 'var(--surface-subtle)',
                  borderRadius: '10px',
                  border: '1px solid var(--border-muted)',
                  padding: '4rem 1.5rem',
                  textAlign: 'center',
                  color: 'var(--text-low)',
                  fontSize: '0.8125rem',
                  flex: 1,
                }}
              >
                No active selection
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
