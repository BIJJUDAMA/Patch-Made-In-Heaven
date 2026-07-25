# DECISIONS.md

Architectural and product decisions for HackOverflow.

This file is the source of truth for accepted decisions. Before proposing any architectural change, read this document, verify the topic has not already been decided, and follow the existing decision if one exists. Overriding an accepted decision requires recording rationale in `HANDOFF.md` and getting explicit human approval — do not override unilaterally.

Allowed statuses: `Proposed`, `Accepted`, `Deprecated`, `Rejected`. Agents may add `Proposed` decisions. Only humans may mark a decision `Accepted`.

---

## Decision 001

Topic:

MCP Framework & Hosting

Status:

Accepted

Decision:

The HackOverflow MCP server is written in TypeScript using NitroStack and deployed on NitroCloud.

Reasoning:

* Serverless auto-scaling execution via Knative
* Strict Zod schema enforcement for tool inputs
* Native compatibility with MCP clients (Cursor, Claude Desktop, OpenHands)

Implications:

All exposed agent tools (`search_fix`, `verify_fix`, `submit_fix`, etc.) must be implemented using `@nitrostack/core` tool decorators.

---

## Decision 002

Topic:

Search Engine Infrastructure

Status:

Accepted

Decision:

Elasticsearch handles all knowledge indexing and retrieval (BM25 keyword + dense vectors + reranking).

Reasoning:

Provides optimal hybrid search for error stack traces, package versions, and semantic fix matching.

Implications:

Do not build custom vector search or keyword parsers; delegate search indexing strictly to Elasticsearch.

---

## Decision 003

Topic:

Execution Verification Requirement

Status:

Accepted

Decision:

All submitted fixes must pass sandbox execution (Docker) before being indexed into the knowledge base.

Reasoning:

Guarantees high-confidence, execution-verified memory for downstream agents rather than unverified text suggestions.

Implications:

No fix can be marked as verified without valid sandbox execution logs.

---

## Decision 004

Topic:

Deprecation of Legacy Kubernetes & Agent Frameworks

Status:

Accepted

Decision:

Kubernetes manifests (`kind/`, `argocd/`, `helm-charts/`) and decentralized agent frameworks (e.g., Fetch.ai) are out of scope.

Reasoning:

Simplifies the platform architecture and eliminates operational complexity during hackathon deployment.

Implications:

Do not reintroduce Kubernetes CRDs or proprietary agent protocols.

---

## Decision 005

Topic:

Sandbox Runtime — Docker over Modal

Status:

Accepted

Decision:

Verification sandboxing uses local Docker containers, not Modal.

Reasoning:

Modal requires a signup, a billing account, and a new SDK. Docker gives equivalent isolation for the hackathon with zero external dependency. Modal is deferred to the V2 roadmap (see `HackOverflow_Hackathon_Plan.md` §14).

Implications:

`sandbox.client.ts` targets the local Docker Engine API. Do not add a Modal dependency without a new decision entry.

---

## Decision 006

Topic:

Cold-Start Seeding

Status:

Accepted

Decision:

The knowledge base must be pre-seeded with 50–80 verified fix entries before demo day, spanning Python, Node.js, Docker, and general dependency/environment errors.

Reasoning:

An empty knowledge base demonstrates nothing. Seeding is required for the "cache hit" demo beat to work reliably on stage.

Implications:

Seeding is a Phase 1 blocker, not a polish task — it happens before search tooling is wired up. See `HackOverflow_Hackathon_Plan.md` §8 for category breakdown.

---

## Decision 007

Topic:

Feature Scope Boundary

Status:

Accepted

Decision:

No voting/reputation system, no public discussion feed, no user profiles, no Fetch.ai discovery, no GPU infra, no Elastic AI Builder abstraction (use raw Elasticsearch).

Reasoning:

Every one of these adds complexity with zero demo value; judges evaluate whether the core loop (search → miss → verify → reuse) works, not a features list.

Implications:

Reject scope additions in this list without explicit human approval. See `HackOverflow_Hackathon_Plan.md` §6.
