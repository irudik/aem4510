# Review R Scripts Protocol

Run the comprehensive R code review protocol.

## Steps

1. **Identify scripts to review:**
   - If an argument is a specific `.R` filename, review that file only.
   - If the argument is `all`, review all R scripts in `code/`.

2. **For each script, follow the review protocol below:**
   - Read `protocols/conventions/shared.md` and `protocols/conventions/r.md`.
   - Save the report to `quality_reports/[script_name]_r_review.md`.

3. **After all reviews complete, present a summary:**
   - Total issues found per script
   - Breakdown by severity
   - Top three most critical issues

4. **Do not edit R source files.** Produce reports only.

## Review Protocol

You are a Senior Principal Quantitative Research Engineer with deep expertise in quantitative
methods and reproducible research workflows.

### Review Categories

#### 1. Script Structure and Header

- Clean, self-contained header block with title, author, purpose, inputs,
  outputs, and key assumptions or runtime notes
- Numbered top-level sections
- Logical flow from setup through export

#### 2. Console Output Hygiene

- `message()` used sparingly
- No routine `cat()`, `print()`, or `sprintf()` status output
- No per-iteration printing inside simulation loops

#### 3. Reproducibility

- `set.seed()` called once at the top
- Packages loaded at the top via `library()`
- Paths relative to the script working directory (typically `code/<task_group>/`)
- Scripts do not call `dir.create()`
- No hardcoded absolute paths
- Script can run cleanly via `Rscript`

#### 4. Function Design and Documentation

- `snake_case` naming
- Verb-noun naming pattern
- Roxygen-style documentation for non-trivial functions
- Default parameters and no magic numbers
- Named list or tibble returns instead of unnamed vectors

#### 5. Domain Correctness

- Estimators match the formulas in `latex/manuscript.tex`
- Standard errors use the correct method
- Simulations match the paper specification
- Treatment effects target the correct estimand

#### 6. Figure Quality

- Consistent palette
- Custom theme applied
- Transparent background where needed
- Explicit dimensions in `ggsave()`
- Clear labels and readable legends
- No default ggplot colors leaking through

#### 7. RDS Data Pattern

- Computed objects persisted with `saveRDS()`
- Descriptive filenames
- Raw results and summary tables both saved
- Paths use `file.path()`

#### 8. Comment Quality

- Comments explain why, not what
- Section headers describe purpose
- No commented-out dead code
- No redundant comments

#### 9. Error Handling and Edge Cases

- Results checked for `NA`, `NaN`, and `Inf`
- Failed replications counted and reported
- Division by zero guarded where relevant
- Parallel backends registered and unregistered cleanly

#### 10. Professional Polish

- Consistent indentation
- Reasonable line lengths
- Consistent operator spacing
- Native `|>` pipe style
- `=` assignment style when that is the project rule
- No `T` and `F` as logical values
- Clear explicit steps preferred over clever one-liners
- One operation per line; avoid combining load, mutate, summarize, estimate,
  and export logic in one expression
- Long multi-argument calls split one substantive argument per line when
  readable
- Descriptive `snake_case` names that read like prose; no ambiguous `tmp`,
  `df`, `x1`, or throwaway names in production logic

## Report Format

Save the report to `quality_reports/[script_name]_r_review.md`.

Include:

- Issue counts by severity
- File and line references
- Concrete proposed fixes
- A checklist summary by review category

## Important Rules

- Never edit source files.
- Include line numbers and code snippets.
- Every issue needs a concrete proposed fix.
- Prioritize domain correctness over style.
