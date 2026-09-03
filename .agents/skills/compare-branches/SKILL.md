---
name: compare-branches
description: Compare script outputs between two git branches. Uses worktrees to run scripts on both branches and checksums to detect differences.
workflow_stage: verification
compatibility:
  - codex
  - claude-code
version: 1.0.0
tags:
  - branch-comparison
  - verification
  - checksums
---

# Compare Branches Wrapper

Use the shared protocol in `protocols/skills/compare-branches.md`.

## Wrapper Workflow

1. Read `protocols/skills/compare-branches.md`.
2. Treat that file as the single source of truth for the substantive workflow.
3. Apply the protocol to the provided argument(s).
4. Keep this file limited to Codex metadata and wrapper guidance.
