import { ToolDecorator as Tool, ControllerDecorator as Controller } from '@nitrostack/core';
import { z } from 'zod';
import { SandboxClient } from '../services/sandbox.client.js';

const verifyFixSchema = z.object({
  code: z.string().describe('The source code snippet or fix candidate to execute.'),
  testCommand: z.string().describe('The command to run verification (e.g. python main.py or node index.js).'),
  environment: z.object({
    language: z.string().describe('Programming language environment (e.g. python, javascript).'),
    version: z.string().optional().describe('Version of runtime environment.'),
  }),
});

@Controller()
export class VerifyTools {
  private sandboxClient = new SandboxClient();

  @Tool({
    name: 'verify_fix',
    description: 'Triggers an isolated sandbox run to execute a proposed fix against a test command and capture run logs.',
    inputSchema: verifyFixSchema,
  })
  async verifyFix(params: z.infer<typeof verifyFixSchema>) {
    const result = await this.sandboxClient.runVerification({
      code: params.code,
      testCommand: params.testCommand,
      environment: params.environment,
    });

    return {
      status: result.status,
      exitCode: result.exitCode,
      executionLog: `STDOUT:\n${result.stdout}\n\nSTDERR:\n${result.stderr}`,
      executionTimeMs: result.executionTimeMs,
      sandbox: result.sandboxType,
    };
  }
}
