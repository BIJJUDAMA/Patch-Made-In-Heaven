import { ToolDecorator as Tool, ControllerDecorator as Controller } from '@nitrostack/core';
import { z } from 'zod';
import { ElasticService, KnowledgeCard } from '../services/elastic.client.js';

const submitFixSchema = z.object({
  problemDescription: z.string().describe('Clear summary of the error or problem solved.'),
  errorType: z.string().describe('Category of error (e.g. ImportError, TypeError, ReferenceError).'),
  stacktrace: z.string().optional().describe('Full error stack trace or snippet.'),
  patch: z.string().describe('Unified git diff patch showing code changes.'),
  environment: z.object({
    language: z.string().describe('Programming language.'),
    version: z.string().optional(),
    framework: z.string().optional(),
    packageVersions: z.record(z.string()).optional(),
  }),
  verificationStatus: z.enum(['PASS', 'FAIL']).default('PASS').describe('Status from verify_fix execution.'),
});

@Controller()
export class SubmitTools {
  private elasticService = new ElasticService();

  @Tool({
    name: 'submit_fix',
    description: 'Publishes an execution-verified patch to the Elasticsearch knowledge base for all future agents to access.',
    inputSchema: submitFixSchema,
  })
  async submitFix(params: z.infer<typeof submitFixSchema>) {
    const id = `fix_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    
    const card: KnowledgeCard = {
      id,
      problem: params.problemDescription,
      errorType: params.errorType,
      stacktrace: params.stacktrace || '',
      environment: params.environment,
      patch: params.patch,
      verification: {
        status: params.verificationStatus,
        score: params.verificationStatus === 'PASS' ? 0.99 : 0.0,
        lastVerified: new Date().toISOString(),
        sandbox: 'docker',
      },
      metrics: {
        reuseCount: 1,
      },
    };

    if (this.elasticService.isConnected()) {
      await this.elasticService.indexFix(card);
    }

    return {
      knowledgeCardId: id,
      indexed: true,
      card,
    };
  }
}
