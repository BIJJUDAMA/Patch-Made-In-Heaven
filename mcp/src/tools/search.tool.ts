import { ToolDecorator as Tool, ControllerDecorator as Controller } from '@nitrostack/core';
import { z } from 'zod';
import { ElasticService } from '../services/elastic.client.js';

const searchFixSchema = z.object({
  stacktrace: z.string().describe('The error stacktrace or error message to search for.'),
  language: z.string().describe('Programming language environment (e.g. python, javascript, docker).'),
  framework: z.string().optional().describe('Framework name if applicable (e.g. fastapi, express, react).'),
  packageVersions: z.record(z.string()).optional().describe('Key-value record of active package versions.'),
  limit: z.number().optional().default(5).describe('Maximum number of results to return.'),
});

const findSimilarSchema = z.object({
  query: z.string().describe('Problem description or natural language query.'),
  limit: z.number().optional().default(5).describe('Maximum number of results to return.'),
});

const searchByErrorSchema = z.object({
  errorType: z.string().describe('Exact error class (e.g. ImportError, ReferenceError, DockerError).'),
  message: z.string().optional().describe('Optional message snippet to refine the search.'),
  limit: z.number().optional().default(5).describe('Maximum number of results to return.'),
});

@Controller()
export class SearchTools {
  private elasticService = new ElasticService();

  @Tool({
    name: 'search_fix',
    description: 'Finds verified patches and fixes matching a given stack trace or error log.',
    inputSchema: searchFixSchema,
  })
  async searchFix(params: z.infer<typeof searchFixSchema>) {
    const results = await this.elasticService.searchFix(params);
    return {
      count: results.length,
      fixes: results,
    };
  }

  @Tool({
    name: 'find_similar',
    description: 'Performs semantic vector search across the knowledge store to find related engineering fixes.',
    inputSchema: findSimilarSchema,
  })
  async findSimilar(params: z.infer<typeof findSimilarSchema>) {
    const results = await this.elasticService.findSimilar(params.query, params.limit);
    return {
      count: results.length,
      fixes: results,
    };
  }

  @Tool({
    name: 'search_by_error',
    description: 'Queries verified fixes sorted by error class and message.',
    inputSchema: searchByErrorSchema,
  })
  async searchByError(params: z.infer<typeof searchByErrorSchema>) {
    const queryStr = params.message ? `${params.errorType} ${params.message}` : params.errorType;
    const results = await this.elasticService.findSimilar(queryStr, params.limit);
    return {
      count: results.length,
      fixes: results,
    };
  }
}
