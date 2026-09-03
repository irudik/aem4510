---
name: refactor
description: Verify-refactor-verify loop for safe code style changes. Records baseline checksums, applies style-only transformations, then verifies identical output.
workflow_stage: implementation
compatibility:
  - codex
  - claude-code
version: 1.0.0
tags:
  - refactoring
  - verification
  - code-style
---

# Refactor Wrapper

Use the shared protocol in `protocols/skills/refactor.md`.

## Wrapper Workflow

1. Read `protocols/skills/refactor.md`.
2. Treat that file as the single source of truth for the substantive workflow.
3. Apply the protocol to the provided argument(s).
4. Keep this file limited to Codex metadata and wrapper guidance.
