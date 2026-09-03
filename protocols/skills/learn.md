# Structured Learning Protocol

Capture a durable, project-specific lesson in `MEMORY.md` using a structured
entry format.

## When to Use

Use this protocol when you discover something non-obvious that is likely to
save time or prevent repeated mistakes later.

Good fits:

- a merge-key trap or reshape invariant that was easy to miss
- a solver failure mode with a specific diagnostic pattern
- a manuscript/build dependency gotcha
- a codebase-specific convention that was not obvious at first
- a correction from the user that should change future behavior

Do not save generic programming advice or things that are obvious from reading
the instructions.

## Steps

### 1. Decide Whether the Lesson Is Worth Saving

Save the lesson only if it is:

- specific to this repo or workflow
- non-obvious
- likely to recur
- actionable

### 2. Gather the Minimal Facts

Collect the exact lesson in terms of:

- trigger or symptom
- wrong assumption or failed approach
- correct rule
- scope
- evidence
- action to take next time

### 3. Append a Structured Entry to `MEMORY.md`

Use this format:

```markdown
[LEARN:category]
- Date: YYYY-MM-DD
- Trigger: [symptom, mistake, or question]
- Wrong: [incorrect assumption or behavior]
- Right: [correct rule or approach]
- Scope: [where this applies]
- Evidence: [file, command, output, or user correction]
- Action: [what to do next time]
```

Keep one lesson per block.

### 4. Mirror the Lesson in the Session Log When Relevant

If the current task has a session log, add the same `[LEARN:category]` block or
a short summary under `## Learnings & Corrections`.

## Important

- Prefer one precise lesson over several vague bullets.
- Do not overwrite prior learnings unless they are truly obsolete.
- If a lesson supersedes an older one, say so explicitly in the new entry.
