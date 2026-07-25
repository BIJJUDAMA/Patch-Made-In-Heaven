import { NextResponse } from 'next/server';
import { SEED_KNOWLEDGE_CARDS } from '../../../../mcp/src/services/seed.data';

export interface KnowledgeCardResponse {
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.toLowerCase().trim() || '';
    const language = searchParams.get('language')?.toLowerCase().trim() || '';
    const errorType = searchParams.get('errorType')?.toLowerCase().trim() || '';

    const esUrl = process.env.ELASTICSEARCH_URL;
    let cards: KnowledgeCardResponse[] = [];
    let isLiveElastic = false;

    if (esUrl) {
      try {
        const authHeader = process.env.ELASTICSEARCH_API_KEY
          ? `ApiKey ${process.env.ELASTICSEARCH_API_KEY}`
          : undefined;

        const esResponse = await fetch(`${esUrl}/hacksmymachine-fixes/_search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authHeader ? { Authorization: authHeader } : {}),
          },
          body: JSON.stringify({
            size: 100,
            query: { match_all: {} },
          }),
          cache: 'no-store',
        });

        if (esResponse.ok) {
          const esData = await esResponse.json();
          cards = esData.hits?.hits?.map((hit: { _source: KnowledgeCardResponse }) => hit._source) || [];
          isLiveElastic = true;
        }
      } catch (err) {
        console.warn('[API Route /api/cards] Elasticsearch query failed, falling back to verified seed corpus:', err);
      }
    }

    if (cards.length === 0) {
      cards = SEED_KNOWLEDGE_CARDS as KnowledgeCardResponse[];
    }

    let filtered = cards;

    if (query) {
      filtered = filtered.filter(
        (card) =>
          card.problem.toLowerCase().includes(query) ||
          card.id.toLowerCase().includes(query) ||
          card.errorType.toLowerCase().includes(query) ||
          card.stacktrace.toLowerCase().includes(query) ||
          card.patch.toLowerCase().includes(query)
      );
    }

    if (language) {
      filtered = filtered.filter((card) => card.environment.language.toLowerCase() === language);
    }

    if (errorType) {
      filtered = filtered.filter((card) => card.errorType.toLowerCase() === errorType);
    }

    return NextResponse.json({
      ok: true,
      total: filtered.length,
      isLiveElastic,
      cards: filtered,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'FETCH_ERROR',
          message: `Failed to fetch knowledge cards: ${message}`,
        },
      },
      { status: 500 }
    );
  }
}
