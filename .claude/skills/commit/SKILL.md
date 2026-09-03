---
name: commit
description: Stage, commit, create PR, and merge to main. Use for the standard commit-PR-merge cycle.
disable-model-invocation: true
argument-hint: "[optional: commit message]"
allowed-tools: ["Bash", "Read", "Glob"]
---

# Commit Wrapper

Use the shared protocol in `protocols/skills/commit.md`.

## Wrapper Workflow

1. Read `protocols/skills/commit.md`.
2. Treat that file as the single source of truth for the substantive workflow.
3. Apply the protocol to `$ARGUMENTS`.
4. Keep Claude-specific behavior limited to this wrapper's frontmatter and tool access.
