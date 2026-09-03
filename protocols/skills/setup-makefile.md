# Generate Makefile from Directory Contents Protocol

Scan a directory for scripts and generate a Makefile following project
conventions.

## Steps

### 1. Scan the Directory

Glob for `.R`, `.jl`, `.do`, `.ado`, and `.m` files.

### 2. Parse Output Paths

For each script, scan for write calls:

- R: `write.csv`, `write_csv`, `saveRDS`, `ggsave`, `writeLines`
- Julia: `CSV.write`, `jldsave`, `savefig`, `open(..., "w")`
- Stata: `save`, `export delimited`, `putexcel`, `esttab`, `file write`
- MATLAB: `writetable`, `writematrix`, `save`, `saveas`

Concrete patterns to match include. In the standard `code/<task_group>/`
layout, scripts usually define a working-directory-relative output root that
points to the repo-root `output/` directory:

- R: `output_root = file.path("..", "..", "output")`
- R: `write.csv(df, file.path(output_root, "tables", "results.csv"))`
- Julia: `output_root = joinpath("..", "..", "output")`
- Julia: `CSV.write(joinpath(output_root, "tables", "results.csv"), df)`
- Stata: `local output_root "../../output"`
- Stata: `save "`output_root'/tables/results.dta", replace`
- Stata: `export delimited using "`output_root'/tables/results.csv", replace`
- Stata: `file open fh using "`output_root'/numbers/estimate.txt", write text replace`
- MATLAB: `output_root = fullfile("..", "..", "output");`
- MATLAB: `writetable(tbl, fullfile(output_root, "tables", "results.csv"))`

Also scan for input paths to determine dependencies.

### 3. Generate the Makefile

Follow the relevant Makefile conventions:

- `all` as the default target with `.PHONY`
- Order-only prerequisites for directories
- Automatic variables such as `$<` and `$@`
- Joint production for multi-output scripts
- `.PRECIOUS` for expensive intermediates
- A `clean` target
- For task-group Makefiles under `code/<task_group>/`, keep script
  prerequisites local (for example `analysis.R`) and route outputs through
  `OUTPUT_ROOT ?= ../../output`

### 4. Present for Review

Do not write directly. Present the generated content and ask for approval.

### 5. Write After Approval

Write the Makefile and update the parent `code/Makefile` delegation if needed.

## Important

- Always present for review before writing.
- Follow Makefile conventions exactly.
- Use the existing Stata recipe convention `$(STATA) -b do $<` when a generated
  Makefile includes Stata targets.
- Flag scripts whose outputs cannot be parsed reliably.
