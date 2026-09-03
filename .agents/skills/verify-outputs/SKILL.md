---
name: verify-outputs
description: Checksum script outputs before and after changes. Establishes baseline checksums, re-runs scripts, and compares to detect regressions. Uses CSV as the gold standard.
workflow_stage: verification
compatibility:
  - codex
  - claude-code
version: 1.0.0
tags:
  - verification
  - checksums
  - regression-testing
---

# Verify Outputs Wrapper

Use the shared protocol in `protocols/skills/verify-outputs.md`.

## Wrapper Workflow

1. Read `protocols/skills/verify-outputs.md`.
2. Treat that file as the single source of truth for the substantive workflow.
3. Apply the protocol to the provided argument(s).
4. Keep this file limited to Codex metadata and wrapper guidance.
