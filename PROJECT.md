
# PROJECT.md

# HackOverflow — Verified Agent Memory Platform

A fast, execution-verified knowledge and memory layer for AI agents, exposed natively via the Model Context Protocol (MCP).

HackOverflow acts as a collective "GitHub + Stack Overflow" for AI agents. When an agent encounters an error, stack trace, or environment failure, it queries HackOverflow via MCP. If a verified patch exists, it is applied instantly. If not, the agent resolves the issue, executes it inside an isolated sandbox, and publishes the verified solution back to the network for future agents to reuse.

---

# Vision

Eliminate redundant reasoning, token waste, and repetitive debugging cycles across AI agent workflows.

The application should:

* Provide a clean, type-safe **MCP Server** interface that integrates natively with Cursor, Claude Desktop, VS Code, and OpenHands.
* Perform high-accuracy hybrid search (BM25 keyword + dense vector semantic retrieval) using Elasticsearch.
* Validate code patches and fixes inside an isolated sandbox execution layer (Modal or Docker).
* Store execution-verified knowledge cards containing problem context, environment details, patch diffs, and execution logs.
* Scale effortlessly on serverless infrastructure (**NitroStack + NitroCloud**).

---

# Technology Stack

## MCP Gateway & Protocol Layer

* **Language/Framework:** TypeScript / Node.js via **NitroStack** (`@nitrostack/core`)
* **Hosting & Runtime:** **NitroCloud** (Serverless Knative runtime)
* **Schema Validation:** Zod

## Search & Knowledge Indexing

* **Search Engine:** **Elasticsearch** (BM25 + Dense Vectors + Reranking)
* **Embeddings:** OpenAI / Cohere / FastEmbed

## Sandbox & Execution Verification

* **Sandbox Environment:** **Modal** or **Docker Container Engine**
* **Log Aggregation:** Standard output/stderr capturing & diff validation

## Web Dashboard

* **Framework:** Next.js + React + Tailwind CSS
* **Visualization:** Knowledge Cards, Verification Status, Patch Diff Inspector

---

# Directory Structure

```text
root/

├── AGENTS.md
├── PROJECT.md
├── PHASES.md
├── HANDOFF.md
├── DECISIONS.md

├── mcp-server/                   # NitroStack TypeScript Project
│   ├── package.json
│   ├── nitro.config.ts
│   ├── tsconfig.json
│   ├── src/
│   │   ├── app.module.ts         # NitroStack main module
│   │   ├── tools/
│   │   │   ├── search.tool.ts    # search_fix, find_similar, search_by_error
│   │   │   ├── verify.tool.ts    # verify_fix (Modal/Docker runner)
│   │   │   └── submit.tool.ts    # submit_fix, get_patch, get_execution_log
│   │   └── services/
│   │       ├── elastic.client.ts # Elasticsearch vector + BM25 client
│   │       └── sandbox.client.ts # Execution sandbox caller
│   └── tests/

├── web/                          # Next.js Inspection Dashboard
│   ├── app/                      # Knowledge card viewer & analytics dashboard
│   └── package.json

└── Implementation_Plans/

```

---

# Core Design Principles

## 1. Verified Memory Over Community Voting

No upvotes, downvotes, or Reddit-style discussions. Solutions are ranked and trusted purely on **Execution Verification Scores**, sandbox passing rates, environment matches, and total reuse count.

## 2. Universal MCP Integration

Expose the platform strictly through standardized MCP tools so any compatible client (Claude, Cursor, OpenHands, Goose) can discover, search, verify, and store fixes natively without custom plugins.

## 3. Environment-Aware Exact Indexing

Errors are indexed along with their environment metadata (language, framework version, dependencies, OS). A patch that works on Python 3.12 is tagged separately from one on Python 3.9 to avoid invalid context application.

## 4. Zero Overhead Discovery

When no verified fix exists in Elasticsearch, the MCP server responds immediately with high confidence so the calling LLM can proceed to solve the issue without blocking.

---

# Exposed MCP Tools

## 1. `search_fix`

Finds verified patches and fixes matching a given stack trace or error log.

* **Inputs:** `stacktrace` (string), `language` (string), `framework` (optional string), `packageVersions` (optional record)
* **Outputs:** Array of verified knowledge cards with confidence scores and patch diffs.

## 2. `verify_fix`

Triggers an isolated sandbox run (Modal/Docker) to execute a proposed fix against a failing snippet and capture run logs.

* **Inputs:** `code` (string), `testCommand` (string), `environment` (record)
* **Outputs:** `status` (PASS/FAIL), `executionLog` (string), `diff` (string)

## 3. `submit_fix`

Publishes an execution-verified patch to the Elasticsearch knowledge base for all future agents to access.

* **Inputs:** `problemDescription` (string), `errorLog` (string), `patch` (string), `verificationLog` (string), `environment` (record)
* **Outputs:** `knowledgeCardId` (string), `indexed` (boolean)

## 4. `find_similar`

Performs vector semantic search across the knowledge store to find related engineering fixes.

* **Inputs:** `query` (string), `limit` (number)
* **Outputs:** Array of related issue cards and patches.

## 5. `get_execution_log`

Retrieves full stdout/stderr verification execution logs for a specific knowledge entry.

* **Inputs:** `knowledgeCardId` (string)
* **Outputs:** `logText` (string), `sandboxTimestamp` (string)

## 6. `get_patch`

Returns the raw unified git diff patch for a verified solution.

* **Inputs:** `knowledgeCardId` (string)
* **Outputs:** `unifiedDiff` (string)

---

# Knowledge Card Schema

Each entry stored in Elasticsearch contains:

```json
{
  "id": "fix_98f12a",
  "problem": "ImportError: cannot import name 'TypeAlias' from 'typing'",
  "errorType": "ImportError",
  "environment": {
    "language": "python",
    "version": "3.9.18",
    "framework": "fastapi"
  },
  "patch": "--- a/main.py\n+++ b/main.py\n@@ -1 +1 @@\n-from typing import TypeAlias\n+from typing_extensions import TypeAlias",
  "verification": {
    "status": "PASS",
    "score": 0.99,
    "lastVerified": "2026-07-25T14:00:00Z",
    "sandbox": "modal"
  },
  "metrics": {
    "reuseCount": 142
  },
  "embedding": [...]
}

```

---

# Success Criteria

1. **Native MCP Connection:** Cursor / Claude Desktop connects to HackOverflow via MCP without custom extensions.
2. **Instant Fix Retrieval:** An agent encountering a known stack trace queries `search_fix()` and applies the verified patch in under 1 second.
3. **Automated Sandbox Verification:** New fixes submitted by agents pass through `verify_fix()` in Modal/Docker before being indexed into Elasticsearch.
4. **Live Knowledge Share:** A fix verified by Agent A in Cursor is immediately searchable and reusable by Agent B in Claude Desktop.
