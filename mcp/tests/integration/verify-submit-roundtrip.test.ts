import { describe, expect, it, vi, beforeEach } from 'vitest';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { VerifyTools } from '../../src/tools/verify.tool.js';
import { SubmitTools } from '../../src/tools/submit.tool.js';
import { SearchTools } from '../../src/tools/search.tool.js';
import { RetrieveTools } from '../../src/tools/retrieve.tool.js';
import { ElasticService, type ElasticClientLike } from '../../src/services/elastic.client.js';
import { VerificationRunClient, type VerificationRunClientLike } from '../../src/services/verification-run.client.js';
import { loadEnv } from '../../src/config/env.js';

const execFileAsync = promisify(execFile);
const runtime = loadEnv().sandbox.containerRuntime;

async function runtimeAvailable(): Promise<boolean> {
  try {
    await execFileAsync(runtime, ['version']);
    return true;
  } catch {
    return false;
  }
}

interface LexicalSearchQuery {
  bool: {
    must: [{ multi_match: { query: string; fields: string[] } }];
    filter: Array<{ term: Record<string, unknown> }>;
  };
}

function getByPath(doc: unknown, dottedPath: string): unknown {
  return dottedPath.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, doc);
}

/**
 * A minimal, genuinely-evaluated lexical search fake — not a hardcoded stub. It
 * honors the same query shape `buildLexicalQuery` actually produces: every
 * `filter` term clause must match, and the `multi_match` text must appear
 * (case-insensitive substring) in at least one of the named fields.
 */
function evaluateLexicalQuery(docs: Map<string, unknown>, query: LexicalSearchQuery) {
  const { query: text, fields } = query.bool.must[0].multi_match;
  const plainFields = fields.map((field) => field.split('^')[0]);
  const needle = text.toLowerCase();

  const hits: Array<{ _source: unknown; _score: number }> = [];
  for (const doc of docs.values()) {
    const filtersMatch = query.bool.filter.every(({ term }) => {
      const [field, expected] = Object.entries(term)[0];
      return getByPath(doc, field) === expected;
    });
    if (!filtersMatch) continue;

    const matchesText = plainFields.some((field) => {
      const value = getByPath(doc, field);
      return typeof value === 'string' && value.toLowerCase().includes(needle);
    });
    if (matchesText) hits.push({ _source: doc, _score: 1 });
  }
  return { hits: { hits } };
}

function makeSharedElasticClient(): ElasticClientLike {
  const store = new Map<string, unknown>();
  return {
    indices: {
      exists: vi.fn(async () => true),
      create: vi.fn(async () => ({})),
      getMapping: vi.fn(async () => ({})),
      refresh: vi.fn(async () => ({})),
    },
    index: vi.fn(async ({ id, document }: { id: string; document: unknown }) => {
      store.set(id, document);
      return {};
    }),
    get: vi.fn(async ({ id }: { id: string }) => {
      if (!store.has(id)) throw new Error('404: not found');
      return { _source: store.get(id) };
    }),
    search: vi.fn(async (params: Record<string, unknown>) => evaluateLexicalQuery(store, params.query as LexicalSearchQuery)),
    bulk: vi.fn(),
  } as ElasticClientLike;
}

function makeSharedVerificationRunClientLike(): VerificationRunClientLike {
  const store = new Map<string, unknown>();
  let indexExists = false;
  return {
    indices: {
      exists: vi.fn(async () => indexExists),
      create: vi.fn(async () => {
        indexExists = true;
        return {};
      }),
    },
    index: vi.fn(async ({ id, document }: { id: string; document: unknown }) => {
      store.set(id, document);
      return {};
    }),
    get: vi.fn(async ({ id }: { id: string }) => {
      if (!store.has(id)) throw new Error('404: not found');
      return { _source: store.get(id) };
    }),
  };
}

