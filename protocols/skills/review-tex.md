# Review LaTeX Files Protocol

Run the LaTeX review protocol for changed dynamic values and hardcoded numeric
results.

## Steps

1. **Identify files to review:**
   - If an argument is a specific `.tex` filename, review that file only.
   - If the argument is `all`, review all `.tex` files in `latex/`.

2. **For each file, follow the review protocol below:**
   - Save the report to `quality_reports/[FILENAME_WITHOUT_EXT]_tex_review.md`.

3. **After all reviews complete, present a summary:**
   - Total issues found per file
   - Breakdown by severity
   - Top three most critical issues

4. **Do not edit LaTeX source files** unless the protocol reaches an
   unambiguous auto-fix step.

## Review Protocol

Review the prose surrounding changed dynamic values, detect hardcoded numeric
results, and replace hardcoded values with generated macros when the source is
unambiguous.

### Background

The project's code pipeline in R, Julia, Stata, or MATLAB can generate `.txt`
files containing `\newcommand` definitions in `output/numbers/`. The
`latex/Makefile` exposes those files through `TEXINPUTS`.

```latex
\input{revenue_estimate.txt}
% Then in prose:
% a U.S. carbon tariff raises \$\revenueEstimate\ billion
```

Keep generated macros value-only. Review the actual prose when a value changes;
do not replace this review with generated sentence fragments or a general
article-selection function.

### Phase 1: Build the Dynamic Value Registry

#### Step 1: Build the Dynamic Value Registry

1. Glob for `output/numbers/*.txt`.
2. Read all `\input{...}` lines in the relevant `.tex` files.
3. Extract `\newcommand` definitions and build a registry containing each
   macro's source file and rendered value.

#### Step 2: Identify Changed Macro Values

1. When a task can rebuild `output/numbers/`, record the registry before
   running the producing scripts and build it again afterward.
2. Compare macro contents, not file modification times. Treat added, removed,
   or textually changed definitions as changes; ignore identical regenerations.
3. If the protocol starts after a refresh, use a reliable version-control
   baseline when one exists.
4. If no reliable earlier registry exists, state that limitation and treat all
   macros in regenerated files as requiring contextual review.

### Phase 2: Review Changed Dynamic Values in Context

#### Step 1: Find Every Prose Use

Review every prose occurrence of each changed macro in all affected TeX
documents, including manuscripts, slides, captions, and notes. Search for
direct uses and follow aliases or prose wrapper definitions that contain the
changed macro. Unless the user explicitly limits scope, do not stop after the
first document or occurrence.

#### Step 2: Review the Surrounding Claim

Inspect the complete sentence containing each use. Expand to the surrounding
paragraph, slide, caption, or note when the interpretation depends on nearby
claims. Check:

- Articles and other determiners, based on the complete spoken phrase rather
  than the number alone
- Singular and plural agreement
- Sign, increase/decrease language, and direction of change
- Units, scales, currency, percent, and percentage points
- Comparisons, orderings, ranges, and threshold statements
- Qualitative descriptions such as `small`, `large`, `roughly`, `nearly`,
  `more than doubles`, and claims about the largest or smallest result

Account for intervening prose. For example, `a roughly 8\% change` and
`an approximately 8\% change` cannot be checked from the numeric macro alone.

#### Step 3: Decide and Verify

- Fix grammatical or substantive wording only when the correction is
  unambiguous from the generated value and surrounding claim.
- Escalate when the intended interpretation is unclear or the new value may
  require a substantive rewrite.
- Recompile every affected top-level document after a fix and repeat the
  contextual check for the edited occurrence.
- Record the old and new macro values, every location reviewed, each fix, and
  each unresolved issue.

### Phase 3: Detect Hardcoded Numeric Results

#### Step 1: Scan Prose Sections

Determine the document type before flagging issues:

- For `latex/manuscript.tex` and other manuscript-like `.tex` files, review
  prose results aggressively. Hardcoded empirical values in running text should
  be treated as suspicious by default.
- For `latex/slides.tex` and other presentation decks, be more conservative.
  Ignore slide numbers, agenda counts, dates, and simple orientation numbers
  unless they are clearly empirical results, estimates, standard errors, or
  policy quantities that should come from the code pipeline.

Skip lines inside:

- Math environments
- Table environments
- The preamble
- Comment lines
- Reference and citation commands
- Layout commands such as `\vspace`, `\hspace`, `\setcounter`, and
  `\setlength`

#### Step 2: Classify Numbers

Always acceptable:

- Section, equation, figure, and table references
- Years
- Structural descriptors like `12-sector`
- Numbers inside math or table environments
- Page numbers and ordinals

Suspicious:

- Dollar amounts with `million`, `billion`, or `trillion`
- Percentages
- Parenthetical standard-error-like values
- Numbers preceded by result verbs
- Decimal numbers in prose context

For slides, only flag these when the surrounding text indicates that the number
is a substantive result rather than presentational scaffolding.

#### Step 3: Cross-Reference Against the Registry

- If an existing macro matches approximately, flag a Critical issue.
- Otherwise, proceed to source tracing.

### Phase 4: Source Tracing and Auto-Fix

#### Step 1: Trace the Source

1. Search `code/` for the numeric value and contextual keywords.
2. Examine Makefiles to find producer scripts.
3. Identify the likely computation line.

#### Step 2: Decide

- Auto-fix if exactly one script clearly produces the value.
- Escalate if multiple candidates exist, no source is found, or the number is
  external.

#### Step 3: Auto-Fix When the Source Is Clear

1. Add dynamic-number generation to the source script.
2. Update the relevant Makefile dependencies.
3. Replace the hardcoded number with the macro.
4. Rebuild and verify the generated number matches.

### Template State

If `output/numbers/` does not exist and `code/` has no scripts, report that
hardcoded-number detection is informational only.

## Report Format

Include:

- Dynamic-value baseline used, or the absence of a reliable baseline
- Changed macros with old and new values
- Every changed-macro occurrence reviewed and its disposition
- Auto-fixed items
- Escalated issues
- Severity classification
- File and line references
- Candidate sources and required user action when unresolved
