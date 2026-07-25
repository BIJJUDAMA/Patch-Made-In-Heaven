import { describe, expect, it, vi } from 'vitest';
import {
  ElasticService,
  ElasticServiceError,
  ElasticMappingIncompatibleError,
  INDEX_NAME,
  type ElasticClientLike,
} from '../../src/services/elastic.client.js';
import { loadEnv, type AppEnv } from '../../src/config/env.js';
import type { KnowledgeCard } from '../../src/domain/knowledge-card.js';

function testEnv(overrides: Record<string, string | undefined> = {}): AppEnv {
  return loadEnv({
    ELASTICSEARCH_URL: 'https://es.example.com:9243',
    ...overrides,
  } as NodeJS.ProcessEnv);
}

function sampleCard(id: string): KnowledgeCard {
  return {
    id,
    problem: 'sample problem',
    errorType: 'ImportError',
    environment: { language: 'python' },
    patch: '--- a/x.py\n+++ b/x.py\n@@ -1 +1 @@\n-old\n+new',
    verification: {
      status: 'PASS',
      score: 0.9,
      lastVerified: '2026-07-25T14:00:00.000Z',
      sandbox: 'docker',
      exitCode: 0,
      durationMs: 100,
      stdout: 'OK',
      stderr: '',
    },
    metrics: { reuseCount: 1 },
  } as KnowledgeCard;
}

function baseFakeClient(overrides: Partial<ElasticClientLike> = {}): ElasticClientLike {
  return {
    indices: {
      exists: vi.fn(),
      create: vi.fn(),
      getMapping: vi.fn(),
      refresh: vi.fn(),
    },
    index: vi.fn(),
    get: vi.fn(),
    search: vi.fn(),
    bulk: vi.fn(),
    ...overrides,
  } as ElasticClientLike;
}

