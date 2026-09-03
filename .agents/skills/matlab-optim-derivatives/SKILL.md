---
name: matlab-optim-derivatives
description: Audit MATLAB optimization derivatives and KNITRO integration with finite-difference validation
workflow_stage: solver-debug
compatibility:
  - codex
  - claude-code
  - cursor
  - gemini-cli
version: 1.0.0
tags:
  - matlab
  - optimization
  - knitro
  - gradient
  - hessian
---

# MATLAB Derivative Audit Wrapper

Use the shared protocol in `protocols/skills/matlab-optim-derivatives.md`.

## Wrapper Workflow

1. Read `protocols/skills/matlab-optim-derivatives.md`.
2. Treat that file as the single source of truth for the substantive workflow.
3. Apply the protocol to the provided argument(s).
4. Keep this file limited to Codex metadata and wrapper guidance.
