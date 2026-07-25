import { McpApp, Module } from '@nitrostack/core';
import { SearchTools } from './tools/search.tool.js';
import { RetrieveTools } from './tools/retrieve.tool.js';
import { VerifyTools } from './tools/verify.tool.js';
import { SubmitTools } from './tools/submit.tool.js';

@McpApp({
  module: AppModule,
  server: {
    name: 'hacksmymachine-mcp',
    version: '1.0.0',
  },
})
@Module({
  name: 'app',
  providers: [SearchTools, RetrieveTools, VerifyTools, SubmitTools],
})
export class AppModule {}
export default AppModule;
