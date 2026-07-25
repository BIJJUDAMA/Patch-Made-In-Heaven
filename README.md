# Patch Made In Heaven

Execution-Verified AI Agent Memory and Search Platform

Track: Enterprise AI and Workplace Automation, Nitrostack Hackathon

## System Architecture

```
+-----------------------------------------------------------------------------------+
|                                    AI Agent                                       |
+-----------------------------------------------------------------------------------+
                                         |
                                         | Model Context Protocol (MCP)
                                         v
+-----------------------------------------------------------------------------------+
|                              NitroStack MCP Server                                |
|                                                                                   |
|  +--------------------+  +---------------------+  +----------------------------+  |
|  |    Search Tools    |  |   Retrieval Tools   |  |  Verification & Submission |  |
|  |                    |  |                     |  |                            |  |
|  | - search_fix       |  | - get_patch        |  | - verify_fix               |  |
|  | - find_similar     |  | - get_execution_log |  | - submit_fix               |  |
|  +---------+----------+  +----------+----------+  +-------------+--------------+  |
+------------|------------------------|---------------------------|-----------------+
             |                        |                           |
             | Hybrid Search /        | Fetch Patch /             | Isolated
             | Vector Embeddings      | Execution Logs            | Sandbox Run
             v                        v                           v
+-----------------------+  +---------------------+  +-------------------------------+
|  Elasticsearch Engine |  |  OpenRouter API     |  |   Docker Sandbox Container    |
|                       |  |                     |  |                               |
| - BM25 Lexical Index  |  | - Vector Embedding  |  | - Isolated Execution          |
| - Knowledge Cards     |  |   Generation        |  | - Captured Stdout/Stderr Logs |
| - Verification Runs   |  |                     |  | - Exit Code & Digest Matching |
+-----------------------+  +---------------------+  +-------------------------------+
```

## System Overview

Patch Made In Heaven is a persistent memory and search infrastructure designed for artificial intelligence coding agents. It provides a shared knowledge repository of execution-verified software patches exposed through standard Model Context Protocol tools.

The platform prevents unverified indexing by requiring server-owned verification runs. Patches are indexed only after executing inside an isolated sandbox environment and satisfying cryptographic digest, environment, and exit-code validation requirements.

## MCP Tools Specification

The server exposes six core tools:

| Tool Name | Class | Description |
| :--- | :--- | :--- |
| search_fix | Search | Performs hybrid search combining BM25 lexical retrieval and dense vector embeddings to locate verified patches for stack traces. |
| find_similar | Search | Conducts semantic vector similarity search across indexed knowledge records to identify related resolution patterns. |
| get_patch | Retrieval | Retrieves the complete unified git diff patch associated with a specified knowledge card identifier. |
| get_execution_log | Retrieval | Returns execution logs, exit codes, and timing metadata captured during fix verification. |
| verify_fix | Verification | Executes candidate fixes within isolated Docker sandboxes and records server-owned verification run results. |
| submit_fix | Submission | Validates candidate patches against active verification runs, matching digests, and environment configurations before writing to the index. |

## Response Envelope Contract

All tool responses adhere to the standard contract format:

| Field | Type | Purpose |
| :--- | :--- | :--- |
| contractVersion | String | Contract version identifier (hm.v1). |
| requestId | String | Unique identifier assigned to each execution request. |
| ok | Boolean | Success indicator distinguishing valid tool outcomes from infrastructure failures. |
| status | String | Execution outcome code indicating operational state. |
| warnings | Array | Non-fatal diagnostic messages generated during execution. |

Operational status codes returned under valid execution include HIT, MISS, DEGRADED, PASS, FAIL, TIMEOUT, STORED, REJECTED, and NOT_FOUND. System failure statuses include DEPENDENCY_UNAVAILABLE and INVALID_INPUT.

## Repository Layout

```
.
├── docs/                     # Technical architecture documentation
├── mcp/                      # TypeScript MCP server implementation
│   ├── src/
│   │   ├── config/           # Server and environment configuration
│   │   ├── domain/           # Data models and contract definitions
│   │   ├── services/         # Elasticsearch, embedding, and sandbox execution clients
│   │   ├── tools/            # MCP tool controllers
│   │   └── scripts/          # Index initialization and seed scripts
│   └── tests/                # Unit, integration, and quality test suites
├── .env.example              # Environment configuration template
└── package.json              # Workspace configuration and build orchestration
```
