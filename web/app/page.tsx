'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
            textColor = '#34d399';
          } else if (line.startsWith('-') && !line.startsWith('---')) {
            bgColor = 'var(--status-fail-subtle)';
            textColor = '#f87171';
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
      {/* Clean Apple Minimalist Header */}
      <header
        style={{
          borderBottom: '1px solid var(--border-muted)',
          backgroundColor: 'var(--surface-subtle)',
          padding: '1.5rem 3.5rem',
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
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.375rem 0.875rem',
              borderRadius: '10px',
              backgroundColor: isLiveElastic ? 'var(--status-pass-subtle)' : 'rgba(255, 255, 255, 0.05)',
              border: isLiveElastic ? '1px solid var(--status-pass-border)' : '1px solid var(--border-muted)',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: isLiveElastic ? '#34d399' : 'var(--text-medium)',
            }}
          >
            <span
              style={{
                width: '0.5rem',
                height: '0.5rem',
                borderRadius: '50%',
                backgroundColor: isLiveElastic ? 'var(--status-pass)' : 'var(--text-low)',
              }}
            />
            {isLiveElastic ? 'Live Index' : 'Seed Corpus (60 Fixes)'}
          </div>

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

      {/* Main Apple Minimal Viewport */}
      <main style={{ maxWidth: '1600px', margin: '0 auto', padding: '4rem 3.5rem 6rem' }}>
        {/* Connection Error Banner */}
        {error && (
          <div
            style={{
              marginBottom: '2.5rem',
              padding: '1.25rem 1.5rem',
              borderRadius: '10px',
              backgroundColor: 'var(--status-fail-subtle)',
              border: '1px solid var(--status-fail-border)',
              color: '#f87171',
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

        {/* Ultra-Smooth Dropdowns & Search Controls */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr',
            gap: '1.75rem',
            marginBottom: '3.5rem',
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

          {/* Smooth Language Selector */}
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className="smooth-select"
            style={{
              padding: '0.875rem 1.25rem',
              borderRadius: '10px',
              backgroundColor: 'var(--surface-subtle)',
              border: '1px solid var(--border-muted)',
              color: 'var(--text-high)',
              fontSize: '0.875rem',
              cursor: 'pointer',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            <option value="all">All Runtimes ({cards.length})</option>
            {languages.map((lang) => (
              <option key={lang} value={lang}>
                {lang.toUpperCase()}
              </option>
            ))}
          </select>

          {/* Smooth Error Type Selector */}
          <select
            value={selectedErrorType}
            onChange={(e) => setSelectedErrorType(e.target.value)}
            className="smooth-select"
            style={{
              padding: '0.875rem 1.25rem',
              borderRadius: '10px',
              backgroundColor: 'var(--surface-subtle)',
              border: '1px solid var(--border-muted)',
              color: 'var(--text-high)',
              fontSize: '0.875rem',
              cursor: 'pointer',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            <option value="all">All Error Classes</option>
            {errorTypes.map((err) => (
              <option key={err} value={err}>
                {err}
              </option>
            ))}
          </select>
        </div>

        {/* Master / Detail Split View */}
        <div style={{ display: 'grid', gridTemplateColumns: '440px 1fr', gap: '3.5rem' }}>
          {/* Card List Sidebar */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
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
                  padding: '6rem 2rem',
                  textAlign: 'center',
                  backgroundColor: 'var(--surface-subtle)',
                  borderRadius: '10px',
                  border: '1px solid var(--border-muted)',
                  color: 'var(--text-low)',
                }}
              >
                <RefreshCw style={{ width: '1.75rem', height: '1.75rem', margin: '0 auto 1rem', animation: 'spin 1s linear infinite', color: 'var(--text-medium)' }} />
                <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>Loading Knowledge Cards...</div>
              </div>
            ) : filteredCards.length === 0 ? (
              <div
                style={{
                  padding: '6rem 2rem',
                  textAlign: 'center',
                  backgroundColor: 'var(--surface-subtle)',
                  borderRadius: '10px',
                  border: '1px solid var(--border-muted)',
                  color: 'var(--text-low)',
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
                  gap: '1.25rem',
                  maxHeight: 'calc(100vh - 320px)',
                  overflowY: 'auto',
                  paddingRight: '0.5rem',
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
                        padding: '1.5rem',
                        borderRadius: '10px',
                        backgroundColor: isSelected ? 'var(--surface-panel)' : 'var(--surface-subtle)',
                        border: isSelected ? '1px solid var(--border-strong)' : '1px solid var(--border-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            padding: '0.25rem 0.625rem',
                            borderRadius: '10px',
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
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
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: isPass ? '#34d399' : '#f87171' }}>
                            {card.verification?.status || 'PASS'}
                          </span>
                        </div>
                      </div>

                      <h3
                        style={{
                          margin: '0 0 0.875rem',
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: 'var(--text-high)',
                          lineHeight: 1.5,
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
                          paddingTop: '0.875rem',
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

          {/* Card Detail Panel */}
          <div>
            {selectedCard ? (
              <div
                style={{
                  backgroundColor: 'var(--surface-subtle)',
                  borderRadius: '10px',
                  border: '1px solid var(--border-muted)',
                  padding: '2.5rem',
                }}
              >
                {/* Header Metadata */}
                <div style={{ borderBottom: '1px solid var(--border-muted)', paddingBottom: '2rem', marginBottom: '2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                    <div
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '0.8125rem',
                        color: 'var(--text-medium)',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border-muted)',
                        padding: '0.25rem 0.625rem',
                        borderRadius: '10px',
                      }}
                    >
                      {selectedCard.id}
                    </div>

                    <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'center' }}>
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.375rem',
                          fontSize: '0.75rem',
                          color: 'var(--text-medium)',
                          backgroundColor: 'var(--bg-app)',
                          padding: '0.375rem 0.75rem',
                          borderRadius: '10px',
                          border: '1px solid var(--border-muted)',
                        }}
                      >
                        <Clock style={{ width: '0.75rem', height: '0.75rem' }} />
                        {selectedCard.verification?.durationMs ?? 100}ms
                      </span>

                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.375rem',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: '#34d399',
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
                  </div>

                  <h2 style={{ margin: '1.25rem 0 1rem', fontSize: '1.375rem', fontWeight: 700, color: 'var(--text-high)', lineHeight: 1.4 }}>
                    {selectedCard.problem}
                  </h2>

                  <div style={{ display: 'flex', gap: '2rem', fontSize: '0.8125rem', color: 'var(--text-medium)', marginTop: '1rem' }}>
                    <span>Runtime: <strong style={{ color: 'var(--text-high)' }}>{selectedCard.environment?.language}</strong></span>
                    {selectedCard.environment?.framework && (
                      <span>Framework: <strong style={{ color: 'var(--text-high)' }}>{selectedCard.environment.framework}</strong></span>
                    )}
                    <span>Class: <strong style={{ color: 'var(--text-high)' }}>{selectedCard.errorType}</strong></span>
                    <span>Reuse Hits: <strong style={{ color: 'var(--text-high)' }}>{selectedCard.metrics?.reuseCount || 0}</strong></span>
                  </div>
                </div>

                {/* Tab Switcher */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-muted)', marginBottom: '2rem', paddingBottom: '0.875rem' }}>
                  <div style={{ display: 'flex', gap: '0.875rem' }}>
                    <button
                      onClick={() => setActiveTab('diff')}
                      className="active-press"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 1.25rem',
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
                        padding: '0.5rem 1.25rem',
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
                      Verification Run Log
                    </button>

                    <button
                      onClick={() => setActiveTab('trace')}
                      className="active-press"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 1.25rem',
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
                      Original Stacktrace
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
                        color: copied ? '#34d399' : 'var(--text-medium)',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                      }}
                    >
                      {copied ? <Check style={{ width: '0.875rem', height: '0.875rem' }} /> : <Copy style={{ width: '0.875rem', height: '0.875rem' }} />}
                      {copied ? 'Copied Diff' : 'Copy Diff'}
                    </button>
                  )}
                </div>

                {/* Tab Views */}
                {activeTab === 'diff' && (
                  <div
                    style={{
                      backgroundColor: 'var(--bg-app)',
                      border: '1px solid var(--border-muted)',
                      borderRadius: '10px',
                      padding: '1.25rem 0',
                    }}
                  >
                    {renderFormattedDiff(selectedCard.patch)}
                  </div>
                )}

                {activeTab === 'logs' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
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
                          color: '#34d399',
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
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#f87171', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
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
                            color: '#f87171',
                            margin: 0,
                            whiteSpace: 'pre-wrap',
                            lineHeight: 1.5,
                          }}
                        >
                          {selectedCard.verification.stderr}
                        </pre>
                      </div>
                    )}

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '1.25rem',
                        backgroundColor: 'var(--bg-app)',
                        border: '1px solid var(--border-muted)',
                        padding: '1.25rem',
                        borderRadius: '10px',
                        fontSize: '0.8125rem',
                      }}
                    >
                      <div>
                        <div style={{ color: 'var(--text-low)', fontSize: '0.75rem' }}>Sandbox Engine</div>
                        <strong style={{ color: 'var(--text-high)' }}>{selectedCard.verification?.sandbox || 'docker'}</strong>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-low)', fontSize: '0.75rem' }}>Exit Code</div>
                        <strong style={{ color: selectedCard.verification?.exitCode === 0 ? '#34d399' : '#f87171' }}>
                          {selectedCard.verification?.exitCode ?? 0}
                        </strong>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-low)', fontSize: '0.75rem' }}>Last Verified Date</div>
                        <strong style={{ color: 'var(--text-high)' }}>
                          {new Date(selectedCard.verification?.lastVerified || Date.now()).toLocaleDateString()}
                        </strong>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'trace' && (
                  <div>
                    <pre
                      style={{
                        backgroundColor: 'var(--bg-app)',
                        border: '1px solid var(--border-muted)',
                        borderRadius: '10px',
                        padding: '1.25rem',
                        fontSize: '0.8125rem',
                        fontFamily: "'JetBrains Mono', monospace",
                        color: '#fca5a5',
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
            ) : (
              <div
                style={{
                  backgroundColor: 'var(--surface-subtle)',
                  borderRadius: '10px',
                  border: '1px solid var(--border-muted)',
                  padding: '7rem 2rem',
                  textAlign: 'center',
                  color: 'var(--text-low)',
                }}
              >
                Select a Knowledge Entry on the left to inspect execution evidence.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