describe('End-to-end trust chain: verify_fix -> submit_fix -> search_fix/get_patch', () => {
  let hasRuntime = false;

  beforeEach(async () => {
    hasRuntime = await runtimeAvailable();
  });

  it('a genuine sandbox PASS becomes an immediately reusable, indexed knowledge card', async () => {
    if (!hasRuntime) return;

    const env = loadEnv({ ELASTICSEARCH_URL: 'https://es.example.com:9243' } as NodeJS.ProcessEnv);
    const elasticService = new ElasticService({ env, client: makeSharedElasticClient() });
    const verificationRunClient = new VerificationRunClient({ env, client: makeSharedVerificationRunClientLike() });

    const verifyTools = new VerifyTools({ verificationRunClient });
    const submitTools = new SubmitTools({ elasticService, verificationRunClient });
    const searchTools = new SearchTools({ elasticService });
    const retrieveTools = new RetrieveTools({ elasticService });

    const baselineCode = "from pydantic import BaseSettings\nprint('using old import')\n";
    const fixedCode = "from pydantic_settings import BaseSettings\nprint('using new import')\n";

    const verifyResult = await verifyTools.verifyFix({
      code: fixedCode,
      baselineCode,
      testCommand: `echo '${fixedCode}' | grep pydantic_settings`,
      environment: { language: 'python' },
      filePath: 'main.py',
    });

    expect(verifyResult.ok).toBe(true);
    expect(verifyResult.status).toBe('PASS');
    const verificationRunId = (verifyResult as Record<string, unknown>).verificationRunId as string;
    const diff = (verifyResult as Record<string, unknown>).diff as string;
    expect(verificationRunId).toBeTruthy();

    const submitResult = await submitTools.submitFix({
      problemDescription: "ImportError: cannot import name 'BaseSettings' from 'pydantic'",
      errorLog: "ImportError: cannot import name 'BaseSettings' from 'pydantic'",
      patch: diff,
      verificationLog: verificationRunId,
      environment: { language: 'python' },
    });

    expect(submitResult.ok).toBe(true);
    expect(submitResult.status).toBe('STORED');
    const knowledgeCardId = (submitResult as Record<string, unknown>).knowledgeCardId as string;
    expect(knowledgeCardId).toBeTruthy();

    // Immediately reusable via get_patch, no separate reindex/refresh step.
    const patchResult = await retrieveTools.getPatch({ knowledgeCardId });
    expect(patchResult.ok).toBe(true);
    expect(patchResult.status).toBe('OK');
    // knowledgeCardSchema's `patch: z.string().trim()...` legitimately trims
    // trailing whitespace on store; compare against the same normalization.
    expect((patchResult as Record<string, unknown>).unifiedDiff).toBe(diff.trim());

    // Immediately reusable via search_fix, using the same real (fake-backed) query path.
    const searchResult = await searchTools.searchFix({
      stacktrace: "ImportError: cannot import name 'BaseSettings' from 'pydantic'",
      language: 'python',
      limit: 5,
    });
    expect(searchResult.ok).toBe(true);
    expect(searchResult.status).toBe('HIT');
    const foundIds = (searchResult as Record<string, unknown>).fixes as Array<{ id: string }>;
    expect(foundIds.some((fix) => fix.id === knowledgeCardId)).toBe(true);
  }, 30000);

  it('a genuine sandbox FAIL is rejected end-to-end and never becomes searchable', async () => {
    if (!hasRuntime) return;

    const env = loadEnv({ ELASTICSEARCH_URL: 'https://es.example.com:9243' } as NodeJS.ProcessEnv);
    const elasticService = new ElasticService({ env, client: makeSharedElasticClient() });
    const verificationRunClient = new VerificationRunClient({ env, client: makeSharedVerificationRunClientLike() });

    const verifyTools = new VerifyTools({ verificationRunClient });
    const submitTools = new SubmitTools({ elasticService, verificationRunClient });

    const verifyResult = await verifyTools.verifyFix({
      code: 'this-does-not-fix-anything',
      testCommand: 'exit 1',
      environment: { language: 'general' },
    });

    expect(verifyResult.status).toBe('FAIL');
    const verificationRunId = (verifyResult as Record<string, unknown>).verificationRunId as string;
    const diff = (verifyResult as Record<string, unknown>).diff as string;

    const submitResult = await submitTools.submitFix({
      problemDescription: 'a fix that does not actually work',
      errorLog: 'SomeError: still broken',
      patch: diff,
      verificationLog: verificationRunId,
      environment: { language: 'general' },
    });

    expect(submitResult.status).toBe('REJECTED');
    expect((submitResult as Record<string, unknown>).indexed).toBe(false);
  }, 30000);
});
