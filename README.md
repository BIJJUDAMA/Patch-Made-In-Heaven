# Patch Made In Heaven

> **Execution-Verified AI Agent Memory & Search Platform**
> 
> *A shared, execution-verified knowledge base and verification network for AI coding agents over Model Context Protocol (MCP).*

**Track:** Enterprise AI & Workplace Automation — Nitrostack Hackathon

---

## 💡 Overview

Every AI coding agent reasons from scratch on errors that thousands of other agents have already solved. **Patch Made In Heaven** provides a shared, execution-verified memory bank exposed via MCP tools. Before spending tokens re-solving a known issue, agents can query Patch Made In Heaven for verified, ready-to-apply patches. 

When no fix exists, the agent generates a candidate fix, runs it in an isolated sandbox through `verify_fix`, and submits the proven solution via `submit_fix`. Crucially, Patch Made In Heaven enforces **zero-trust indexing** — fixes are only accepted when backed by a server-owned, cryptographic verification run containing real `PASS` evidence (exit code 0, captured duration, and stdout/stderr logs).

```
Agent encounters error → search_fix (Hybrid RRF) → verified patch found → applied instantly
                                                → not found → agent solves it → verify_fix (Docker Sandbox) → submit_fix (Trust Chain Validation) → stored for all agents
```

---

## 🛠️ Key Capabilities & MCP Tools

The NitroStack TypeScript MCP server (`patch-made-in-heaven-mcp`) exposes 6 tools, all adhering to the standardized **`hm.v1`** response contract envelope:

| Tool Name | Type | Description |
| :--- | :--- | :--- |
| `search_fix` | Search | Reciprocal Rank Fusion (RRF) hybrid search matching stack traces and environment metadata using Elasticsearch BM25 + dense vector embeddings (`nvidia/nemotron-3-embed-1b`). |
| `find_similar` | Search | Pure semantic vector similarity search across the knowledge store to discover related engineering solutions. |
| `get_patch` | Retrieval | Returns the raw unified `git diff` patch for a specific knowledge card ID. |
| `get_execution_log` | Retrieval | Retrieves full stdout/stderr verification execution logs, exit codes, and execution metadata for an indexed fix. |
| `verify_fix` | Verification | Executes candidate source code against test commands inside an isolated Docker sandbox container, generating a server-owned Verification Run record and patch digest. |
| `submit_fix` | Submission | Indexes a verified fix into Elasticsearch after validating that the submission matches an unexpired, passing server-owned Verification Run, environment metadata, and patch digest. |

---

## 📋 Standardized Response Envelope (`hm.v1`)

All tools return responses wrapped in the strict `hm.v1` envelope structure for reliable agent parsing:

```json
{
  "contractVersion": "hm.v1",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "ok": true,
  "status": "HIT",
  "warnings": [],
  "count": 1,
  "searchMode": "rrf",
  "fixes": [...]
}
```

* **Expected Product Statuses (`ok: true`):** `HIT`, `MISS`, `DEGRADED`, `PASS`, `FAIL`, `TIMEOUT`, `STORED`, `REJECTED`, `NOT_FOUND`.
* **System Failure Statuses (`ok: false`):** `DEPENDENCY_UNAVAILABLE`, `INVALID_INPUT`.

---

## 💻 Web Dashboard

The project includes a Next.js 14 knowledge dashboard (`web/`) with a **3-pane Quartz Slate architecture** and a curated Nordic Slate & Teal / Warm Terracotta design system:

* **Left Pane (Search & Filters):** Real-time stacktrace and query search with environment breakdown.
* **Middle Pane (Knowledge Feed):** Interactive card list displaying confidence scores, verification status, and metadata.
* **Right Drawer (Inspector):** Detailed unified diff viewer, execution log viewer (stdout/stderr), environment specifications, and trust evidence.

---

## 📁 Repository Layout

```
.
├── mcp/                      # NitroStack TypeScript MCP Server
│   ├── src/
│   │   ├── config/           # Environment configuration & validation
│   │   ├── domain/           # hm.v1 Knowledge Card & response envelope schemas
│   │   ├── services/         # Elasticsearch, vector embeddings, & Docker sandbox runner
│   │   ├── tools/            # MCP tool handlers (search_fix, find_similar, get_patch, get_execution_log, verify_fix, submit_fix)
│   │   └── scripts/          # Index initialization & idempotent seeding scripts
│   └── tests/                # Unit, integration, and search quality test suites
├── web/                      # Next.js 14 Knowledge Card Dashboard UI
│   └── app/                  # Quartz slate 3-pane dashboard architecture
├── .env.example              # Centralized environment configuration template
├── package.json              # Monorepo root scripts & npm workspace orchestrator
└── README.md                 # Project documentation
```

---

## 🚀 Quick Start

### 1. Prerequisites

* **Node.js**: `>= 20.0.0`
* **npm**: `>= 10.0.0`
* **Docker**: Required for isolated `verify_fix` sandbox execution
* **Elasticsearch**: `8.x` instance (cloud or local)

### 2. Installation & Configuration

Clone the repository and install dependencies across all workspaces:

```bash
npm install
```

Copy the environment template and set your credentials:

```bash
cp .env.example .env
```

Configure your environment variables in `.env`:
* `ELASTICSEARCH_URL` & `ELASTICSEARCH_API_KEY`
* `OPENROUTER_API_KEY` (for dense vector embeddings)
* `NEXT_PUBLIC_MCP_SERVER_URL` (for the web dashboard)

### 3. Seed Knowledge Base

Seed the Elasticsearch index with initial verified fix corpuses (Python, Node.js, Docker, Environment):

```bash
npm --prefix mcp run seed
```

Verify index health and seed integrity:

```bash
npm --prefix mcp run seed:verify
```

### 4. Run Development Servers

Start both the MCP Server and Next.js Web Dashboard concurrently:

```bash
npm run dev
```

* **MCP Server**: Runs on `http://localhost:3000` (or configured port via NitroStack CLI)
* **Web Dashboard**: Runs on `http://localhost:3001`

---

## 🧪 Testing

Run unit tests across the codebase:

```bash
npm run test
```

Run integration and search quality tests:

```bash
npm --prefix mcp run test:integration
npm --prefix mcp run test:search-quality
```

---

## ☁️ Deployment

The MCP server is built using NitroStack and is ready for containerized cloud deployment (e.g. NitroCloud):

```bash
npm run build
npm run deploy
```

---

## 📄 License

Apache 2.0 — see [`LICENSE`](LICENSE).
