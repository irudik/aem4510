---
name: review-makefile
description: Run the Makefile review protocol. Checks conventions, dependency correctness, script coverage, and build system quality. Produces a report without editing files.
workflow_stage: review
compatibility:
  - codex
  - claude-code
version: 1.0.0
tags:
  - makefile
  - build-system
  - code-review
---

# Review Makefile Wrapper

Use the shared protocol in `protocols/skills/review-makefile.md`.

## Wrapper Workflow

1. Read `protocols/skills/review-makefile.md`.
2. Treat that file as the single source of truth for the substantive workflow.
3. Apply the protocol to the provided argument(s).
4. Keep this file limited to Codex metadata and wrapper guidance.
