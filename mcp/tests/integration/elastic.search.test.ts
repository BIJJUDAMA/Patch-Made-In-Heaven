import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@elastic/elasticsearch';
import { ElasticService } from '../../src/services/elastic.client.js';
import { loadEnv } from '../../src/config/env.js';
import type { KnowledgeCard } from '../../src/domain/knowledge-card.js';

/**
 * Runs against a REAL Elasticsearch cluster in a disposable, uniquely-named
 * scratch index (never the production `hacksmymachine-fixes` index). Self-skips
 * when ELASTICSEARCH_URL isn't configured, matching the credential-gated smoke
 * test pattern used for the embedding client — this environment has no live
 * Elasticsearch, so the suite is expected to report "skipped", not fabricate a
 * pass.
 */
const hasRealElasticsearch = Boolean(process.env.ELASTICSEARCH_URL);
const scratchIndexName = `hacksmymachine-fixes-test-${Date.now()}`;

function evidencedCard(overrides: Partial<KnowledgeCard> & Pick<KnowledgeCard, 'id'>): KnowledgeCard {
  return {
    problem: 'sample problem',
    errorType: 'ImportError',
    environment: { language: 'python' },
    patch: '--- a/x.py\n+++ b/x.py\n@@ -1 +1 @@\n-old\n+new',
    verification: {
      status: 'PASS',
      score: 0.95,
      lastVerified: '2026-07-25T14:00:00.000Z',
      sandbox: 'docker',
      exitCode: 0,
      durationMs: 100,
      stdout: 'OK',
      stderr: '',
    },
    metrics: { reuseCount: 1 },
    ...overrides,
  } as KnowledgeCard;
}

describe.skipIf(!hasRealElasticsearch)('ElasticService integration (real Elasticsearch)', () => {
  let service: ElasticService;
  let rawClient: Client;

  beforeAll(async () => {
    const env = loadEnv();
    rawClient = new Client({
      node: env.elasticsearch.url!,
      ...(env.elasticsearch.apiKey ? { auth: { apiKey: env.elasticsearch.apiKey } } : {}),
    });
    // embeddingClient: null keeps this suite deterministic/lexical-only regardless
    // of whether embedding credentials also happen to be configured.
    service = new ElasticService({ env, indexName: scratchIndexName, embeddingClient: null });
    await service.initIndex();

    const result = await service.bulkUpsertFixes([
      evidencedCard({
        id: 'fix_python_pydantic_import',
        problem: "ImportError: cannot import name 'BaseSettings' from 'pydantic'",
        errorType: 'ImportError',
        stacktrace: "File 'main.py', line 2, in <module>\n  from pydantic import BaseSettings",
        environment: { language: 'python', framework: 'fastapi' },
      }),
      evidencedCard({
        id: 'fix_python_failed_attempt',
        problem: 'A patch that was tried and did not work',
        errorType: 'ImportError',
        stacktrace: "File 'main.py', line 2, in <module>\n  from pydantic import BaseSettings",
        environment: { language: 'python', framework: 'fastapi' },
        verification: {
          status: 'FAIL',
          score: 0,
          lastVerified: '2026-07-25T14:00:00.000Z',
          sandbox: 'docker',
        },
      }),
      evidencedCard({
        id: 'fix_javascript_esm_require',
        problem: 'ReferenceError: require is not defined in ES module scope',
        errorType: 'ReferenceError',
        stacktrace: 'ReferenceError: require is not defined in ES module scope',
        environment: { language: 'javascript', framework: 'express' },
      }),
    ]);
    if (result.failed > 0) {
      throw new Error(`Seed fixtures failed to index: ${JSON.stringify(result.errors)}`);
    }
  });

  afterAll(async () => {
    await rawClient.indices.delete({ index: scratchIndexName }).catch(() => {
      // best-effort cleanup of the scratch index only; never the production index
    });
  });

  it('finds an exact stack trace match within the correct language/environment', async () => {
    const result = await service.searchFix({
      stacktrace: "ImportError: cannot import name 'BaseSettings' from 'pydantic'",
      language: 'python',
      framework: 'fastapi',
    });
    expect(result.mode).toBe('lexical');
    expect(result.hits.map((hit) => hit.card.id)).toContain('fix_python_pydantic_import');
  });

  it('excludes results from the wrong language/environment', async () => {
    const result = await service.searchFix({
      stacktrace: "ImportError: cannot import name 'BaseSettings' from 'pydantic'",
      language: 'javascript',
    });
    expect(result.hits.map((hit) => hit.card.id)).not.toContain('fix_python_pydantic_import');
  });

  it('excludes FAIL-status cards even when lexically relevant', async () => {
    const result = await service.searchFix({
      stacktrace: "ImportError: cannot import name 'BaseSettings' from 'pydantic'",
      language: 'python',
    });
    expect(result.hits.map((hit) => hit.card.id)).not.toContain('fix_python_failed_attempt');
  });

  it('respects the requested result limit', async () => {
    const result = await service.findSimilar('ImportError problem', 1);
    expect(result.hits.length).toBeLessThanOrEqual(1);
  });

  it('reports mode: "lexical" in degraded mode (no embedder configured)', async () => {
    const result = await service.searchFix({ stacktrace: 'ReferenceError: require', language: 'javascript' });
    expect(result.mode).toBe('lexical');
  });
});
