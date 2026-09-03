---
name: verify-outputs
description: Checksum script outputs before and after changes. Establishes baseline checksums, re-runs scripts, and compares to detect regressions. Uses CSV as the gold standard.
disable-model-invocation: true
argument-hint: "[script-path, dir, or 'baseline']"
allowed-tools: ["Bash", "Read", "Grep", "Glob", "Write"]
---

# Verify Outputs Wrapper

Use the shared protocol in `protocols/skills/verify-outputs.md`.

## Wrapper Workflow

1. Read `protocols/skills/verify-outputs.md`.
2. Treat that file as the single source of truth for the substantive workflow.
3. Apply the protocol to `$ARGUMENTS`.
4. Keep Claude-specific behavior limited to this wrapper's frontmatter and tool access.
