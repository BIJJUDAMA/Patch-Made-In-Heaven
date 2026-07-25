'use client';

import React, { useState } from 'react';

interface KnowledgeCardView {
  id: string;
  problem: string;
  errorType: string;
  language: string;
  framework: string;
  status: string;
  score: number;
  reuseCount: number;
  patch: string;
}

const SAMPLE_CARDS: KnowledgeCardView[] = [
  {
    id: 'fix_pydantic_v2_import',
    problem: "ImportError: cannot import name 'BaseSettings' from 'pydantic'",
    errorType: 'ImportError',
    language: 'python',
    framework: 'fastapi',
    status: 'PASS',
    score: 0.99,
    reuseCount: 245,
    patch: `--- a/main.py\n+++ b/main.py\n@@ -2 +2 @@\n-from pydantic import BaseSettings\n+from pydantic_settings import BaseSettings`,
  },
  {
    id: 'fix_typing_typealias',
    problem: "ImportError: cannot import name 'TypeAlias' from 'typing'",
    errorType: 'ImportError',
    language: 'python',
    framework: 'fastapi',
    status: 'PASS',
    score: 0.98,
    reuseCount: 189,
    patch: `--- a/app.py\n+++ b/app.py\n@@ -1 +1 @@\n-from typing import TypeAlias\n+from typing_extensions import TypeAlias`,
  },
  {
    id: 'fix_esm_require',
    problem: 'ReferenceError: require is not defined in ES module scope',
    errorType: 'ReferenceError',
    language: 'javascript',
    framework: 'express',
    status: 'PASS',
    score: 0.97,
    reuseCount: 312,
    patch: `--- a/index.js\n+++ b/index.js\n@@ -1 +1,2 @@\n-const express = require('express');\n+import express from 'express';`,
  },
];

export default function Dashboard() {
  const [selectedCard, setSelectedCard] = useState<KnowledgeCardView>(SAMPLE_CARDS[0]);

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ borderBottom: '1px solid #1e293b', paddingBottom: '1.5rem', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.875rem', fontWeight: 700, color: '#38bdf8' }}>
          HAcksMyMachine — Knowledge Inspector
        </h1>
        <p style={{ margin: '0.5rem 0 0', color: '#94a3b8' }}>
          Execution-Verified Agent Memory Layer • Powered by NitroStack & Elasticsearch
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: '#f8fafc' }}>
            Verified Knowledge Cards ({SAMPLE_CARDS.length})
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {SAMPLE_CARDS.map((card) => (
              <div
                key={card.id}
                onClick={() => setSelectedCard(card)}
                style={{
                  padding: '1.25rem',
                  borderRadius: '0.5rem',
                  backgroundColor: selectedCard.id === card.id ? '#1e293b' : '#0f172a',
                  border: selectedCard.id === card.id ? '1px solid #38bdf8' : '1px solid #1e293b',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', backgroundColor: '#0284c7', color: '#fff', fontWeight: 600 }}>
                    {card.errorType}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#4ade80', fontWeight: 600 }}>
                    ✅ {card.status} ({card.score * 100}%)
                  </span>
                </div>
                <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', color: '#f1f5f9' }}>{card.problem}</h3>
                <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                  Env: {card.language} • Framework: {card.framework} • Reused: {card.reuseCount} times
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: '#f8fafc' }}>
            Patch Diff & Sandbox Execution Log
          </h2>
          <div style={{ padding: '1.25rem', borderRadius: '0.5rem', backgroundColor: '#0f172a', border: '1px solid #1e293b' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', color: '#38bdf8' }}>{selectedCard.id}</h3>
            <pre style={{
              backgroundColor: '#020617',
              padding: '1rem',
              borderRadius: '0.375rem',
              overflowX: 'auto',
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              color: '#38bdf8',
              margin: 0,
            }}>
              {selectedCard.patch}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
