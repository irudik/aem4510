# Compare Branch Outputs Protocol

Compare script outputs between two branches to verify identical results.

## Arguments

- `base-branch`: reference branch such as `main`
- `target-branch`: branch with changes
- `dir-or-script`: directory or script to compare

## Steps

### 1. Set up a worktree for the base branch

```bash
git worktree add /tmp/branch-compare-base <base-branch>
```

### 2. Run scripts on the base branch

In the worktree, check freshness before comparing outputs:

1. If a relevant Makefile exists, run `make -n`.
2. If targets are stale, rebuild them with `make` before recording checksums.
3. If no Makefile exists, run the target script directly.

Record checksums only for stable-format outputs such as CSV, TSV, and generated
`.tex` files.

### 3. Run scripts on the target branch

Repeat the same freshness check on the target branch:

1. Run `make -n` when a relevant Makefile exists.
2. Rebuild stale targets with `make`.
3. Run the target script directly only when no Makefile governs it.

Then record checksums for the same stable-format outputs.

### 4. Compare outputs

```text
## Branch Comparison: [base] vs [target]
| File | Base MD5 | Target MD5 | Status |
|------|----------|------------|--------|
```

For small CSVs smaller than 1 MB that differ, show a content diff.

### 5. Clean up

```bash
git worktree remove /tmp/branch-compare-base
```

## Important

- Follow the Output Verification Formats guidance in `AGENTS.md` for which
  formats are checksum-stable.
- Always clean up the worktree.
- Do not modify files on either branch.
