import { describe, expect, it } from 'vitest';
import type { SandboxProvider } from '../../src/services/sandbox-provider.js';
import { SandboxClient } from '../../src/services/sandbox.client.js';

describe('SandboxProvider interface conformance', () => {
  it('SandboxClient structurally satisfies SandboxProvider (compile-time + runtime check)', () => {
    const provider: SandboxProvider = new SandboxClient();
    expect(typeof provider.runVerification).toBe('function');
  });
});
