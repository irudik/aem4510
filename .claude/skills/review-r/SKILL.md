---
name: review-r
description: Run the R code review protocol on R scripts. Checks code quality, reproducibility, domain correctness, and professional standards. Produces a report without editing files.
disable-model-invocation: true
argument-hint: "[filename or 'all']"
allowed-tools: ["Read", "Grep", "Glob", "Write", "Task"]
---

# Review R Wrapper

Use the shared protocol in `protocols/skills/review-r.md`.

## Wrapper Workflow

1. Resolve the target scope from `$ARGUMENTS`.
2. Read `protocols/skills/review-r.md`.
3. Launch one `r-reviewer` agent for the full approved target scope and instruct it to follow `protocols/skills/review-r.md`.
4. Present a concise summary of the findings.
