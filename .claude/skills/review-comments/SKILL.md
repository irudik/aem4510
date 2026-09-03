---
name: review-comments
description: Review and clean up comments, docstrings, and documentation across specified files or directories
disable-model-invocation: true
argument-hint: "[file or directory path]"
allowed-tools: ["Read", "Grep", "Glob", "Write", "Edit", "Bash"]
workflow_stage: review
compatibility:
  - codex
  - claude-code
  - cursor
  - gemini-cli
version: 1.0.0
tags:
  - comments
  - documentation
  - cleanup
  - review
---

# Review Comments Wrapper

Use the shared protocol in `protocols/skills/review-comments.md`.

## Wrapper Workflow

1. Read `protocols/skills/review-comments.md`.
2. Treat that file as the single source of truth for the substantive workflow.
3. Apply the protocol to `$ARGUMENTS`.
4. Keep Claude-specific behavior limited to this wrapper's frontmatter and tool access.
