import { Client, type ClientOptions } from '@elastic/elasticsearch';
import dotenv from 'dotenv';
import type { KnowledgeCard, EnvironmentMeta, VerificationMeta } from '../domain/knowledge-card.js';
import { getEnv, type AppEnv } from '../config/env.js';

dotenv.config();

// Re-exported so existing tool imports (`from '../services/elastic.client.js'`)
// keep resolving to the single `hm.v1` contract defined in `domain/knowledge-card.ts`.
export type { KnowledgeCard, EnvironmentMeta, VerificationMeta };

export const INDEX_NAME = 'hacksmymachine-fixes';

const CODE_ANALYZER_NAME = 'hm_code_analyzer';

/**
 * The seam every ElasticService call goes through. Structurally satisfied by the
 * real `@elastic/elasticsearch` `Client`, but narrow enough that unit tests can
 * supply a deterministic fake without a live cluster.
 */
export interface ElasticClientLike {
  indices: {
    exists(params: { index: string }): Promise<boolean>;
    create(params: {
      index: string;
      mappings: { properties: Record<string, unknown> };
      settings?: Record<string, unknown>;
    }): Promise<unknown>;
    getMapping(params: { index: string }): Promise<
      Record<string, { mappings?: { properties?: Record<string, MappingFieldLike> } }>
    >;
    refresh(params: { index: string }): Promise<unknown>;
  };
  index(params: { index: string; id: string; document: unknown }): Promise<unknown>;
  get(params: { index: string; id: string }): Promise<{ _source?: unknown }>;
  search(params: Record<string, unknown>): Promise<{
    hits: { hits: Array<{ _source?: unknown; _score?: number | null }> };
  }>;
  bulk(params: { refresh?: boolean; operations: unknown[] }): Promise<{
    errors: boolean;
    items: Array<Record<string, { result?: string; error?: unknown; _id?: string }>>;
  }>;
}

interface MappingFieldLike {
  type?: string;
  dims?: number;
}

export class ElasticServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ElasticServiceError';
  }
}

/** Existing index mapping conflicts with the current `hm.v1`-derived schema. Never auto-migrated or deleted. */
export class ElasticMappingIncompatibleError extends Error {
  constructor(details: string[]) {
    super(
      `Existing Elasticsearch index mapping is incompatible with the current schema:\n- ${details.join('\n- ')}\nManual migration is required; the index was not modified.`
    );
    this.name = 'ElasticMappingIncompatibleError';
  }
}

export interface BulkUpsertResult {
  created: number;
  updated: number;
  failed: number;
  errors: Array<{ id: string; reason: string }>;
}

function buildIndexSettings(): Record<string, unknown> {
  return {
    analysis: {
      analyzer: {
        [CODE_ANALYZER_NAME]: {
          type: 'custom',
          tokenizer: 'standard',
          filter: ['lowercase', 'hm_code_word_delimiter'],
        },
      },
      filter: {
        hm_code_word_delimiter: {
          type: 'word_delimiter_graph',
          generate_word_parts: true,
          generate_number_parts: true,
          catenate_words: true,
          catenate_numbers: true,
          catenate_all: true,
          split_on_case_change: true,
          preserve_original: true,
        },
      },
    },
  };
}

/** Never hardcodes 1536 — omits the `embedding` field entirely until a real dimension is configured. */
function buildMappingProperties(embeddingDimensions?: number): Record<string, MappingFieldLike | Record<string, unknown>> {
  const properties: Record<string, MappingFieldLike | Record<string, unknown>> = {
    schemaVersion: { type: 'keyword' },
    id: { type: 'keyword' },
    problem: { type: 'text', analyzer: CODE_ANALYZER_NAME },
    errorType: { type: 'keyword' },
    stacktrace: { type: 'text', analyzer: CODE_ANALYZER_NAME },
    'environment.language': { type: 'keyword' },
    'environment.version': { type: 'keyword' },
    'environment.framework': { type: 'keyword' },
    'environment.packageVersions': { type: 'object', enabled: false },
    patch: { type: 'text', analyzer: CODE_ANALYZER_NAME },
    'verification.status': { type: 'keyword' },
    'verification.score': { type: 'float' },
    'verification.lastVerified': { type: 'date' },
    'verification.sandbox': { type: 'keyword' },
    'verification.exitCode': { type: 'integer' },
    'verification.durationMs': { type: 'integer' },
    'verification.stdout': { type: 'text', index: false },
    'verification.stderr': { type: 'text', index: false },
    'metrics.reuseCount': { type: 'integer' },
    embeddingModel: { type: 'keyword' },
    embeddingDimensions: { type: 'integer' },
    'provenance.source': { type: 'keyword' },
    'provenance.category': { type: 'keyword' },
    'provenance.addedAt': { type: 'date' },
    'provenance.addedBy': { type: 'keyword' },
  };

  if (embeddingDimensions) {
    properties.embedding = {
      type: 'dense_vector',
      dims: embeddingDimensions,
      index: true,
      similarity: 'cosine',
    };
  }

  return properties;
}

