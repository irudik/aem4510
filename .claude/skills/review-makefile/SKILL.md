---
name: review-makefile
description: Run the Makefile review protocol. Checks conventions, dependency correctness, script coverage, and build system quality. Produces a report without editing files.
disable-model-invocation: true
argument-hint: "[path/to/Makefile or 'all']"
allowed-tools: ["Read", "Grep", "Glob", "Write", "Task"]
---

# Review Makefile Wrapper

Use the shared protocol in `protocols/skills/review-makefile.md`.

## Wrapper Workflow

1. Resolve the target scope from `$ARGUMENTS`.
2. Read `protocols/skills/review-makefile.md`.
3. Launch one `makefile-reviewer` agent for the full approved target scope and instruct it to follow `protocols/skills/review-makefile.md`.
4. Present a concise summary of the findings.
