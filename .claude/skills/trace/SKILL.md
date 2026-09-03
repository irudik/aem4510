---
name: trace
description: Trace an ambiguous result or failure back to its most likely cause using competing hypotheses and evidence. Produces a diagnostic report rather than a code change by default.
disable-model-invocation: true
argument-hint: "<observation, symptom, or why-question>"
allowed-tools: ["Read", "Grep", "Glob", "Bash", "Task"]
---

# Trace Wrapper

Use the shared protocol in `protocols/skills/trace.md`.

## Wrapper Workflow

1. Resolve the tracing target from `$ARGUMENTS`.
2. Read `protocols/skills/trace.md`.
3. Launch the `tracer` agent when an independent tracing pass is useful.
4. Present a concise trace report with ranked hypotheses and the best next probe.
