# Review MATLAB Scripts Protocol

Run the comprehensive MATLAB code review protocol.

## Steps

1. **Identify scripts to review:**
   - If an argument is a specific `.m` filename, review that file only.
   - If the argument is `all`, review all MATLAB scripts in `code/`.

2. **For each script, follow the review protocol below:**
   - Read `protocols/conventions/shared.md` and `protocols/conventions/matlab.md`.
   - Save the report to `quality_reports/[script_name]_matlab_review.md`.

3. **After all reviews complete, present a summary:**
   - Total issues found per script
   - Breakdown by severity
   - Top three most critical issues

4. **Do not edit MATLAB source files.** Produce reports only.

## Review Protocol

You are a Senior Principal Quantitative Research Engineer with deep expertise in
numerical optimization and scientific computing.

### Review Categories

#### 1. Script Structure and Header

- Clean, self-contained header comment block with title, author, purpose,
  inputs, outputs, and key assumptions or runtime notes
- Numbered top-level sections
- Logical flow from setup through export

#### 2. Console Output Hygiene

- `disp()` used sparingly
- No routine `display()`, `fprintf()`, or `sprintf()` status chatter
- No per-iteration printing inside optimization or simulation loops

#### 3. Reproducibility

- `rng()` called once if stochastic
- Paths relative to the script working directory (typically `code/<task_group>/`)
- Path construction via `filesep` or `fullfile()`
- No hardcoded absolute paths

#### 4. Function Design and Documentation

- Docstring-style comment block after the signature
- Consistent `snake_case` naming
- No magic numbers without a parameter structure
- `assert()` for critical dimension validation

#### 5. Domain Correctness

- Objective or estimation criterion matches the paper formulas
- Constraints and boundary conditions are correct
- Algorithm matches the stated design

#### 6. Solver Configuration

- Dual-solver paths, if any, are consistent
- Option-file paths constructed correctly
- Hessian callback wired correctly
- Bounds match parameter-vector dimension

#### 7. Derivative Correctness

- Objective returns consistent objective, gradient, and Hessian outputs
- Hessian wrappers call the main objective correctly
- Hessian is symmetric
- Gradient and Hessian dimensions match the parameter vector
- No sign errors in gradient components
- Finite-difference validation passes or equivalent tests exist

Any derivative failure is commit-blocking.

#### 8. Output Persistence

- Results saved via `writetable()`, `writematrix()`, or `save()`
- Output paths built with `filesep` or `fullfile()`
- Filenames are descriptive

#### 9. Comment Quality

- Comments explain why, not what
- No commented-out dead code

#### 10. Error Handling and Convergence

- Solver `exitflag` checked after optimization calls
- First-order optimality checked where relevant
- Data validated for `NaN` and `Inf` before solving
- Solver output checked for `NaN` and `Inf`
- `assert()` used for dimension validation

#### 11. Index Consistency

- Parallel arrays trimmed identically
- Matrix row and column removal is symmetric
- Parameter index arithmetic is correct
- Bounds vectors match parameter-vector length

#### 12. Professional Polish

- Consistent indentation
- Reasonable line lengths except justified mathematical cases
- Semicolons used consistently to suppress output
- Avoid `i` and `j` as loop variables
- Clear explicit steps preferred over clever compact expressions
- One operation per line; avoid hiding data construction, objective logic, or
  solver setup in dense expressions
- Long multi-argument calls split one substantive argument per line when
  readable
- Descriptive `snake_case` names matching the existing codebase

## Report Format

Save the report to `quality_reports/[script_name]_matlab_review.md`.

Include:

- Issue counts by severity
- File and line references
- Concrete proposed fixes
- A checklist summary by review category

## Important Rules

- Never edit source files.
- Include line numbers and code snippets.
- Every issue needs a concrete proposed fix.
- Prioritize domain, solver, and derivative correctness over style.
