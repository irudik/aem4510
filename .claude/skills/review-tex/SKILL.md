---
name: review-tex
description: Run the LaTeX review protocol on manuscripts and slides. Reviews prose around changed dynamic values, detects hardcoded numeric results, and auto-fixes unambiguous issues.
disable-model-invocation: true
argument-hint: "[filename or 'all']"
allowed-tools: ["Read", "Grep", "Glob", "Write", "Task"]
---

# Review LaTeX Wrapper

Use the shared protocol in `protocols/skills/review-tex.md`.

## Wrapper Workflow

1. Resolve the target scope from `$ARGUMENTS`.
2. Read `protocols/skills/review-tex.md`.
3. Launch one `tex-reviewer` agent for the full approved target scope and instruct it to follow `protocols/skills/review-tex.md`.
4. Present a concise summary of the findings.