describe('ElasticService.initIndex', () => {
  it('creates the index with the expected mapping when it does not exist', async () => {
    const client = baseFakeClient();
    (client.indices.exists as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    (client.indices.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const service = new ElasticService({ env: testEnv({ EMBEDDING_VECTOR_DIMENSIONS: undefined }), client });
    const created = await service.initIndex();

    expect(created).toBe(true);
    expect(client.indices.create).toHaveBeenCalledTimes(1);
    const createArgs = (client.indices.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(createArgs.mappings.properties.id).toEqual({ type: 'keyword' });
    expect(createArgs.mappings.properties.embedding).toBeUndefined(); // never hardcoded without a configured dimension
    expect(createArgs.settings.analysis.analyzer.hm_code_analyzer).toBeDefined();
  });

  it('includes a dense_vector mapping with the configured dimension when embeddings are enabled', async () => {
    const client = baseFakeClient();
    (client.indices.exists as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    (client.indices.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const env = testEnv({ OPENROUTER_API_KEY: 'k', EMBEDDING_VECTOR_DIMENSIONS: '1024' });
    const service = new ElasticService({ env, client });
    await service.initIndex();

    const createArgs = (client.indices.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(createArgs.mappings.properties.embedding).toEqual({
      type: 'dense_vector',
      dims: 1024,
      index: true,
      similarity: 'cosine',
    });
  });

  it('is idempotent: does not recreate an already-compatible existing index', async () => {
    const client = baseFakeClient();
    (client.indices.exists as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (client.indices.getMapping as ReturnType<typeof vi.fn>).mockResolvedValue({
      [INDEX_NAME]: {
        mappings: {
          properties: {
            schemaVersion: { type: 'keyword' },
            id: { type: 'keyword' },
            problem: { type: 'text' },
            errorType: { type: 'keyword' },
            stacktrace: { type: 'text' },
            'environment.language': { type: 'keyword' },
            'environment.version': { type: 'keyword' },
            'environment.framework': { type: 'keyword' },
            'environment.packageVersions': { type: 'object' },
            patch: { type: 'text' },
            'verification.status': { type: 'keyword' },
            'verification.score': { type: 'float' },
            'verification.lastVerified': { type: 'date' },
            'verification.sandbox': { type: 'keyword' },
            'verification.exitCode': { type: 'integer' },
            'verification.durationMs': { type: 'integer' },
            'verification.stdout': { type: 'text' },
            'verification.stderr': { type: 'text' },
            'metrics.reuseCount': { type: 'integer' },
            embeddingModel: { type: 'keyword' },
            embeddingDimensions: { type: 'integer' },
            'provenance.source': { type: 'keyword' },
            'provenance.category': { type: 'keyword' },
            'provenance.addedAt': { type: 'date' },
            'provenance.addedBy': { type: 'keyword' },
          },
        },
      },
    });

    const service = new ElasticService({ env: testEnv({ EMBEDDING_VECTOR_DIMENSIONS: undefined }), client });
    const result = await service.initIndex();

    expect(result).toBe(true);
    expect(client.indices.create).not.toHaveBeenCalled();
  });

  it('rejects an incompatible existing mapping without modifying the index', async () => {
    const client = baseFakeClient();
    (client.indices.exists as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (client.indices.getMapping as ReturnType<typeof vi.fn>).mockResolvedValue({
      [INDEX_NAME]: {
        mappings: {
          properties: {
            id: { type: 'text' }, // wrong type: should be keyword
            // problem, verification.*, etc. all missing entirely
          },
        },
      },
    });

    const service = new ElasticService({ env: testEnv({ EMBEDDING_VECTOR_DIMENSIONS: undefined }), client });

    await expect(service.initIndex()).rejects.toThrow(ElasticMappingIncompatibleError);
    expect(client.indices.create).not.toHaveBeenCalled();
  });

  it('never calls index deletion, even on an incompatible mapping', async () => {
    const deletionTrap = new Proxy(
      {},
      {
        get(_target, prop) {
          throw new Error(`Unexpected access to indices.${String(prop)} — no deletion method should be called.`);
        },
      }
    );
    const client: ElasticClientLike = {
      indices: {
        exists: vi.fn().mockResolvedValue(true),
        create: deletionTrap as never,
        getMapping: vi.fn().mockResolvedValue({
          [INDEX_NAME]: { mappings: { properties: { id: { type: 'text' } } } },
        }),
        refresh: deletionTrap as never,
      },
      index: vi.fn(),
      get: vi.fn(),
      search: vi.fn(),
      bulk: vi.fn(),
    };

    const service = new ElasticService({ env: testEnv({ EMBEDDING_VECTOR_DIMENSIONS: undefined }), client });
    await expect(service.initIndex()).rejects.toThrow(ElasticMappingIncompatibleError);
  });
});

describe('ElasticService error redaction', () => {
  it('never leaks the configured API key in a wrapped error message', async () => {
    const secretApiKey = 'es-live-secret-9f8a7b6c';
    const client = baseFakeClient();
    (client.indices.exists as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error(`connection refused for https://es.example.com:9243 with apiKey ${secretApiKey}`)
    );

    const env = testEnv({ ELASTICSEARCH_API_KEY: secretApiKey, EMBEDDING_VECTOR_DIMENSIONS: undefined });
    const service = new ElasticService({ env, client });

    await expect(service.initIndex()).rejects.toThrow(ElasticServiceError);
    try {
      await service.initIndex();
      throw new Error('expected initIndex to throw');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).not.toContain(secretApiKey);
      expect(message).toContain('[REDACTED]');
    }
  });
});

describe('ElasticService.bulkUpsertFixes', () => {
  it('reports created/updated counts and per-item failures without aborting the batch', async () => {
    const client = baseFakeClient();
    (client.bulk as ReturnType<typeof vi.fn>).mockResolvedValue({
      errors: true,
      items: [
        { update: { result: 'created', _id: 'fix_a' } },
        { update: { result: 'updated', _id: 'fix_b' } },
        { update: { error: { type: 'version_conflict_engine_exception', reason: 'conflict' }, _id: 'fix_c' } },
      ],
    });
    (client.indices.refresh as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const service = new ElasticService({ env: testEnv({ EMBEDDING_VECTOR_DIMENSIONS: undefined }), client });
    const result = await service.bulkUpsertFixes([sampleCard('fix_a'), sampleCard('fix_b'), sampleCard('fix_c')]);

    expect(result.created).toBe(1);
    expect(result.updated).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].id).toBe('fix_c');
    expect(client.indices.refresh).toHaveBeenCalledTimes(1); // one refresh per batch, not per item
  });

  it('performs no network writes and no refresh for an empty batch', async () => {
    const client = baseFakeClient();
    const service = new ElasticService({ env: testEnv({ EMBEDDING_VECTOR_DIMENSIONS: undefined }), client });

    const result = await service.bulkUpsertFixes([]);

    expect(result).toEqual({ created: 0, updated: 0, failed: 0, errors: [] });
    expect(client.bulk).not.toHaveBeenCalled();
    expect(client.indices.refresh).not.toHaveBeenCalled();
  });

  it('throws when Elasticsearch is not configured, rather than silently no-op-ing', async () => {
    const service = new ElasticService({ env: testEnv({ ELASTICSEARCH_URL: undefined }) });
    await expect(service.bulkUpsertFixes([sampleCard('fix_a')])).rejects.toThrow(ElasticServiceError);
  });
});
