import { McpApp, Module } from '@nitrostack/core';
import { SearchTools } from './tools/search.tool.js';
import { RetrieveTools } from './tools/retrieve.tool.js';

// VerifyTools and SubmitTools are intentionally NOT registered as providers.
// Their trust chain (real Docker isolation now exists via SandboxClient, but
// `verify_fix`/`submit_fix` still need the end-to-end verified-submission
// contract) is not complete until Phase 3. Registering them here would expose
// incomplete public tools to MCP clients. See DECISIONS.md Decision 005 and
// Implementation_Plans/PHASE_01_CHECKPOINTS.md Checkpoint 5.

@McpApp({
  module: AppModule,
  server: {
    name: 'hacksmymachine-mcp',
    version: '1.0.0',
  },
})
@Module({
  name: 'app',
  providers: [SearchTools, RetrieveTools],
})
export class AppModule {}
export default AppModule;
