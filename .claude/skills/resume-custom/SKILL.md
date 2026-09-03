---
name: resume-custom
description: Recover context after compression or a new session. Reads MEMORY.md, recent plans, session logs, and git state to reconstruct working context.
disable-model-invocation: true
argument-hint: ""
allowed-tools: ["Bash", "Read", "Grep", "Glob"]
---

# Resume Wrapper

Use the shared protocol in `protocols/skills/resume-custom.md`.

## Wrapper Workflow

1. Read `protocols/skills/resume-custom.md`.
2. Treat that file as the single source of truth for the substantive workflow.
3. Apply the protocol.
4. Keep Claude-specific behavior limited to this wrapper's frontmatter and tool access.
