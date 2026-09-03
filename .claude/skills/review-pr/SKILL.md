---
name: review-pr
description: Review and address unresolved PR comments. Implements fixes, commits modularly, replies with commit hashes, and resolves threads.
disable-model-invocation: true
argument-hint: "<PR number>"
allowed-tools: ["Bash", "Read", "Glob", "Grep", "Edit", "Write", "Task"]
---

# Review PR Wrapper

Use the shared protocol in `protocols/skills/review-pr.md`.

## Wrapper Workflow

1. Read `protocols/skills/review-pr.md`.
2. Treat that file as the single source of truth for the substantive workflow.
3. Apply the protocol to `$ARGUMENTS`.
4. Keep Claude-specific behavior limited to this wrapper's frontmatter and tool access.
