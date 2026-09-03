# Review Julia Scripts Protocol

Run the comprehensive Julia code review protocol.

## Steps

1. **Identify scripts to review:**
   - If an argument is a specific `.jl` filename, review that file only.
   - If the argument is `all`, review all Julia scripts in `code/`.

2. **For each script, follow the review protocol below:**
   - Read `protocols/conventions/shared.md` and `protocols/conventions/julia.md`.
   - Save the report to `quality_reports/[script_name]_julia_review.md`.

3. **After all reviews complete, present a summary:**
   - Total issues found per script
   - Breakdown by severity
   - Top three most critical issues

4. **Do not edit Julia source files.** Produce reports only.

## Review Protocol

You are a Senior Principal Quantitative Research Engineer with deep expertise in
quantitative methods and numerical computing.

### Review Categories

#### 1. Script Structure and Header

- Clean, self-contained header block present with title, author, purpose,
  inputs, outputs, and key assumptions or runtime notes
- Numbered top-level sections
- Logical flow from setup through export

#### 2. Console Output Hygiene

- `@info`, `@warn`, and `@error` used sparingly
- No `println()`, `print()`, or `@printf` for routine status updates

#### 3. Reproducibility

- `Random.seed!()` called once at the top
- Dependencies loaded at the top with `using` or `import`
- Paths relative via `joinpath()`
- No hardcoded absolute paths

#### 4. Function Design and Documentation

- `snake_case` functions and `CamelCase` types
- Verb-noun naming
- Triple-quoted docstrings with signature, arguments, and return type
- Default parameters and no magic numbers
- `NamedTuple` or custom `struct` returns instead of bare tuples

#### 5. Domain Correctness

- Estimator and simulation implementations match paper formulas
- Precision is adequate for the computation
- Algorithm matches the paper description

#### 6. Data Persistence

- Computed objects persisted with `jldsave()` or `serialize()`
- Descriptive filenames
- CSV output for model results where appropriate
- Paths use `joinpath()`

#### 7. Comment Quality

- Comments explain why, not what
- No commented-out dead code

#### 8. Error Handling and Edge Cases

- Results checked for `NaN`, `Inf`, `missing`, and `nothing`
- `try`/`catch` used for external I/O or numerical failures where needed

#### 9. Professional Polish

- Consistent indentation
- Lines under 92 characters except justified math-heavy cases
- `eachindex(x)` preferred over `1:length(x)`
- Unicode Greek only when it improves clarity
- Clear explicit steps preferred over clever one-liners
- One operation per line; avoid hiding data construction or numerical logic in
  dense expressions
- Long multi-argument calls split one substantive argument per line when
  readable
- Descriptive names that read like prose, using `snake_case` for values and
  functions and `CamelCase` only where Julia convention calls for it

#### 10. Type Stability and Performance

- Hot functions verified with `@code_warntype`
- Struct fields have concrete types
- Module constants declared with `const`
- `@views` used on array slices in loops
- Output arrays pre-allocated when size is known

#### 11. Multiple Dispatch

- Prefer dispatch on types to type-tag conditionals
- Keep type hierarchies shallow

#### 12. Broadcasting and Fusion

- `@.` used for multi-operation broadcast expressions
- Avoid manual loops for broadcastable operations

## Report Format

Save the report to `quality_reports/[script_name]_julia_review.md`.

Include:

- Issue counts by severity
- File and line references
- Concrete proposed fixes
- A checklist summary by review category

## Important Rules

- Never edit source files.
- Be specific with line numbers and code snippets.
- Every issue needs a concrete proposed fix.
- Prioritize correctness over performance, and performance over style.
