# Shared Code Pipeline Conventions

These conventions apply to all scripts in `code/` and its subdirectories.

## Path Style

- Invoke builds from the repository root with `make -C code/[task_group]`.
  Because `make -C` changes Make's working directory, paths in task-group Makefiles
  and the scripts they run are relative to the task-group directory.
- In the standard `code/[task_group]/` layout, use `../../output` to reach the
  repository-root output directory. Do not add a `PROJECT_ROOT` variable merely
  to implement this standard two-level layout.
- Use forward slashes in any literal filepath on every platform, including
  Windows (for example `../../output/tables/results.csv`)
- Never write Windows-style backslashes in path literals
- Path helpers such as `file.path()`, `joinpath()`, and `fullfile()` remain
  preferred for programmatic path construction

## Shared Research Code Style

These standards apply across R, Julia, Stata, MATLAB, and Makefiles unless a
language-specific convention gives a narrower rule.

- Prefer clarity over cleverness. Slightly longer code is better than a dense
  expression that hides data construction, identification logic, or output
  provenance.
- Reproducibility is the deliverable. Code must run from the Makefile-driven
  pipeline on a clean checkout without hidden state, manual steps, absolute
  paths, or hand-edited outputs.
- Use one operation per line. Do not combine loading, filtering, mutating,
  summarizing, estimating, and exporting into compact one-liners.
- For long calls or commands, put one substantive argument or option per line
  when it improves scanability and version-control diffs.
- Use names that read like prose. Prefer descriptive `snake_case` names for
  files, data objects, variables, locals, and functions unless the applicable
  language convention explicitly differs, such as Julia `CamelCase` types.
- Every analysis file should start with a clean header block that states the
  title or purpose, inputs, outputs, and any key assumptions or runtime notes.
  Do not include user-specific absolute paths in headers.
- Use section headers to mark workflow stages such as setup, data construction,
  estimation, diagnostics, and export.
- Comments should explain economic intuition, data logic, identifying
  assumptions, and non-obvious transformations rather than restating syntax.
- Use plain language or terminology standard in modern economics. Avoid
  programmer jargon and software-style shorthand. A term fails this rule if an
  economics PhD would not understand it immediately from ordinary research
  practice. Examples to avoid include `harness`, `fixture`, `scaffold`,
  `canonical`, `canon`, `contract`, `surface` (as a verb: a check finds
  or reveals a problem, it does not surface one; this applies in
  comments, docstrings, and identifiers alike, while a mathematical or
  physical surface such as a criterion surface or surface temperature
  is standard usage), `gate`, and `legacy`. Write `test setup`,
  `example input`, `initial structure`, `main specification`, `required
  behavior`, or `earlier method` instead. Name the
  object or task directly. If a precise software term must appear, explain it
  in plain language in the same comment or docstring. The full banned-term
  and replacement table is in `protocols/writing.md`.
- Comments and docstrings must be self-contained. Never reference issue or
  ticket numbers, commit hashes, pull requests, or conversations with Claude or
  Codex. The reader is a coauthor, referee, or future self without access to the
  repository history or an AI transcript.
