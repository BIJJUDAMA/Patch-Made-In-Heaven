import type { SandboxOptions, SandboxResult } from './sandbox.client.js';

export type { SandboxOptions, SandboxResult };

/**
 * Provider-agnostic sandbox execution contract (Phase 6, Decision 010).
 * `SandboxClient` (local Docker/podman, unchanged) and `E2BSandboxClient`
 * (production, NitroCloud) both satisfy this — `verify_fix` depends on the
 * interface, never a concrete provider, so which one runs is a runtime
 * selection (see `verify.tool.ts`), not a hardcoded choice.
 */
export interface SandboxProvider {
  runVerification(options: SandboxOptions): Promise<SandboxResult>;
}
