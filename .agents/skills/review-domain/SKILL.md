---
name: review-domain
description: Run the substantive domain review on manuscripts, slides, or lecture materials. Checks identification, derivations, citations, code-theory alignment, and logical consistency. Produces a report without editing files.
workflow_stage: review
compatibility:
  - codex
  - claude-code
version: 1.0.0
tags:
  - empirical-micro
  - identification
  - citations
  - domain-review
---

# Review Domain Wrapper

Use the shared protocol in `protocols/skills/review-domain.md`.

## Wrapper Workflow

1. Read `protocols/skills/review-domain.md`.
2. Treat that file as the single source of truth for the substantive workflow.
3. Apply the protocol to the provided argument(s).
4. Keep this file limited to Codex metadata and wrapper guidance.
