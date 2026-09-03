# Verify Script Outputs Protocol

Run checksum-based verification of script outputs to detect regressions.

## Steps

### 1. Identify Targets

- If the argument is a script path, verify outputs from that script.
- If the argument is a directory, verify all scripts in that directory.
- If the argument is `baseline`, record baseline checksums only.

### 2. Discover Output Paths

Scan target scripts for output write calls:

- R: `write.csv`, `write_csv`, `saveRDS`, `ggsave`, `writeLines`
- Julia: `CSV.write`, `jldsave`, `savefig`, `open(..., "w")`
- Stata: `save`, `export delimited`, `putexcel`, `esttab`, `file write`
- MATLAB: `writetable`, `writematrix`, `save`, `saveas`

Also check Makefile targets when a Makefile exists.

### 3. Record or Compare Checksums

#### Baseline Mode

1. Run via `make` when possible, otherwise directly.
2. Checksum stable-format outputs: CSV, TSV, generated `.tex`.
3. Skip unstable binary formats such as RDS, `.mat`, PDF, and PNG.
4. If all discovered outputs are unstable binary formats, report that checksum
   verification was skipped and explain why.
5. Store the results in `.checksums.json` alongside outputs.

#### Comparison Mode

1. Run the scripts.
2. Checksum outputs.
3. If all outputs are unstable binary formats, report a SKIP result with the
   reason instead of a pass/fail comparison.
4. Compare against `.checksums.json`.
5. Print a pass/fail table.

### 4. Report

```text
## Output Verification: [script or directory]
| File | Format | Status | Notes |
|------|--------|--------|-------|
| output/tables/results.csv | CSV | PASS | MD5 match |
| output/figures/plot.pdf | PDF | SKIP | Not checksum-stable |
```

### 5. On Failure

Report mismatches with brief CSV diffs. Do not attempt fixes.

## Important

- CSV is the gold standard for checksum comparisons.
- Binary formats are skipped.
- If every discovered output is binary-only, report an explicit SKIP reason.
- Store `.checksums.json` alongside outputs and keep it gitignored.
