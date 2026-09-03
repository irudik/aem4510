---
name: review-pr
description: Review and address unresolved PR comments. Implements fixes, commits modularly, replies with commit hashes, and resolves threads.
workflow_stage: deployment
compatibility:
  - codex
  - claude-code
version: 1.0.0
tags:
  - git
  - pull-request
  - code-review
  - github
---

# Review PR Wrapper

Use the shared protocol in `protocols/skills/review-pr.md`.

## Wrapper Workflow

1. Read `protocols/skills/review-pr.md`.
2. Treat that file as the single source of truth for the substantive workflow.
3. Apply the protocol to the provided argument(s).
4. Keep this file limited to Codex metadata and wrapper guidance.
