---
name: review-stata
description: Run the Stata code review protocol on Stata scripts. Checks code quality, reproducibility, data-state safety, and professional standards. Produces a report without editing files.
workflow_stage: review
compatibility:
  - codex
  - claude-code
version: 1.0.0
tags:
  - stata
  - code-review
  - reproducibility
  - data-management
---

# Review Stata Wrapper

Use the shared protocol in `protocols/skills/review-stata.md`.

## Wrapper Workflow

1. Read `protocols/skills/review-stata.md`.
2. Treat that file as the single source of truth for the substantive workflow.
3. Apply the protocol to the provided argument(s).
4. Keep this file limited to Codex metadata and wrapper guidance.
