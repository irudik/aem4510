---
name: setup-makefile
description: Generate a Makefile for a code directory by scanning scripts for output paths and building dependency rules.
workflow_stage: implementation
compatibility:
  - codex
  - claude-code
version: 1.0.0
tags:
  - makefile
  - build-system
  - code-generation
---

# Setup Makefile Wrapper

Use the shared protocol in `protocols/skills/setup-makefile.md`.

## Wrapper Workflow

1. Read `protocols/skills/setup-makefile.md`.
2. Treat that file as the single source of truth for the substantive workflow.
3. Apply the protocol to the provided argument(s).
4. Keep this file limited to Codex metadata and wrapper guidance.
