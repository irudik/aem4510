# Proofread Academic Documents Protocol

Run the expert proofreading protocol on academic writing.

## Steps

1. **Identify files to proofread:**
   - If an argument is a specific filename, proofread that file only.
   - If the argument is `all`, proofread all `.tex` files in `latex/`
     excluding `latex/latex_extras/`, plus any `.qmd` files.

2. **For each file, follow the proofreading protocol:**
   - Check all five categories: Grammar, Typos, Overflow/Formatting,
     Consistency, Academic Quality.
   - Cross-reference citation keys against the bibliography file.
   - Save the report to
     `quality_reports/[FILENAME_WITHOUT_EXT]_proofread_report.md`.

3. **After all reviews complete, present a summary:**
   - Total issues found per file
   - Breakdown by category
   - Breakdown by severity
   - Top three most critical issues

4. **Do not edit source files.** Produce reports only.

## Proofreading Protocol

### Category 1: Grammar

- Subject-verb agreement
- Tense consistency, especially in results sections
- Article usage
- Dangling modifiers and misplaced clauses
- Comma splices and run-on sentences

### Category 2: Typos

- Misspelled words, including technical terms
- Doubled words
- Missing words in common phrases
- Incorrect homophones

### Category 3: Overflow and Formatting

- Lines or equations that likely overflow margins
- Tables that exceed column width
- Figures referenced but not placed nearby
- Orphaned section headers
- Widow and orphan lines

### Category 4: Consistency

- Notation consistency
- Capitalization style consistency
- Number-format consistency
- Citation-style consistency
- Abbreviation consistency

### Category 5: Academic Quality

- Hedging language appropriate for claims
- Active vs passive voice balance
- Paragraph structure
- Transition quality between sections
- Abstract-content alignment

## Report Format

Save the report to `quality_reports/[FILENAME_WITHOUT_EXT]_proofread_report.md`.

Use this minimal structure:

```text
## Proofread Report: [filename]
### Summary
- Total issues
- Most severe issue

### Issues by Category
- Grammar
- Typos
- Overflow/Formatting
- Consistency
- Academic Quality

### Detailed Findings
| Severity | Category | Line | Issue | Suggested Fix |
|----------|----------|------|-------|---------------|
```
