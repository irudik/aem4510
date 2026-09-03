---
name: review-comments
description: Review and clean up comments, docstrings, and documentation across specified files or directories
workflow_stage: review
compatibility:
  - codex
  - claude-code
  - cursor
  - gemini-cli
version: 1.0.0
tags:
  - comments
  - documentation
  - cleanup
  - review
---

# Review Comments Wrapper

Use the shared protocol in `protocols/skills/review-comments.md`.

## Wrapper Workflow

1. Read `protocols/skills/review-comments.md`.
2. Treat that file as the single source of truth for the substantive workflow.
3. Apply the protocol to the provided argument(s).
4. Keep this file limited to Codex metadata and wrapper guidance.
