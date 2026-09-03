---
name: refactor
description: Verify-refactor-verify loop for safe code style changes. Records baseline checksums, applies style-only transformations, then verifies identical output.
disable-model-invocation: true
argument-hint: "[file or directory]"
allowed-tools: ["Bash", "Read", "Grep", "Glob", "Write", "Edit", "Task"]
---

# Refactor Wrapper

Use the shared protocol in `protocols/skills/refactor.md`.

## Wrapper Workflow

1. Read `protocols/skills/refactor.md`.
2. Treat that file as the single source of truth for the substantive workflow.
3. Apply the protocol to `$ARGUMENTS`.
4. Keep Claude-specific behavior limited to this wrapper's frontmatter and tool access.
