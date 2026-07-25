import { Client } from '@elastic/elasticsearch';
import dotenv from 'dotenv';
import type { KnowledgeCard, EnvironmentMeta, VerificationMeta } from '../domain/knowledge-card.js';

dotenv.config();

// Re-exported so existing tool imports (`from '../services/elastic.client.js'`)
// keep resolving to the single `hm.v1` contract defined in `domain/knowledge-card.ts`.
export type { KnowledgeCard, EnvironmentMeta, VerificationMeta };

export const INDEX_NAME = 'hacksmymachine-fixes';

function getElasticClient(): Client | null {
  const url = process.env.ELASTICSEARCH_URL;
  const apiKey = process.env.ELASTICSEARCH_API_KEY;

  if (!url) {
    return null;
  }

  const opts: any = { node: url };
  if (apiKey) {
    opts.auth = { apiKey };
  }

  return new Client(opts);
}

export class ElasticService {
  private client: Client | null;

  constructor() {
    this.client = getElasticClient();
  }

  public isConnected(): boolean {
    return this.client !== null;
  }

  public async initIndex(): Promise<boolean> {
    if (!this.client) {
      console.warn('[ElasticService] Elasticsearch URL not provided. Skipping index creation.');
      return false;
    }

    const exists = await this.client.indices.exists({ index: INDEX_NAME });
    if (exists) {
      return true;
    }

    await this.client.indices.create({
      index: INDEX_NAME,
      body: {
        mappings: {
          properties: {
            id: { type: 'keyword' },
            problem: { type: 'text' },
            errorType: { type: 'keyword' },
            stacktrace: { type: 'text' },
            'environment.language': { type: 'keyword' },
            'environment.framework': { type: 'keyword' },
            patch: { type: 'text' },
            'verification.status': { type: 'keyword' },
            'verification.score': { type: 'float' },
            'metrics.reuseCount': { type: 'integer' },
            embedding: {
              type: 'dense_vector',
              dims: 1536,
              index: true,
              similarity: 'cosine',
            },
          },
        },
      },
    });

    return true;
  }

  public async indexFix(card: KnowledgeCard): Promise<void> {
    if (!this.client) {
      return;
    }
    await this.client.index({
      index: INDEX_NAME,
      id: card.id,
      document: card,
    });
    await this.client.indices.refresh({ index: INDEX_NAME });
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
    const filterConditions: any[] = [];

    if (params.language) {
      filterConditions.push({ term: { 'environment.language': params.language.toLowerCase() } });
    }
    if (params.framework) {
      filterConditions.push({ term: { 'environment.framework': params.framework.toLowerCase() } });
    }

    const searchResult = await this.client.search({
      index: INDEX_NAME,
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
      index: INDEX_NAME,
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
      const res = await this.client.get({
        index: INDEX_NAME,
        id,
      });
      return res._source as KnowledgeCard;
    } catch {
      return null;
    }
  }
}
