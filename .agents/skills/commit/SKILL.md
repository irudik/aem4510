---
name: commit
description: Stage, commit, create PR, and merge to main. Use for the standard commit-PR-merge cycle.
workflow_stage: deployment
compatibility:
  - codex
  - claude-code
version: 1.0.0
tags:
  - git
  - commit
  - pr
  - merge
---

# Commit Wrapper

Use the shared protocol in `protocols/skills/commit.md`.

## Wrapper Workflow

1. Read `protocols/skills/commit.md`.
2. Treat that file as the single source of truth for the substantive workflow.
3. Apply the protocol to the provided argument(s).
4. Keep this file limited to Codex metadata and wrapper guidance.
