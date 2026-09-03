---
name: setup-makefile
description: Generate a Makefile for a code directory by scanning scripts for output paths and building dependency rules.
disable-model-invocation: true
argument-hint: "[directory]"
allowed-tools: ["Bash", "Read", "Grep", "Glob", "Write"]
---

# Setup Makefile Wrapper

Use the shared protocol in `protocols/skills/setup-makefile.md`.

## Wrapper Workflow

1. Read `protocols/skills/setup-makefile.md`.
2. Treat that file as the single source of truth for the substantive workflow.
3. Apply the protocol to `$ARGUMENTS`.
4. Keep Claude-specific behavior limited to this wrapper's frontmatter and tool access.
