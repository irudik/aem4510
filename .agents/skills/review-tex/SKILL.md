---
name: review-tex
description: Run the LaTeX review protocol on manuscripts and slides. Reviews prose around changed dynamic values, detects hardcoded numeric results, and auto-fixes unambiguous issues.
workflow_stage: review
compatibility:
  - codex
  - claude-code
version: 1.1.0
tags:
  - latex
  - slides
  - hardcoded-numbers
  - dynamic-numbers
  - manuscript
---

# Review LaTeX Wrapper

Use the shared protocol in `protocols/skills/review-tex.md`.

## Wrapper Workflow

1. Read `protocols/skills/review-tex.md`.
2. Treat that file as the single source of truth for the substantive workflow.
3. Apply the protocol to the provided argument(s).
4. Keep this file limited to Codex metadata and wrapper guidance.
