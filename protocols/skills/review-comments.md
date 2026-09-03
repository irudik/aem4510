# Comment and Doc Cleanup Protocol

## Purpose

Clean up stale or misleading comments and docstrings, remove commented-out code,
and align documentation with code reality.

## When to Use

- You want a pass over comments or docstrings for correctness.
- You need to remove commented-out code blocks.
- You want to sync README or docs with the codebase.

## Workflow

1. Identify the scope. Default to the current working directory when the user
   does not provide a path.
2. Identify a style reference if the user provides one.
3. Explore files in scope and note:
   - Commented-out code blocks
   - Comments referencing non-existent features or files
   - Docstrings that conflict with behavior
   - Verbose comments that restate mechanics
   - Programmer jargon or software-style shorthand that would not be
     immediately clear to an economics PhD, including terms such as `harness`,
     `fixture`, `scaffold`, `canonical`, and `legacy`
   - Comments or docstrings that reference issue or ticket numbers, commit
     hashes, pull requests, or conversations with Claude or Codex
4. Check documentation files and verify referenced paths exist.
5. Present findings grouped by issue type with file paths and line numbers.
6. Get approval before editing.
7. Make the edits.
8. Verify that stale references are gone.

## Default Style

- Section headers:
  `# ============================================================================`
- File headers: clean and self-contained, with purpose, inputs, outputs, and
  assumptions when relevant
- Inline comments: short, explain domain logic rather than code mechanics
- Plain language: name the object or task directly. Prefer `test setup`,
  `example input`, `initial structure`, `main specification`, or `earlier
  method` to programmer jargon or software-style shorthand. Explain any precise
  software term in plain language in the same comment or docstring. The full
  banned-term and replacement table is in `protocols/writing.md`.
- Comments self-contained: strip references to issues, commit hashes, pull
  requests, or Claude/Codex conversations
- Do not prefix with "Economic intuition:"
- Use Unicode math notation where appropriate
- Delete rather than comment out unused code
- Docstrings: structured with `Arguments` and `Returns`
- Target roughly 15 to 20 percent comment density
