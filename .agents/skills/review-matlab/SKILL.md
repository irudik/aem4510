---
name: review-matlab
description: Run the MATLAB code review protocol on MATLAB scripts. Checks code quality, solver configuration, derivative correctness, and optimization patterns. Produces a report without editing files.
workflow_stage: review
compatibility:
  - codex
  - claude-code
version: 1.0.0
tags:
  - matlab
  - code-review
  - optimization
---

# Review MATLAB Wrapper

Use the shared protocol in `protocols/skills/review-matlab.md`.

## Wrapper Workflow

1. Read `protocols/skills/review-matlab.md`.
2. Treat that file as the single source of truth for the substantive workflow.
3. Apply the protocol to the provided argument(s).
4. Keep this file limited to Codex metadata and wrapper guidance.