export interface ElasticServiceOptions {
  env?: AppEnv;
  client?: ElasticClientLike;
  indexName?: string;
}

export class ElasticService {
  private readonly client: ElasticClientLike | null;
  private readonly indexName: string;
  private readonly apiKey?: string;
  private readonly embeddingDimensions?: number;

  constructor(options: ElasticServiceOptions = {}) {
    const env = options.env ?? getEnv();
    this.indexName = options.indexName ?? INDEX_NAME;
    this.apiKey = env.elasticsearch.apiKey;
    this.embeddingDimensions = env.embedding.dimensions;

    if (options.client) {
      this.client = options.client;
    } else if (env.elasticsearch.url) {
      const clientOptions: ClientOptions = {
        node: env.elasticsearch.url,
        requestTimeout: env.elasticsearch.requestTimeoutMs,
      };
      if (env.elasticsearch.apiKey) {
        clientOptions.auth = { apiKey: env.elasticsearch.apiKey };
      }
      this.client = new Client(clientOptions) as unknown as ElasticClientLike;
    } else {
      this.client = null;
    }
  }

  public isConnected(): boolean {
    return this.client !== null;
  }

  /** Never deletes or recreates an existing index. Creates it once, or verifies the existing mapping is compatible. */
  public async initIndex(): Promise<boolean> {
    if (!this.client) {
      console.warn('[ElasticService] Elasticsearch not configured. Skipping index initialization.');
      return false;
    }

    const expectedProperties = buildMappingProperties(this.embeddingDimensions);

    let exists: boolean;
    try {
      exists = await this.client.indices.exists({ index: this.indexName });
    } catch (error) {
      throw this.wrapError('Failed to check Elasticsearch index existence', error);
    }

    if (exists) {
      await this.assertMappingCompatible(expectedProperties);
      return true;
    }

    try {
      await this.client.indices.create({
        index: this.indexName,
        mappings: { properties: expectedProperties },
        settings: buildIndexSettings(),
      });
    } catch (error) {
      throw this.wrapError('Failed to create Elasticsearch index', error);
    }

    return true;
  }

  private async assertMappingCompatible(expected: Record<string, MappingFieldLike | Record<string, unknown>>): Promise<void> {
    let mappingResponse;
    try {
      mappingResponse = await this.client!.indices.getMapping({ index: this.indexName });
    } catch (error) {
      throw this.wrapError('Failed to read the existing Elasticsearch index mapping', error);
    }

    const actualProperties = mappingResponse[this.indexName]?.mappings?.properties ?? {};
    const mismatches: string[] = [];

    for (const [field, expectedDef] of Object.entries(expected)) {
      const expectedType = (expectedDef as MappingFieldLike).type;
      const actualDef = actualProperties[field];

      if (!actualDef) {
        mismatches.push(`missing field "${field}" (expected type "${expectedType}")`);
        continue;
      }
      if (expectedType && actualDef.type !== expectedType) {
        mismatches.push(`field "${field}" has type "${actualDef.type}", expected "${expectedType}"`);
      }
      if (field === 'embedding' && this.embeddingDimensions && actualDef.dims !== this.embeddingDimensions) {
        mismatches.push(`field "embedding" has dims ${actualDef.dims}, expected ${this.embeddingDimensions}`);
      }
    }

    if (mismatches.length > 0) {
      throw new ElasticMappingIncompatibleError(mismatches);
    }
  }

