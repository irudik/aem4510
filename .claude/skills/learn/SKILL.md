---
name: learn
description: Save a durable, project-specific lesson to MEMORY.md in a structured [LEARN] format.
disable-model-invocation: true
argument-hint: "<lesson, correction, or hard-won insight>"
allowed-tools: ["Read", "Write", "Edit", "Glob"]
---

# Learn Wrapper

Use the shared protocol in `protocols/skills/learn.md`.

## Wrapper Workflow

1. Resolve the lesson target from `$ARGUMENTS`.
2. Read `protocols/skills/learn.md`.
3. Append a structured `[LEARN:category]` entry to `MEMORY.md`.
4. Mirror the lesson in the current session log when relevant.
