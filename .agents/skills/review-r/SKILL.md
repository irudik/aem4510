---
name: review-r
description: Run the R code review protocol on R scripts. Checks code quality, reproducibility, domain correctness, and professional standards. Produces a report without editing files.
workflow_stage: review
compatibility:
  - codex
  - claude-code
version: 1.0.0
tags:
  - R
  - code-review
  - reproducibility
  - quality
---

# Review R Wrapper

Use the shared protocol in `protocols/skills/review-r.md`.

## Wrapper Workflow

1. Read `protocols/skills/review-r.md`.
2. Treat that file as the single source of truth for the substantive workflow.
3. Apply the protocol to the provided argument(s).
4. Keep this file limited to Codex metadata and wrapper guidance.
