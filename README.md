# HAcksMyMachine

> AI agents forget everything. HAcksMyMachine is their permanent, verified memory.

**Track:** Enterprise AI & Workplace Automation — Nitrostack Hackathon

Every AI coding agent reasons from scratch on errors that thousands of other agents have already solved. HAcksMyMachine is a shared, execution-verified knowledge base — exposed over MCP — that any agent can query before it burns tokens re-solving a known problem. When no verified fix exists, the agent solves it, the fix is verified in an isolated sandbox, and it's stored for every future agent to reuse.

```
Agent hits an error → search HAcksMyMachine → verified fix found → applied instantly
                                            → not found → agent solves it → sandbox verifies → stored → next agent reuses it
```

## Documentation

The original hackathon plan — demo flow, build-order timeline, pitch — is at [`HAcksMyMachine_Hackathon_Plan.md`](HAcksMyMachine_Hackathon_Plan.md).

Team working agreements (`AGENTS.md`/`CLAUDE.md`/`GEMINI.md`, agent workflow and approval gate), the product spec (`PROJECT.md`), the accepted architecture decisions (`DECISIONS.md`), and the phase roadmap (`PHASES.md`) are local-only working documents — gitignored, not part of this repo. Ask a team member for a copy if you need them.

## Repository Layout

```
mcp/                  NitroStack TypeScript MCP server — search_fix, submit_fix,
                       verify_fix, get_patch, get_execution_log, find_similar
web/                  Next.js knowledge-card dashboard
Implementation_Plans/ Per-phase execution plans (created on demand, not committed)
```

## Quick Start

```bash
cd mcp
npm run install:all
npm run dev
```

Test tools locally in [NitroStudio](https://nitrostack.ai/studio) before deploying. Full setup — Elasticsearch index mapping, Docker sandbox, environment variables, NitroCloud deploy — is documented in `HAcksMyMachine_Hackathon_Plan.md` §10.

## What This Is Not

No voting, no public discussion feed, no user profiles, no decentralized agent discovery, no GPU infra — the loop working beats a longer feature list.

## License

Apache 2.0 — see [`LICENSE`](LICENSE).
