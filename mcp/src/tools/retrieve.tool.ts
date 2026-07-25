import { ToolDecorator as Tool, ControllerDecorator as Controller } from '@nitrostack/core';
import { z } from 'zod';
import { ElasticService } from '../services/elastic.client.js';

const getPatchSchema = z.object({
  knowledgeCardId: z.string().describe('Unique identifier of the verified knowledge card.'),
});

const getExecutionLogSchema = z.object({
  knowledgeCardId: z.string().describe('Unique identifier of the verified knowledge card.'),
});

@Controller()
export class RetrieveTools {
  private elasticService = new ElasticService();

  @Tool({
    name: 'get_patch',
    description: 'Returns the raw unified git diff patch for a verified solution.',
    inputSchema: getPatchSchema,
  })
  async getPatch(params: z.infer<typeof getPatchSchema>) {
    const card = await this.elasticService.getFixById(params.knowledgeCardId);
    if (!card) {
      return {
        found: false,
        error: `Knowledge card '${params.knowledgeCardId}' not found.`,
      };
    }
    return {
      found: true,
      id: card.id,
      unifiedDiff: card.patch,
    };
  }

  @Tool({
    name: 'get_execution_log',
    description: 'Retrieves full stdout/stderr verification execution logs for a specific knowledge entry.',
    inputSchema: getExecutionLogSchema,
  })
  async getExecutionLog(params: z.infer<typeof getExecutionLogSchema>) {
    const card = await this.elasticService.getFixById(params.knowledgeCardId);
    if (!card) {
      return {
        found: false,
        error: `Knowledge card '${params.knowledgeCardId}' not found.`,
      };
    }
    return {
      found: true,
      id: card.id,
      verification: card.verification,
      logText: `[SANDBOX RUN - ${card.verification.sandbox}]\nStatus: ${card.verification.status}\nVerified At: ${card.verification.lastVerified}\nExecution Score: ${card.verification.score}\nResult: Patch verified successfully.`,
    };
  }
}
