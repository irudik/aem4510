# Review Stata Scripts Protocol

Run the comprehensive Stata code review protocol.

## Steps

1. **Identify scripts to review:**
   - If an argument is a specific `.do` or `.ado` filename, review that file
     only.
   - If the argument is `all`, review all Stata scripts in `code/`.

2. **For each script, follow the review protocol below:**
   - Read `protocols/conventions/shared.md` and `protocols/conventions/stata.md`.
   - Save the report to `quality_reports/[script_name]_stata_review.md`.

3. **After all reviews complete, present a summary:**
   - Total issues found per script
   - Breakdown by severity
   - Top three most critical issues

4. **Do not edit Stata source files.** Produce reports only.

## Review Protocol

You are a Senior Principal Quantitative Research Engineer with deep expertise in empirical
microeconomics, panel-data workflows, and research replication in Stata.

### Review Categories

#### 1. Script Structure and Header

- Clean, self-contained header block with title, author, purpose, inputs,
  outputs, and key assumptions or runtime notes
- Numbered top-level sections
- Logical flow from setup through export

#### 2. Console Output Hygiene

- `display` used sparingly
- No verbose printing inside loops or bootstrap blocks
- No `pause` or `set trace on` in production code

#### 3. Reproducibility

- `version` pinned near the top
- `set more off` in non-interactive scripts
- `set seed` called once when needed
- Relative paths only
- No hardcoded absolute paths or `cd`
- Prefer local and temporary macros over globals

#### 4. Program Design and Documentation

- Reusable logic wrapped in `program define`
- Programs use `syntax` to validate inputs
- `tempfile`, `tempname`, and `tempvar` preferred over scratch filenames
- No unexplained magic numbers

#### 5. Data Integrity and Domain Correctness

- Estimators match the paper formulas
- `merge`, `joinby`, `append`, `collapse`, and `reshape` steps validated
- Key uniqueness checked where needed
- `xtset` or `tsset` declared explicitly when required
- Cluster, FE, and weight choices match the intended estimand

#### 6. Output Persistence

- Outputs saved via `save`, `export delimited`, `putexcel`, `esttab`, or
  `file write`
- Output paths point to standard `output/` subdirectories
- Filenames are descriptive
- Dynamic-number exports use `file write`

#### 7. Comment Quality

- Comments explain why, not what
- Section headers describe purpose
- No commented-out dead code
- Economic intuition documented where non-obvious

#### 8. Error Handling and State Management

- `capture` followed by `_rc` checks
- `preserve` and `restore` balanced
- `assert` or equivalent checks follow critical transformations
- Temporary state cleaned up or tightly scoped

#### 9. Professional Polish

- Consistent indentation and continuation style
- Consistent lower-case command style
- Correct macro quoting
- Explicit `sort` or `bysort` before order-dependent grouped work
- Clear explicit steps preferred over clever compact code
- One data operation per line; avoid hiding sample construction or estimator
  setup in dense command blocks
- Long commands split with aligned `///` continuations, one substantive option
  per line when readable
- Descriptive `snake_case` locals, variables, and program names that read like
  prose

## Report Format

Save the report to `quality_reports/[script_name]_stata_review.md`.

Include:

- Issue counts by severity
- File and line references
- Concrete proposed fixes
- A checklist summary by review category

## Important Rules

- Never edit source files.
- Include line numbers and code snippets.
- Every issue needs a concrete proposed fix.
- Prioritize data-integrity and estimand bugs over style.
