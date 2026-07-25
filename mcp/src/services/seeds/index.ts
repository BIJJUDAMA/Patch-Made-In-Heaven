import type { EnvironmentMeta } from '../../domain/knowledge-card.js';
import { PYTHON_SEED_FIXTURES } from './python.js';

/**
 * Shared seed fixture contract for Checkpoints 6-9. A fixture is NOT yet a
 * Knowledge Card — it is a reproducible bug/fix pair that `verify-seeds.ts`
 * actually runs through the Docker sandbox to produce real PASS evidence
 * before it can become a trusted card. No fixture here is pre-verified data;
 * the evidence only exists once someone runs `npm run seed:verify`.
 */
export type SeedCategory = 'python' | 'node' | 'docker' | 'general';

export interface SeedFixtureDefinition {
  /** Stable, lowercase slug id. Must be unique across the entire corpus. */
  id: string;
  problem: string;
  errorType: string;
  category: SeedCategory;
  environment: EnvironmentMeta;
  /** Code that reproduces the bug. Running `testCommand` against it must FAIL. */
  brokenCode: string;
  /** Code after applying the fix. Running `testCommand` against it must PASS. */
  fixedCode: string;
  /** Command run inside the sandbox, cwd `/workspace`, against `main.<fileExtension>`. */
  testCommand: string;
  fileExtension: string;
}

export const ALL_SEED_FIXTURES: SeedFixtureDefinition[] = [...PYTHON_SEED_FIXTURES];

export function getFixturesByCategory(category: SeedCategory): SeedFixtureDefinition[] {
  return ALL_SEED_FIXTURES.filter((fixture) => fixture.category === category);
}
