# Resume Session Context Protocol

Recover context after compression or starting a new session.

## Steps

### 1. Read Persistent Context

1. Read `MEMORY.md` for structured `[LEARN]` entries and project state.
2. Read `AGENTS.md` or `CLAUDE.md` for current project instructions.

### 2. Find the Most Recent Plan

1. List files in `quality_reports/plans/` sorted by date.
2. Read the most recent plan file.
3. Note its status.

### 3. Find the Most Recent Handoff

1. If `quality_reports/handoffs/` exists, list recent handoff files or
   directories sorted by date.
2. Read the most recent handoff note relevant to the active plan, if any.
3. If no handoff exists, say so explicitly.

### 4. Find the Most Recent Session Log

1. List files in `quality_reports/session_logs/` sorted by date.
2. Read the most recent session log.

### 5. Check Git State

```bash
git log --oneline -10
git diff --stat
git status
git branch --show-current
```

### 6. Present a Structured Summary

```text
## Session Recovery

**Current branch:** [branch name]
**Current task:** [from plan or session log]
**Plan status:** [status] -- [file path]
**Latest handoff:** [file path or "None"]
**Last completed step:** [from session log]
**Next step:** [inferred]

### Uncommitted changes
[output or "None"]

### Recent commits
[git log]

### Open questions / blockers
[from session log or "None noted"]
```

### 7. Confirm

Ask whether the recovered context is correct and whether to continue with the
inferred next step.

## Important

- This is a read-only workflow.
- If no plan, handoff, or session log exists, say so explicitly.
