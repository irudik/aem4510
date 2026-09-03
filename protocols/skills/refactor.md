# Refactor Code Protocol

Safe refactoring with automatic output verification.

## Steps

### 1. Establish a Baseline

Run `/verify-outputs [target] baseline` to record output checksums before any
changes.

### 2. Read the Applicable Conventions

Read `protocols/conventions/shared.md` and the relevant language convention:

- R: `protocols/conventions/r.md`
- Julia: `protocols/conventions/julia.md`
- Stata: `protocols/conventions/stata.md`
- MATLAB: `protocols/conventions/matlab.md`

Also read the Refactoring Protocol section of `AGENTS.md`.

### 3. Apply Only Approved Transformations

- Comment style
- Whitespace and indentation
- Variable grouping and section organization
- Missing documentation
- Language-specific style conventions

Do not change logic, tolerances, function signatures, or dead-code behavior.

### 4. Verify Outputs

Run `/verify-outputs [target]` to compare against the baseline checksums.

### 5. Present Results

- If outputs match, present the diff and report that the refactoring preserved
  outputs.
- If outputs mismatch, revert all changes and report what broke.

### 6. Review

Run the appropriate review skill after the refactor.

## Important

- The only acceptable outcome is identical output.
- Dead code may be flagged but not removed.
- Revert everything on any output mismatch.
