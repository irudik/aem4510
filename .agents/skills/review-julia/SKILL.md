---
name: review-julia
description: Run the Julia code review protocol on Julia scripts. Checks code quality, type stability, performance, and professional standards. Produces a report without editing files.
workflow_stage: review
compatibility:
  - codex
  - claude-code
version: 1.0.0
tags:
  - julia
  - code-review
  - type-stability
  - performance
---

# Review Julia Wrapper

Use the shared protocol in `protocols/skills/review-julia.md`.

## Wrapper Workflow

1. Read `protocols/skills/review-julia.md`.
2. Treat that file as the single source of truth for the substantive workflow.
3. Apply the protocol to the provided argument(s).
4. Keep this file limited to Codex metadata and wrapper guidance.
