---
name: compare-branches
description: Compare script outputs between two git branches. Uses worktrees to run scripts on both branches and checksums to detect differences.
disable-model-invocation: true
argument-hint: "[base-branch] [target-branch] [dir-or-script]"
allowed-tools: ["Bash", "Read", "Grep", "Glob", "Write"]
---

# Compare Branches Wrapper

Use the shared protocol in `protocols/skills/compare-branches.md`.

## Wrapper Workflow

1. Read `protocols/skills/compare-branches.md`.
2. Treat that file as the single source of truth for the substantive workflow.
3. Apply the protocol to `$ARGUMENTS`.
4. Keep Claude-specific behavior limited to this wrapper's frontmatter and tool access.
