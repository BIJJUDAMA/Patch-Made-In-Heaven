
# PHASES.md

# Development Roadmap

This document describes the implementation strategy for building **HackOverflow** as an MCP-native, execution-verified agent memory platform hosted on NitroCloud.

The goal is to deliver value quickly by focusing on core verification and search primitives, avoiding bloated features, and ensuring every phase yields a working, testable product.

Do not begin work on a later phase until the previous phase is stable and verified.

---

# Architecture Rules

These rules apply to all phases.

## Rule 1

All agent interactions must occur through standardized **Model Context Protocol (MCP)** tool interfaces using NitroStack.

Never build proprietary client plugins when standard MCP tool schemas can achieve the goal.

---

## Rule 2

Every knowledge entry must be **execution-verified** in a sandbox (Modal or Docker) before being marked as trusted in Elasticsearch.

Never allow unverified community patches or arbitrary text to be indexed without sandbox run logs.

---

## Rule 3

Search queries must evaluate both semantic similarity (dense vectors) and exact environment matches (language, framework version, error type).

---

## Rule 4

All secret keys (Elasticsearch credentials, Modal API tokens, OpenAI/Cohere embedding keys) must be loaded dynamically via environment variables.

---

# PHASE 1

# Core Memory & Search Layer

Goal:

Set up the Elasticsearch knowledge store and build the hybrid search engine for error traces and patches.

Expected duration:

Short.

Priority:

Critical.

---

## Features

### Index Initialization

Create:

```text
mcp-server/src/services/elastic.client.ts

```

Configure Elasticsearch index with mappings for:

* `errorType` (keyword)
* `stacktrace` (text + dense vector embedding)
* `environment` (object: language, framework, versions)
* `patch` (text)
* `verification` (object: status, score, logs)

---

### Seed Verified Knowledge Base

Populate Elasticsearch with initial high-utility seed patches (e.g., common Python, TypeScript, and Go dependency errors) to support immediate local testing.

---

### Hybrid Search Service

Implement combined BM25 keyword matching + vector similarity + environment filtering to query fixes by stack trace and environment.

---

## Deliverables

Working Elasticsearch client.

Seeded knowledge base.

Executable unit tests verifying fix retrieval matching stack traces.

---

# PHASE 2

# NitroStack MCP Server Setup

Goal:

Build the primary TypeScript MCP server exposing HackOverflow capabilities to AI clients.

---

## Features

### NitroStack Project Initialization

Scaffold:

```text
mcp-server/

```

using `@nitrostack/cli`.

Install core dependencies: `@nitrostack/core` and `zod`.

---

### Search Tools Provider

Implement:

```text
mcp-server/src/tools/search.tool.ts

```

Define tools using `@Tool` decorators:

* `search_fix`: Takes `stacktrace`, `language`, `framework`, and `packageVersions`. Returns verified knowledge cards.
* `find_similar`: Performs semantic vector search across the knowledge index.
* `search_by_error`: Quick search by error class (e.g., `ImportError`, `TypeError`).

---

### Retrieval Tools Provider

Implement:

```text
mcp-server/src/tools/retrieve.tool.ts

```

Define tools:

* `get_patch`: Returns unified diff for a verified entry.
* `get_execution_log`: Returns raw stdout/stderr sandbox verification logs.

---

### App Module Registration

Register providers in:

```text
mcp-server/src/app.module.ts

```

Configure server metadata (`hackoverflow-mcp`, version `1.0.0`).

---

## Deliverables

Compiling TypeScript MCP server.

Zod input schema validation layer.

Working local MCP server running via Stdio/SSE.

---

# PHASE 3

# Sandbox Execution & Verification Pipeline

Goal:

Enable agents to submit fixes and verify them in an isolated execution sandbox.

---

## Features

### Sandbox Runner Integration

Implement:

```text
mcp-server/src/services/sandbox.client.ts

```

Integrate Modal or Docker Container Engine to execute test scripts and code diffs in isolated environments.

---

### Verification Tool Provider

Implement:

```text
mcp-server/src/tools/verify.tool.ts

```

Define tool:

* `verify_fix`: Accepts `code`, `testCommand`, and `environment`. Runs code inside the sandbox, captures logs, and returns `status` (PASS/FAIL), `diff`, and `executionLog`.

---

### Submission Tool Provider

Implement:

```text
mcp-server/src/tools/submit.tool.ts

```

Define tool:

* `submit_fix`: Validates sandbox passage, generates embeddings for the problem context, and indexes the newly verified knowledge card into Elasticsearch.

---

## Deliverables

Modal/Docker sandbox runner.

Functional `verify_fix` and `submit_fix` MCP tools.

End-to-end loop: Submit broken code -> Sandbox run -> Index verified patch.

---

# PHASE 4

# Visual Testing & NitroStudio Verification

Goal:

Verify tool execution, schema compliance, and live client integration visually before production deployment.

---

## Features

### NitroStudio Visual Inspection

Launch:

```bash
npm run dev

```

Inspect and test all 6 core MCP tools inside **NitroStudio**:

* `search_fix`
* `verify_fix`
* `submit_fix`
* `find_similar`
* `get_execution_log`
* `get_patch`

---

### LLM Client Integration Testing

Connect the local MCP server to active AI clients:

* Cursor (`.cursor/mcp.json`)
* Claude Desktop (`claude_desktop_config.json`)

Verify live scenario: Trigger an error in Cursor -> Claude/Cursor calls `search_fix()` via MCP -> Receives verified patch -> Applies fix.

---

## Deliverables

Verified tool execution in NitroStudio.

Confirmed live execution inside Cursor and Claude Desktop.

---

# PHASE 5

# Production Deployment & Inspection Dashboard

Goal:

Deploy the MCP server live on NitroCloud and launch the Next.js Knowledge Inspector dashboard.

---

## Features

### NitroCloud Deployment

Configure `mcp-server/nitro.config.ts` and environment variables (`ELASTICSEARCH_URL`, `MODAL_TOKEN`, `OPENAI_API_KEY`).

Deploy to NitroCloud:

```bash
npx @nitrostack/cli deploy

```

Obtain live HTTPS MCP endpoint.

---

### Web Inspection Dashboard (`web/`)

Build a lightweight Next.js dashboard to visually browse Knowledge Cards, view execution logs, inspect patch diffs, and check verification confidence metrics.

---

## Deliverables

Live, auto-scaling HackOverflow MCP Server running on NitroCloud.

Public Next.js Knowledge Card Inspector dashboard.

Complete submission documentation and demo script.

---

# Completion Criteria

The project is considered complete when:

* AI clients (Cursor, Claude Desktop) connect natively to HackOverflow via MCP.
* An agent encountering an error retrieves a verified patch in < 1 second.
* New patches are verified inside an isolated Modal/Docker sandbox before indexing.
* All solutions are stored as structured Knowledge Cards in Elasticsearch.
* The MCP server is deployed live on NitroCloud.
