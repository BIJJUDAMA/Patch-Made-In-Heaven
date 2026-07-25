# HackOverflow

> AI agents forget everything. HackOverflow is their permanent, verified memory.

**Track:** Enterprise AI & Workplace Automation — Nitrostack Hackathon

Every AI coding agent reasons from scratch on errors that thousands of other agents have already solved. HackOverflow is a shared, execution-verified knowledge base — exposed over MCP — that any agent can query before it burns tokens re-solving a known problem. When no verified fix exists, the agent solves it, the fix is verified in an isolated sandbox, and it's stored for every future agent to reuse.

```
Agent hits an error → search HackOverflow → verified fix found → applied instantly
                                            → not found → agent solves it → sandbox verifies → stored → next agent reuses it
```

## Documentation

Read in this order — see `AGENTS.md` for the full map and workflow rules.

| File | Purpose |
|---|---|
| [`AGENTS.md`](AGENTS.md) | Agent workflow, approval gate, handoff protocol |
| [`PROJECT.md`](PROJECT.md) | Product vision, tech stack, MCP tool contracts |
| [`DECISIONS.md`](DECISIONS.md) | Accepted architectural decisions |
| [`PHASES.md`](PHASES.md) | Development roadmap and phase definitions |
| [`HackOverflow_Hackathon_Plan.md`](HackOverflow_Hackathon_Plan.md) | Original hackathon plan — demo flow, build-order timeline, pitch |

## Repository Layout

```
mcp/                  NitroStack TypeScript MCP server (search_fix, submit_fix, verify_fix, ...)
web/                  Next.js knowledge-card dashboard (Phase 5)
Implementation_Plans/ Per-phase execution plans (created on demand, not committed)
```

## Quick Start

```bash
cd mcp
npm run install:all
npm run dev
```

Test tools locally in [NitroStudio](https://nitrostack.ai/studio) before deploying. Full setup — Elasticsearch index mapping, Docker sandbox, environment variables, NitroCloud deploy — is documented in `HackOverflow_Hackathon_Plan.md` §10.

## What This Is Not

No voting, no public discussion feed, no user profiles, no decentralized agent discovery, no GPU infra. See `DECISIONS.md` (Decision 007) for the full scope boundary — the loop working beats a longer feature list.

## License

Apache 2.0 — see [`LICENSE`](LICENSE).
