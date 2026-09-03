# Stata Code Standards

**Standard:** Senior Principal Econometrician + PhD researcher quality

## 1. Reproducibility

- `version` pinned near the top of each script or program
- `set more off` in batch scripts
- `set seed` called ONCE at top if stochastic operations are present
- All paths relative to the script working directory (usually `code/[task_group]/`)
- No hardcoded absolute paths and no `cd`
- Prefer local macros and program arguments over global macros
- Rely on the Makefile to make directories

## 2. Program Design

- Wrap reusable logic in `program define`
- Use `syntax` to validate arguments and options for non-trivial programs
- Use `tempfile`, `tempname`, and `tempvar` for temporary state
- Keep locals descriptive and scoped tightly
- Avoid magic numbers; lift them into named locals or documented parameters

## 3. Data Integrity & Domain Correctness

- Verify estimators and transformations match paper formulas (`latex/manuscript.tex`)
- Check merge keys with `isid`, `duplicates report`, or `assert`
- After `merge`, inspect `_merge` and assert the expected match pattern
- After `reshape`, assert the expected observation count and key uniqueness
- Set `xtset` / `tsset` explicitly for panel or time-series work
- Match cluster, FE, and weight choices to the intended estimand

## 4. Output Paths

Task-group scripts usually run from `code/[task_group]/`, so paths are
relative to that working directory. In the standard layout, define
`output_root` once and write into the main subdirectories under the repo-root
`output/` directory:

```stata
local output_root "../../output"

save "`output_root'/tables/my_results.dta", replace
export delimited using "`output_root'/tables/my_results.csv", replace

file open fh using "`output_root'/numbers/my_estimate.txt", write text replace
file write fh "\newcommand{\myEstimate}{2.31}" _n
file close fh
```

**Heavy computations should be saved to disk; downstream scripts should load pre-computed data where possible.**

## 5. Common Pitfalls

| Pitfall | Impact | Prevention |
|---------|--------|------------|
| Missing `version` | Results may change across Stata releases | Pin `version` at top |
| Hardcoded paths or `cd` | Breaks on other machines | Use working-directory-relative paths only |
| Unchecked `_merge` after `merge` | Silent sample corruption | Assert expected `_merge` values |
| Globals for routine state | Hidden dependencies across scripts | Prefer locals and `syntax` |
| `capture` without `_rc` check | Real failures get silenced | Check `_rc` immediately |
| Unbalanced `preserve` / `restore` | Wrong dataset state later in script | Keep blocks tight and paired |
| Hidden sort dependence | Wrong grouped calculations | Use `sort` / `bysort` explicitly |

## 6. Line Length & Continuations

**Standard:** Keep lines <= 100 characters where practical. Use `///` continuations consistently, and align long option lists when that improves readability.

## 7. Code Quality Checklist

```
[ ] version pinned at top
[ ] set more off in batch scripts
[ ] set seed once at top if stochastic
[ ] Clean header block with purpose, inputs, outputs, and assumptions
[ ] All paths relative and no cd
[ ] Programs documented and arguments validated with syntax
[ ] merge/reshape steps checked with assert/isid/duplicates logic
[ ] Outputs saved under the repo-root output/ directory via relative paths
[ ] One operation per line; long commands split with aligned /// continuations
[ ] Descriptive snake_case locals, variables, and program names
[ ] Comments explain WHY not WHAT
[ ] capture followed by _rc checks
[ ] preserve/restore blocks are balanced
```
