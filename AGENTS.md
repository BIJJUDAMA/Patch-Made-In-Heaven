
# AGENTS.md

# HackOverflow Agent Entry Point

Welcome to the **HackOverflow** repository.

If you are an AI agent or developer resuming work, read this document completely before making any changes.

---

# Repository Documentation Map

Read documents in this order.

| Order | File                  | Purpose                                                                  |
| ----- | --------------------- | ------------------------------------------------------------------------ |
| 1     | AGENTS.md             | Agent workflow, implementation process, approval rules, handoff protocol |
| 2     | PROJECT.md            | Product vision, requirements, features                                   |
| 3     | DECISIONS.md          | Accepted architectural and product decisions                             |
| 4     | PHASES.md             | Development roadmap and phase definitions                                |
| 5     | HANDOFF.md            | Current repository state                                                 |
| 6     | Implementation_Plans/ | Phase execution plans                                                    |

Do not skip documents.

# Project Workflow

The project follows a strict specification-first workflow.

Agents do not directly begin implementation.

Agents must first create an implementation plan.

---

# Development Lifecycle

```text
Specification -> Implementation Plan -> Human Approval Gate -> Implementation -> Handoff

```

Implementation begins only after approval.

---

# Source of Truth

## PROJECT.md

Defines:

* Product goals
* Features
* System requirements
* Tech stack and target runtime

Never modify unless explicitly instructed.

---

## PHASES.md

Defines:

* Development order
* Phase goals
* Deliverables
* Completion criteria

Treat as the roadmap.

Never implement features outside the current phase.

---

# Implementation Plans

Implementation plans are mandatory.

A phase cannot begin until its implementation plan exists.

Location:

```text
Implementation_Plans/

```

Example:

```text
Implementation_Plans/
├── PHASE_01_CORE_SEARCH.md
├── PHASE_02_NITROSTACK_MCP.md
├── PHASE_03_SANDBOX_PIPELINE.md
├── PHASE_04_VERIFICATION.md
└── PHASE_05_DEPLOYMENT.md

```

---

# Creating an Implementation Plan

When work begins on a phase:

1. Read PROJECT.md
2. Read PHASES.md
3. Read HANDOFF.md
4. Generate implementation plan
5. Stop

Do not write code.

Do not modify files.

Do not create source files.

Wait for human approval.

---

# Human Approval Gate

After generating an implementation plan:

STOP.

Wait for explicit approval.

Examples:

```text
Approved

Proceed

Start implementation

Begin Phase 1

```

Only after approval may implementation begin.

---

# Implementation Plan Structure

Every implementation plan must contain:

## Header

```text
# Phase X — Implementation Plan

Source: PHASES.md
Status: Not Started
Created: YYYY-MM-DD

```

---

## Objective

What capability exists after completion.

---

## Preconditions

Requirements that must already exist.

---

## Files to Create

Exact paths.

---

## Files to Modify

Exact paths.

---

## Implementation Steps

Ordered steps.

Each step must contain:

```text
Step Number
File
Action
Verification

```

---

## Risks

Known risks.

---

## Definition of Done

Objective checklist.

---

## Deviation Log

Record deviations from original phase specification.

---

# Implementation Rules

## Rule 1

Never implement multiple phases simultaneously.

---

## Rule 2

Do not create future-phase infrastructure unless explicitly required.

---

## Rule 3

Complete the current phase before starting the next.

---

## Rule 4

Update implementation plans whenever reality diverges from plan.

---

## Rule 5

Keep implementation plans synchronized with repository state.

---

---

# Mandatory Pre-Implementation Checklist

Before coding:

* Read AGENTS.md
* Read PROJECT.md
* Read DECISIONS.md
* Read PHASES.md
* Read HANDOFF.md
* Read active implementation plan
* Verify human approval exists

If any item is missing:

STOP.

---

# Decision Management

Architectural and product decisions are maintained in:

```text
DECISIONS.md

```

Before proposing any architectural changes:

1. Read DECISIONS.md
2. Verify the topic has not already been decided
3. If a decision exists, follow it
4. If a change is required:

* Record rationale in HANDOFF.md
* Request human approval
* Do not override accepted decisions unilaterally

DECISIONS.md is considered a source-of-truth document.

Accepted decisions must not be re-litigated during implementation without explicit human approval.

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

All submitted fixes must pass sandbox execution (Modal/Docker) before being indexed into the knowledge base.

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

Previous Kubernetes manifests (`kind/`, `argocd/`, `helm-charts/`) and decentralized agent frameworks (e.g., Fetch.ai) are superseded.

Reasoning:

Simplifies the platform architecture and eliminates operational complexity during hackathon deployment.

Implications:

Do not reintroduce Kubernetes CRDs or proprietary agent protocols.

---

# Decision Lifecycle

Every decision in DECISIONS.md must contain:

* Unique ID
* Status
* Topic
* Decision
* Reasoning
* Implications

Allowed statuses:

* Proposed
* Accepted
* Deprecated
* Rejected

Agents may create Proposed decisions.

Only humans may mark decisions Accepted.

# HANDOFF.md Protocol

HANDOFF.md must be maintained continuously.

Purpose:

Allow another agent to continue immediately.

Update whenever:

* Code changes
* Files created
* Files removed
* Architecture changes
* Dependencies added
* Bugs fixed
* New risks discovered
* Work is paused

---

# Required HANDOFF Structure

## Session Summary

High-level completed work.

---

## Current Project State

Actual repository state.

---

## Active Objective

Current development target.

---

## Changes Made

Organized by file.

---

## Design Decisions

Important architectural decisions.

---

## Dependencies

Added or removed packages.

---

## Known Issues

Open problems.

---

## TODO

Ordered next steps.

---

## Testing Status

What has and has not been tested.

---

## Files Touched

Modified files.

Created files.

Deleted files.

---

## Suggested Starting Point

Where the next agent should begin.

---

# Git Commit Standards

Use Conventional Commits.

Format:

```text
type: description

```

Allowed:

```text
feat
fix
refactor
docs
test
perf
chore

```

Examples:

```text
feat: add search_fix nitrostack tool provider

fix: resolve elasticsearch dense vector mapping error

refactor: extract sandbox runner client service

docs: update phase 1 implementation plan

```

Rules:

* lowercase only
* maximum 72 characters
* one logical change per commit
* NEVER COMMIT
* AGENTS.md
* HANDOFF.md
* PHASES.md
* PROJECT.md

---

# Documentation Commit Rules

Never commit:

```text
HANDOFF.md

Implementation_Plans/

```

These are working documents.

They exist for continuity.

They are not part of release history.

---

# Operating Principle

The repository is specification-driven.

Agents:

1. Read specifications.
2. Produce implementation plan.
3. Wait for approval.
4. Implement.
5. Update HANDOFF.
6. Stop at phase completion.

Never skip the approval gate.
