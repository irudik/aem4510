---
name: review-matlab
description: Run the MATLAB code review protocol on MATLAB scripts. Checks code quality, solver configuration, derivative correctness, and optimization patterns. Produces a report without editing files.
disable-model-invocation: true
argument-hint: "[filename or 'all']"
allowed-tools: ["Read", "Grep", "Glob", "Write", "Task"]
---

# Review MATLAB Wrapper

Use the shared protocol in `protocols/skills/review-matlab.md`.

## Wrapper Workflow

1. Resolve the target scope from `$ARGUMENTS`.
2. Read `protocols/skills/review-matlab.md`.
3. Launch one `matlab-reviewer` agent for the full approved target scope and instruct it to follow `protocols/skills/review-matlab.md`.
4. Present a concise summary of the findings.
