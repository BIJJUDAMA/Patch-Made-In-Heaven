import { KnowledgeCard } from './elastic.client.js';

export const SEED_KNOWLEDGE_CARDS: KnowledgeCard[] = [
  {
    id: 'fix_pydantic_v2_import',
    problem: "ImportError: cannot import name 'BaseSettings' from 'pydantic'",
    errorType: 'ImportError',
    stacktrace: "File 'main.py', line 2, in <module>\n  from pydantic import BaseSettings\nImportError: cannot import name 'BaseSettings' from 'pydantic'",
    environment: {
      language: 'python',
      version: '3.11.4',
      framework: 'fastapi',
      packageVersions: { pydantic: '2.4.2', fastapi: '0.104.0' },
    },
    patch: `--- a/main.py\n+++ b/main.py\n@@ -2 +2 @@\n-from pydantic import BaseSettings\n+from pydantic_settings import BaseSettings`,
    verification: {
      status: 'PASS',
      score: 0.99,
      lastVerified: '2026-07-25T14:00:00Z',
      sandbox: 'docker',
    },
    metrics: { reuseCount: 245 },
  },
  {
    id: 'fix_typing_typealias',
    problem: "ImportError: cannot import name 'TypeAlias' from 'typing'",
    errorType: 'ImportError',
    stacktrace: "File 'app.py', line 1, in <module>\n  from typing import TypeAlias\nImportError: cannot import name 'TypeAlias' from 'typing'",
    environment: {
      language: 'python',
      version: '3.9.18',
      framework: 'fastapi',
    },
    patch: `--- a/app.py\n+++ b/app.py\n@@ -1 +1 @@\n-from typing import TypeAlias\n+from typing_extensions import TypeAlias`,
    verification: {
      status: 'PASS',
      score: 0.98,
      lastVerified: '2026-07-25T14:10:00Z',
      sandbox: 'docker',
    },
    metrics: { reuseCount: 189 },
  },
  {
    id: 'fix_esm_require',
    problem: 'ReferenceError: require is not defined in ES module scope',
    errorType: 'ReferenceError',
    stacktrace: 'ReferenceError: require is not defined in ES module scope, you can use import instead\n    at file:///app/index.js:3:1',
    environment: {
      language: 'javascript',
      version: '20.9.0',
      framework: 'express',
    },
    patch: `--- a/index.js\n+++ b/index.js\n@@ -1 +1,2 @@\n-const express = require('express');\n+import express from 'express';`,
    verification: {
      status: 'PASS',
      score: 0.97,
      lastVerified: '2026-07-25T13:30:00Z',
      sandbox: 'docker',
    },
    metrics: { reuseCount: 312 },
  },
  {
    id: 'fix_docker_permission_denied',
    problem: 'Permission denied: unable to bind port 80 in container',
    errorType: 'DockerError',
    stacktrace: 'Error response from daemon: driver failed programming external connectivity on endpoint web (port 80): Permission denied',
    environment: {
      language: 'docker',
      version: '24.0.5',
    },
    patch: `--- a/docker-compose.yml\n+++ b/docker-compose.yml\n@@ -5 +5 @@\n-      - "80:80"\n+      - "8080:80"`,
    verification: {
      status: 'PASS',
      score: 0.95,
      lastVerified: '2026-07-25T12:00:00Z',
      sandbox: 'docker',
    },
    metrics: { reuseCount: 142 },
  },
];
