---
name: review-julia
description: Run the Julia code review protocol on Julia scripts. Checks code quality, type stability, performance, and professional standards. Produces a report without editing files.
disable-model-invocation: true
argument-hint: "[filename or 'all']"
allowed-tools: ["Read", "Grep", "Glob", "Write", "Task"]
---

# Review Julia Wrapper

Use the shared protocol in `protocols/skills/review-julia.md`.

## Wrapper Workflow

1. Resolve the target scope from `$ARGUMENTS`.
2. Read `protocols/skills/review-julia.md`.
3. Launch one `julia-reviewer` agent for the full approved target scope and instruct it to follow `protocols/skills/review-julia.md`.
4. Present a concise summary of the findings.