  public async indexFix(card: KnowledgeCard): Promise<void> {
    if (!this.client) {
      return;
    }
    try {
      await this.client.index({ index: this.indexName, id: card.id, document: card });
      await this.client.indices.refresh({ index: this.indexName });
    } catch (error) {
      throw this.wrapError('Failed to index a knowledge card', error);
    }
  }

  /** Bulk upsert keyed by stable card id. Refuses to write nothing more than a single refresh per batch. */
  public async bulkUpsertFixes(cards: KnowledgeCard[]): Promise<BulkUpsertResult> {
    if (!this.client) {
      throw new ElasticServiceError('Cannot bulk upsert: Elasticsearch is not configured.');
    }
    if (cards.length === 0) {
      return { created: 0, updated: 0, failed: 0, errors: [] };
    }

    const operations = cards.flatMap((card) => [
      { update: { _index: this.indexName, _id: card.id } },
      { doc: card, doc_as_upsert: true },
    ]);

    let response;
    try {
      response = await this.client.bulk({ refresh: false, operations });
    } catch (error) {
      throw this.wrapError('Bulk upsert request failed', error);
    }

    const result: BulkUpsertResult = { created: 0, updated: 0, failed: 0, errors: [] };

    response.items.forEach((item, position) => {
      const outcome = item.update;
      const cardId = cards[position]?.id ?? 'unknown';

      if (!outcome) {
        result.failed += 1;
        result.errors.push({ id: cardId, reason: 'Malformed bulk response item (missing "update" outcome).' });
        return;
      }
      if (outcome.error) {
        result.failed += 1;
        result.errors.push({ id: outcome._id ?? cardId, reason: this.sanitizeMessage(JSON.stringify(outcome.error)) });
        return;
      }
      if (outcome.result === 'created') {
        result.created += 1;
      } else {
        result.updated += 1;
      }
    });

    if (result.created + result.updated > 0) {
      await this.client.indices.refresh({ index: this.indexName });
    }

    return result;
  }

  public async searchFix(params: {
    stacktrace: string;
    language: string;
    framework?: string;
    packageVersions?: Record<string, string>;
    limit?: number;
  }): Promise<KnowledgeCard[]> {
    if (!this.client) {
      return [];
    }

    const limit = params.limit || 5;
    const filterConditions: Record<string, unknown>[] = [];

    if (params.language) {
      filterConditions.push({ term: { 'environment.language': params.language.toLowerCase() } });
    }
    if (params.framework) {
      filterConditions.push({ term: { 'environment.framework': params.framework.toLowerCase() } });
    }

    const searchResult = await this.client.search({
      index: this.indexName,
      size: limit,
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query: params.stacktrace,
                fields: ['stacktrace^2', 'problem', 'errorType'],
              },
            },
          ],
          filter: filterConditions,
        },
      },
    });

    return searchResult.hits.hits.map((hit) => hit._source as KnowledgeCard);
  }

  public async findSimilar(query: string, limit: number = 5): Promise<KnowledgeCard[]> {
    if (!this.client) {
      return [];
    }

    const searchResult = await this.client.search({
      index: this.indexName,
      size: limit,
      query: {
        multi_match: {
          query,
          fields: ['problem^2', 'errorType', 'patch'],
        },
      },
    });

    return searchResult.hits.hits.map((hit) => hit._source as KnowledgeCard);
  }

  public async getFixById(id: string): Promise<KnowledgeCard | null> {
    if (!this.client) {
      return null;
    }
    try {
      const res = await this.client.get({ index: this.indexName, id });
      return (res._source as KnowledgeCard) ?? null;
    } catch {
      return null;
    }
  }

  /** Strips the configured API key out of any error message before it can be logged or returned. */
  private sanitizeMessage(message: string): string {
    return this.apiKey ? message.split(this.apiKey).join('[REDACTED]') : message;
  }

  private wrapError(context: string, error: unknown): ElasticServiceError {
    const rawMessage = error instanceof Error ? error.message : String(error);
    return new ElasticServiceError(`${context}: ${this.sanitizeMessage(rawMessage)}`);
  }
}
