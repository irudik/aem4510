---
name: proofread
description: Run expert proofreading on academic documents. Checks grammar, typos, overflow risks, citation consistency, and academic quality for LaTeX, Quarto, and directly provided text-based files. Produces a report without editing files.
workflow_stage: review
compatibility:
  - codex
  - claude-code
version: 1.0.0
tags:
  - proofreading
  - grammar
  - academic-writing
  - citations
---

# Proofread Wrapper

Use the shared protocol in `protocols/skills/proofread.md`.

## Wrapper Workflow

1. Read `protocols/skills/proofread.md`.
2. Treat that file as the single source of truth for the substantive workflow.
3. Apply the protocol to the provided argument(s).
4. Keep this file limited to Codex metadata and wrapper guidance.
