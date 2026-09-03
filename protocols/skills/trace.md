# Trace Protocol

Explain why an observed result happened by separating observation, competing
hypotheses, evidence, uncertainty, and the best next probe.

## When to Use

Use this protocol when the task is primarily diagnostic rather than
implementation, especially when the cause is ambiguous.

Good fits:

- a regression estimate changed unexpectedly
- a merge or reshape dropped rows
- a Make target rebuilt or stayed stale unexpectedly
- a solver started failing or producing implausible values
- manuscript numbers disagree with tables or code outputs
- an output changed but the causal path is not obvious

## Steps

### 1. Restate the Observation

State exactly what was observed before offering any explanation.

Include the most concrete available anchors:

- file paths
- commands run
- outputs or error messages
- dates, branches, or target names
- expected result versus actual result

### 2. Gather Direct Evidence

Read the smallest set of files and artifacts that bear directly on the
observation.

Prefer primary evidence:

- source files
- Makefiles
- logs
- generated outputs
- test results
- manuscript/table artifacts
- recent diffs or commits when timing matters

Do not guess at facts the repo can reveal directly.

### 3. Generate Competing Hypotheses

List at least two plausible explanations unless the cause is already directly
shown by the evidence.

Good hypothesis buckets:

- code-path or logic change
- data or merge-key issue
- build graph / dependency issue
- measurement or output-interpretation issue
- numerical instability or input-quality issue

### 4. Test Each Hypothesis

For each hypothesis, record:

- evidence for
- evidence against
- what prediction it makes
- what key fact is still missing

Be explicit about evidence strength. Direct artifacts outrank resemblance,
timing, or intuition.

### 5. Rank the Explanations

Produce a ranked list from most to least plausible.

Down-rank explanations that:

- are contradicted by direct evidence
- require extra unverified assumptions
- fail to explain the observation cleanly
- make predictions that are not observed

### 6. Identify the Critical Unknown

Name the single missing fact that most limits confidence in the current ranking.

### 7. Recommend the Best Next Probe

Recommend one discriminating next step that would collapse the most uncertainty
with the least wasted work.

If the user asked for a diagnosis only, stop here.

If the user also asked for a fix, state whether the trace is strong enough to
move into implementation or whether the recommended probe should happen first.

## Output Format

```markdown
## Trace Report

### Observation
[What was observed, without interpretation]

### Ranked Hypotheses
| Rank | Hypothesis | Confidence | Evidence Strength | Why it remains plausible |
|------|------------|------------|-------------------|--------------------------|
| 1 | ... | High / Medium / Low | Strong / Moderate / Weak | ... |

### Evidence For
- Hypothesis 1: ...
- Hypothesis 2: ...

### Evidence Against / Gaps
- Hypothesis 1: ...
- Hypothesis 2: ...

### Current Best Explanation
[Best current explanation, explicitly provisional if needed]

### Critical Unknown
[Single missing fact]

### Best Next Probe
[Single next probe]
```

## Important

- Do not jump straight to implementation.
- Distinguish facts from inference.
- Cite concrete file paths or artifacts whenever possible.
- Prefer one strong next probe over a long list of vague suggestions.
- For numerical failures, use this alongside the solver debugging checklist in
  `AGENTS.md`.
