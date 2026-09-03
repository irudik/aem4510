---
name: trace
description: Trace an ambiguous result or failure back to its most likely cause using competing hypotheses and evidence. Produces a diagnostic report rather than a code change by default.
workflow_stage: diagnosis
compatibility:
  - codex
  - claude-code
version: 1.0.0
tags:
  - diagnosis
  - debugging
  - causality
  - research
---

# Trace Wrapper

Use the shared protocol in `protocols/skills/trace.md`.

## Wrapper Workflow

1. Read `protocols/skills/trace.md`.
2. Treat that file as the single source of truth for the substantive workflow.
3. Apply the protocol to the provided argument(s).
4. Keep this file limited to Codex metadata and wrapper guidance.
