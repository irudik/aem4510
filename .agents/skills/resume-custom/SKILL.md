---
name: resume-custom
description: Recover context after compression or a new session. Reads MEMORY.md, recent plans, session logs, and git state to reconstruct working context.
workflow_stage: planning
compatibility:
  - codex
  - claude-code
version: 1.0.0
tags:
  - context-recovery
  - session-management
---

# Resume Wrapper

Use the shared protocol in `protocols/skills/resume-custom.md`.

## Wrapper Workflow

1. Read `protocols/skills/resume-custom.md`.
2. Treat that file as the single source of truth for the substantive workflow.
3. Apply the protocol.
4. Keep this file limited to Codex metadata and wrapper guidance.
