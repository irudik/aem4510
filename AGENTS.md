# AGENTS.md -- Academic Project Development with Codex CLI

<!-- HOW TO USE: Replace [BRACKETED PLACEHOLDERS] with your project info.
     Keep this file under 32KB -- Codex loads it every session.
     Code-specific conventions are in code/AGENTS.md.
     LaTeX-specific conventions are in latex/AGENTS.md. -->

**Project:** [YOUR PROJECT NAME]
**Institution:** [YOUR INSTITUTION]
**Branch:** main

---

## Core Principles

- **Match process to risk** -- plan and review in proportion to the chance and
  cost of a wrong result; do not use file count as the sole risk measure
- **Verify after** -- compile/render and confirm output at the end of every task
- **Readable research code** -- prefer clear, reproducible, prose-like code
  over clever compactness; code should be easy for coauthors, referees, and
  future selves to audit
- **Plain-language writing** -- all prose (replies, issues, reports,
  comments) follows `protocols/writing.md`; write for an economist coauthor,
  never in programmer jargon
- **Single source of truth** -- `latex/manuscript.tex` is authoritative for the paper
- **Quality gates** -- apply the scoring rubric before commit or merge when it
  adds value; do not score every routine edit
- **Structured [LEARN] tags** -- when corrected or when you discover a durable lesson, save a structured `[LEARN:category]` entry to `MEMORY.md`

---

## Folder Structure

```
[YOUR-PROJECT]/
├── AGENTS.md                    # This file (Codex instructions)
├── CLAUDE.md                    # Claude Code instructions
├── MEMORY.md                    # Persistent [LEARN] entries across sessions
├── Makefile                     # Root -- delegates to code/ and latex/
├── protocols/                   # Shared writing guide and skill bodies
│   ├── writing.md
│   └── skills/
│       └── *.md
├── .codex/                      # Codex CLI config and rules
│   ├── config.toml              # Model, sandbox, approval settings
│   └── rules/
│       └── default.rules        # Command execution permissions (Starlark)
├── .agents/                     # Codex skill wrappers
│   └── skills/                  # Skill definitions
├── .claude/                     # Claude Code settings, wrappers, agents, hooks
├── code/                        # Analysis code with sub-Makefiles
│   ├── AGENTS.md                # R/Julia/Stata/MATLAB/Makefile conventions (Codex)
│   ├── Makefile                 # Delegates to sub-Makefiles
│   └── [task_group]/            # e.g., data cleaning, estimation, figures
│       ├── Makefile
│       └── *.R, *.jl, *.do, *.ado, or *.m
├── latex/                       # Paper manuscript and slides
│   ├── AGENTS.md                # LaTeX conventions (Codex)
│   ├── Makefile                 # pdflatex 3-pass build
│   ├── manuscript.tex           # Main paper
│   ├── slides.tex               # Presentation slides
│   ├── latex_extras/            # Preamble files (packages, commands, tables)
│   └── references/              # .bib and .bst files
├── output/                      # Code pipeline outputs
│   ├── figures/                 # Generated figures
│   ├── tables/                  # Generated tables
│   └── numbers/                 # Inline numbers for manuscript (\newcommand .txt files)
├── quality_reports/             # Plans, handoffs, session logs, merge reports
└── templates/                   # Session, handoff, learning, and quality templates
```

---

## Commands

Run all Make commands below from the repository root.
`make -C path` changes Make's working directory to `path`, so paths in that
Makefile and in the scripts its recipes run are relative to `path`, not to the
repository root.

```bash
# Make (preferred -- builds everything)
make                               # Build all (code + latex)
make -n                            # Dry-run: show what would be built
make check-template                # Validate shared-skill and permission sync
make -C code                       # Build all code targets
make -C code/[task_group] all      # Build one task group
make -C latex                      # Compile manuscript

# LaTeX (manual fallback -- 3-pass, pdflatex)
cd latex
export TEXINPUTS=.:./latex_extras/:../output/numbers/:../output/tables/:../output/figures/:
export BIBINPUTS=./references/:
export BSTINPUTS=./references/:
pdflatex -interaction=nonstopmode manuscript.tex
bibtex manuscript
pdflatex -interaction=nonstopmode manuscript.tex
pdflatex -interaction=nonstopmode manuscript.tex
```

---

## Quality Thresholds

| Score | Gate | Meaning |
|-------|------|---------|
| 80 | Commit | Good enough to save |
| 90 | PR | Ready for deployment |
| 95 | Excellence | Aspirational |

---

## Skills Quick Reference

| Command | What It Does |
|---------|-------------|
| `/commit [msg]` | Stage, commit, PR, merge on the current non-`main` branch; create a branch only when needed |
| `/data-analysis [dataset]` | End-to-end R analysis |
| `/refactor [file-or-dir]` | Verify-refactor-verify loop |
| `/verify-outputs [script]` | Checksum outputs, compare to reference |
| `/compare-branches [b1] [b2]` | Cross-branch output comparison |
| `/resume-custom` | Recover context after compression/new session |
| `/trace [question]` | Trace an ambiguous result or failure back to its most likely cause |
| `/learn [insight]` | Save a durable, project-specific lesson to `MEMORY.md` |
| `/setup-makefile [dir]` | Generate Makefile from directory contents |
| `/review-r [file]` | R code quality review |
| `/review-julia [file]` | Julia code quality review |
| `/review-stata [file]` | Stata code quality review |
| `/review-matlab [file]` | MATLAB code quality review |
| `/review-tex [file]` | LaTeX hardcoded-number and updated-result prose review |
| `/review-makefile [file]` | Makefile conventions review |
| `/review-comments [path]` | Clean up comments, docstrings, dead code |
| `/review-domain [file]` | Substantive domain review (identification, citations, code-theory) -- opt-in |
| `/proofread [file]` | Grammar, typos, overflow, consistency check -- opt-in |
| `/review-pr [PR#]` | Address PR review comments, commit fixes, resolve threads |
| `/matlab-optim-derivatives` | Audit MATLAB optimization derivatives |

---

## Shared Skill Protocols

- Shared skill bodies live in `protocols/skills/`
- `.claude/skills/` and `.agents/skills/` are thin wrappers around those files
- Review-oriented agents in `.claude/agents/` execute the same shared protocols
- Kimi Code CLI loads this `AGENTS.md` hierarchy and scans `.agents/skills/`
  natively, so it needs no separate skill wrappers; for permission parity, merge
  `.kimi-code/config.toml.example` into `~/.kimi-code/config.toml`

---

## Current Project State

| Component | File | Status | Description |
|-----------|------|--------|-------------|
| Manuscript | `latex/manuscript.tex` | Template | Paper skeleton with standard sections |
| Slides | `latex/slides.tex` | Template | Presentation template |
| Code pipeline | `code/` | Template | Sub-Makefiles to be added per project |

---

## Risk-Based Workflow

Choose the lightest workflow that still provides credible evidence of
correctness. File count is useful context, but a one-line estimand or solver
change can be riskier than a broad documentation edit.

### 1. Routine or Bounded Change

Implement, test, and provide a concise report. Do not create a saved plan,
handoff file, scoring exercise, or reviewer agent by default.

### 2. Substantive Single-Module Change

Give a brief in-conversation plan, implement, test, and run one targeted review
only when independence adds material value. Save a plan only if the work must
survive a session boundary.

### 3. High-Risk, Cross-Cutting, Numerical, or Pre-Merge Work

Save a plan, then continue automatically with implementation, verification,
and one independent review. Do not treat the plan as an approval gate unless
the user explicitly asks to review or approve it. Allow at most one
fix/re-review by default. This category includes:

- solver, derivative, tolerance, or convergence changes
- identification, estimand, or manuscript-critical quantitative claims
- broad data-pipeline changes and destructive operations
- final pre-merge review when the consequences of a missed error are high

### 4. Full Multi-Agent Loop

Use a full multi-agent loop only when the user explicitly requests it or when
failures remain genuinely ambiguous after normal diagnosis and independent
review. State the unresolved hypotheses, what each additional reviewer will
test, and the stop condition. Never loop indefinitely.

### Selecting a Reviewer

When independent review adds value, select the narrowest reviewer that covers
the main risk:

| Main risk | Review skill or Claude reviewer |
|-----------|---------------------------------|
| R analysis | `/review-r` or `r-reviewer` |
| Julia computation | `/review-julia` or `julia-reviewer` |
| Stata analysis | `/review-stata` or `stata-reviewer` |
| MATLAB computation or optimization | `/review-matlab` or `matlab-reviewer` |
| Make dependency graph | `/review-makefile` or `makefile-reviewer` |
| LaTeX results and dynamic numbers | `/review-tex` or `tex-reviewer` |
| Identification, derivation, or code-theory alignment | `/review-domain` or `domain-reviewer` |
| Grammar and presentation | `/proofread` or `proofreader` |
| Ambiguous cause of a result or failure | `/trace` or `tracer` |

Choose one reviewer based on the riskiest changed component; do not spawn one
reviewer per file type merely because a change touches several file types. Use
multiple reviewers only under the full multi-agent rule above.

Tests are required in every category. Fix test failures independently and
rerun the relevant checks before reporting. An explicit request for a fuller
or lighter process overrides the default, subject to safety constraints.

### Automatic Execution

Proceed through the applicable workflow without a plan-approval pause. Phrases
such as "just do it" or "handle it" reinforce this default but are not required.
Pause only when the user explicitly requests plan approval or when a material
choice, missing authority, destructive operation, or scope expansion requires
input. Automatic execution does not authorize commits, pushes, merges,
destructive operations, or a broader scope unless the user requested them.

### Structured Handoffs

Write a handoff only when context must transfer across a person, agent, branch,
session, or major stage. Use `templates/handoff.md` and save it under
`quality_reports/handoffs/YYYY-MM-DD_description/`. Do not create handoffs as
routine stage paperwork.

---

## Refactoring Protocol

### Constraints

- NEVER change solver tolerances, options, or convergence criteria
- NEVER rename variables in numerical/hot-loop code
- NEVER change function signatures without explicit approval
- NEVER remove dead code unless explicitly instructed (flag it in section headers instead)
- The ONLY acceptable refactoring outcome is identical output

### Verify-Refactor-Verify Loop

1. Run target script, record output checksums (CSV only -- skip binary formats like RDS, .mat, PDF)
2. Apply style changes per language convention rules
3. Re-run, compare checksums
4. If mismatch: revert and report -- do not attempt to fix the mismatch

### Approved Transformations

- Comment style (headers, borders, docstrings)
- Whitespace and indentation
- Variable grouping and section organization
- Adding missing documentation
- Language-specific style conventions

### Prohibited Transformations (without explicit approval)

- Changing algorithm logic or control flow
- Renaming function parameters or return values
- Modifying solver configuration or tolerances
- Removing or restructuring error handling
- Changing data types or precision
- Refactoring loops into vectorized form (or vice versa) in numerical code

When in doubt, ask before changing.

---

## Solver Debugging Protocol

When debugging numerical solver failures (MATLAB, Julia, Python):

### Diagnostic Checklist (follow in order)

1. **Dimensions first** -- verify all matrices are conformable, vectors are correct length
2. **NaN/Inf trace** -- find the first operation that produces NaN; trace backward
3. **Finite-difference check** -- validate analytic gradients/Hessians before suspecting derivative bugs
4. **Condition number** -- check key matrices (Jacobian, Hessian) for ill-conditioning
5. **Boundary check** -- verify variables respect bounds (non-negative shares, probabilities in [0,1])
6. **Input data** -- confirm data fed to solver contains no NaN/Inf/missing values
7. **Initial guess** -- check that x0 is feasible (satisfies bounds and constraints)

### Do NOT

- Change tolerances or solver options as a diagnostic step
- Change the solver algorithm without explicit approval
- Propose fixes before completing the diagnostic checklist
- Guess at root causes -- show evidence
- Add `try`/`catch` blocks just to suppress solver errors

### Report Format

Present diagnosis with evidence, then implement the proposed fix when the task
authorizes changes. For a diagnosis-only request, report the proposed fix
without implementing it. Continue to require explicit approval for solver
algorithm, tolerance, or option changes as specified above.

```markdown
## Diagnosis
- **Symptom:** [what failed]
- **First NaN/error at:** [file:line]
- **Root cause:** [with evidence]
- **Checklist completed:** [which steps, what was found]

## Proposed Fix
- [specific change with rationale]
- [expected outcome]
```

---

## General Trace Protocol

Use `/trace [observation]` when the main question is causal rather than
implementational.

Good fits:

- estimates changed unexpectedly
- merge or reshape outputs look wrong
- build dependencies behave unexpectedly
- outputs disagree across code, tables, and manuscript
- a failure is real but the cause is not yet clear

`/trace` should produce a ranked diagnosis with evidence, not a guessed fix.
For numerical solver failures, combine it with the solver debugging checklist
above.

---

## Output Verification Formats

When comparing outputs before and after code changes:

| Format | Checksum-Stable? | How to Compare |
|--------|-----------------|----------------|
| CSV/TSV | Yes | MD5 checksum |
| RDS | No (R-version dependent) | Read and compare values, or convert to CSV |
| .dta | Partially | Read and compare values, or export to CSV first |
| .mat | Partially | Load and compare specific variables |
| JLD2 | Yes (Julia-version dependent) | MD5 or load-and-compare |
| PDF/PNG | No (renderer dependent) | Visual diff only |
| .tex (generated) | Yes | MD5 or text diff |

**Gold standard:** CSV checksums. Use these for refactoring verification. Skip binary formats.

- **For `.dta` files:** compare with a reader such as `haven::read_dta()` or
  export both versions to CSV first.
- **For `.mat` files:** load both versions and compare variables with an
  explicit tolerance.
- **For `RDS` files:** compare with `all.equal()` or convert to CSV first.
- **For figures:** use visual inspection only; do not checksum PDF or PNG
  outputs.

---

## Routine Code Verification

For routine and substantive single-module R, Julia, Stata, or MATLAB changes:

1. Implement the bounded change.
2. Verify at the narrowest useful scope:
   - If the change modifies a Makefile or dependency graph, run a scoped
     `make -C code/[dir] -n [target]`, then build that target.
   - If source code changes under a stable Makefile, run the relevant Make
     target directly; a separate dry run is optional.
   - If no Makefile governs the source, run it from its containing directory.
   - Documentation or instruction-only changes do not require a Make dry run.
   - Use a root `make -n` for cross-cutting or pre-merge verification when the
     full dependency plan adds useful coverage.
3. Confirm the script runs without error and creates the expected outputs.
4. Fix failures, rerun the relevant checks, and report the evidence concisely.
5. Use one targeted review only when independent judgment adds material value.

### Verification Checklist

- [ ] Applicable Make target passes; a dry run was used only when required above
- [ ] Script runs without errors (R, Julia, Stata, and/or MATLAB)
- [ ] Language setup is explicit at top (`library()`, `using`, `version`, `rng`)
- [ ] No hardcoded absolute paths
- [ ] `set.seed()` / `Random.seed!()` / `set seed` / `rng()` once at top if stochastic
- [ ] Output files created at expected paths
- [ ] Tolerance checks pass (if applicable)
- [ ] No hardcoded computed results in manuscript prose
- [ ] Quality score >= 80 when preparing a commit or merge and scoring is applicable

---

## Planning Workflow

Plan in proportion to risk.

Plans are working records, not approval gates. Do not enter an interactive plan
mode solely because work is high risk; use it only when the user explicitly
requests it.

### The Protocol

1. **Classify the work** using the risk-based workflow above.
2. **Routine work** -- implement directly; no plan artifact or approval pause.
3. **Substantive single-module work** -- give a brief in-conversation plan.
4. **High-risk or cross-cutting work** -- check `MEMORY.md`, draft the approach,
   save it to `quality_reports/plans/YYYY-MM-DD_short-description.md`, and
   continue automatically. Pause only when the user explicitly asks to approve
   the plan or a material unresolved choice requires user input.
5. **Context transfer** -- save a plan for lower-risk work only when another
   session, branch, person, or agent must resume it.
6. **Manuscript review opt-in** -- when high-risk work touches manuscript or
   slides (`latex/`), include domain review or proofreading only when the user
   requested it. Do not pause to ask. Record requested and omitted optional
   reviews in the saved plan under an `## Optional Reviews` section.
7. **Implement and verify** using the applicable risk-based workflow.

### Plans on Disk

Plans survive context loss. When a saved plan is required, use:

```
quality_reports/plans/YYYY-MM-DD_short-description.md
```

Format: Status (IN PROGRESS/COMPLETED; use DRAFT or APPROVED only when the user
explicitly requests a plan-approval step), approach, files to modify,
verification steps.

### Context Management

- Prefer automatic compression while continuing the same task on the same branch.
- Start a fresh session, or use `/clear`, when changing task or branch.
- When the user starts an unrelated task or switches branches mid-session,
  state the boundary, recommend a fresh session, and pause until the user says
  whether to continue in the current session.
- Save only the context needed for later recovery before ending a session.
- Avoid sessions that accumulate unrelated work across several days or branches.

### Session Recovery

After compression or a new session:
1. Read `AGENTS.md` and the most recent plan in `quality_reports/plans/`
2. Read the most recent relevant handoff in `quality_reports/handoffs/`, if one exists
3. Check `git log --oneline -10` and `git diff`
4. State what you understand the current task to be

---

## Quality Gates & Scoring Rubrics

Use these rubrics for high-risk review, requested scoring, and commit or merge
decisions. Do not perform a scoring exercise after every routine edit.

### LaTeX Manuscript (.tex)

| Severity | Issue | Deduction |
|----------|-------|-----------|
| Critical | pdflatex compilation failure | -100 |
| Critical | Typo in equation | -25 |
| Critical | Undefined citation | -15 |
| Critical | Hardcoded result (macro exists but unused) | -15 |
| Critical | Overfull hbox > 10pt | -10 |
| Major | Missing bibliography entries | -5 |
| Major | Likely computed result with no macro | -5 |
| Major | output/numbers/ file missing from Makefile dependencies | -5 |
| Minor | Long lines (>100 chars) | -1 (EXCEPT documented math formulas) |

### R Scripts (.R)

| Severity | Issue | Deduction |
|----------|-------|-----------|
| Critical | Syntax errors | -100 |
| Critical | Domain-specific bugs (wrong estimand, incorrect formula) | -30 |
| Critical | Numerical errors (division by zero, unguarded NaN propagation) | -25 |
| Critical | Hardcoded absolute paths | -20 |
| Major | Missing set.seed() | -10 |
| Major | Missing figure generation | -5 |

### Julia Scripts (.jl)

| Severity | Issue | Deduction |
|----------|-------|-----------|
| Critical | Runtime errors | -100 |
| Critical | Domain-specific bugs (wrong estimand, incorrect formula) | -30 |
| Critical | Numerical errors (NaN propagation, catastrophic cancellation, wrong precision) | -25 |
| Critical | Hardcoded absolute paths | -20 |
| Major | Type instability in hot loops | -15 |
| Major | Missing `Random.seed!()` | -10 |
| Major | Abstract-typed struct fields | -5 |
| Major | Missing persistence (no CSV/JLD2 export) | -5 |
| Minor | Unfused broadcasts (`.+` instead of `@.`) | -2 |
| Minor | Globals captured in loops without `let` | -2 |

### Stata Scripts (.do / .ado)

| Severity | Issue | Deduction |
|----------|-------|-----------|
| Critical | Runtime errors | -100 |
| Critical | Domain-specific bugs (wrong estimand, incorrect formula) | -30 |
| Critical | Unchecked merge/reshape invariants (keys, `_merge`, panel state) | -25 |
| Critical | Hardcoded absolute paths or `cd` | -20 |
| Major | Missing `version` | -10 |
| Major | Missing `set seed` (if stochastic) | -10 |
| Major | `capture` without `_rc` checks or heavy global macro dependence | -5 |
| Major | Missing output persistence | -5 |
| Minor | Noisy `display` / `pause` / `set trace on` in production | -2 |

### MATLAB Scripts (.m)

| Severity | Issue | Deduction |
|----------|-------|-----------|
| Critical | Runtime errors | -100 |
| Critical | Domain-specific bugs (wrong objective, incorrect moment conditions) | -30 |
| Critical | Asymmetric Hessian | -25 |
| Critical | Gradient/Hessian sign errors | -25 |
| Critical | Gradient/Hessian dimension mismatch | -25 |
| Critical | Hardcoded absolute paths | -20 |
| Critical | Unchecked solver exitflag | -20 |
| Critical | Index consistency errors (off-by-one, bounds/parameter mismatch) | -20 |
| Major | Missing NaN/Inf guards | -10 |
| Major | Missing `rng()` (if stochastic) | -10 |
| Major | Missing output persistence | -5 |
| Minor | `i`/`j` as loop variables | -2 |
| Minor | Missing semicolons (unsuppressed output) | -1 |

### Makefile

| Severity | Issue | Deduction |
|----------|-------|-----------|
| Critical | Circular dependencies | -100 |
| Critical | Missing prerequisites (stale builds) | -30 |
| Major | Missing `.PHONY` on non-file targets | -10 |
| Major | Absolute paths | -10 |
| Major | Directories not using order-only prerequisites | -5 |

### Enforcement

- **Score < 80:** Block commit. List blocking issues.
- **Score < 90:** Allow commit, warn. List recommendations.
- User can override with justification.

### Tolerance Thresholds (Research)

<!-- Customize for your domain -->

| Quantity | Tolerance | Rationale |
|----------|-----------|-----------|
| Point estimates | [e.g., 1e-6] | [Numerical precision] |
| Standard errors | [e.g., 1e-4] | [MC variability] |
| Coverage rates | [e.g., +/- 0.01] | [MC with B reps] |

---

## Task Completion Verification Protocol

**At the end of EVERY task, verify the output works correctly.** This is non-negotiable.

### Make Verification

- For a Makefile or dependency-graph change, run a scoped dry run such as
  `make -C code/[subdir] -n [target]`, then build the target.
- For a source change governed by an unchanged Makefile, build the relevant
  target directly. Add a dry run only when checking staleness or dependency
  selection is part of the task.
- For cross-cutting or pre-merge verification, use root `make -n` when seeing
  the complete dependency plan adds useful coverage.
- Documentation and instruction-only changes do not require Make verification.
- Any required build must exit successfully before proceeding to the
  file-specific checks below.

### Dynamic Number Context Review

When a task can rebuild files in `output/numbers/`, record the current
`\newcommand` definitions before running the producing scripts. After the
rebuild, compare macro contents rather than file modification times.

Whenever a generated numeric macro changes value, review every prose
occurrence of that macro in all affected TeX documents. Inspect the containing
sentence and enough nearby context to assess the claim. Check articles,
singular and plural agreement, direction and sign language, units, comparisons,
thresholds, and qualitative descriptions of magnitude. Fix unambiguous prose
problems, flag substantive ambiguity, and recompile every affected document.
Report the old and new values and every location reviewed. A regeneration with
identical macro contents requires no contextual review.

If no reliable pre-rebuild definitions are available, state that limitation
and review every prose use of the macros in the regenerated files. Keep
generated macros value-only; do not move surrounding prose into generated
files or rely on a general article-selection function to replace contextual
review.

### For LaTeX Manuscript:
1. Compile with `make -C latex` (preferred). Check for errors
2. Verify PDF was generated with non-zero size
3. Check for overfull hbox warnings
4. Check for undefined citations
5. Run `/review-tex` to check hardcoded numbers and changed-value prose contexts
6. Verify all dynamic number `\input{...}` files exist in `output/numbers/`

### For R Scripts:
1. Prefer `make -C code/[subdir] [target]`. If no Makefile exists, set
   `code/[subdir]/` as the command's working directory and run `Rscript script.R`
2. Verify output files (PDF, RDS, CSV) were created with non-zero size
3. Spot-check estimates for reasonable magnitude

### For Julia Scripts:
1. Prefer `make -C code/[subdir] [target]`. If no Makefile exists, set
   `code/[subdir]/` as the command's working directory and run `julia script.jl`
2. Verify output files (CSV, JLD2) were created with non-zero size
3. Check file sizes are plausible (not suspiciously small or empty)
4. If stochastic, verify reproducibility: run twice with same seed, diff outputs

### For Stata Scripts:
1. Prefer `make -C code/[subdir] [target]`. If no Makefile exists, set
   `code/[subdir]/` as the command's working directory and run `stata -b do script.do`
2. Verify output files (`.dta`, `.csv`, `.tex`, `.txt`, or logs used downstream) were created with non-zero size
3. Check the batch log for Stata error codes and unexpected warnings
4. Spot-check key counts, merge assertions, or exported estimates for reasonable magnitude

### For MATLAB Scripts:
1. Prefer `make -C code/[subdir] [target]`. If no Makefile exists, set
   `code/[subdir]/` as the command's working directory and run
   `matlab -batch "run('script.m')"`
2. Verify output files (`.mat`, `.csv`, `.tex`, or figures) were created with non-zero size
3. Check file sizes are plausible and solver output/logs show successful convergence where relevant

### For Code Pipelines:
1. When the task adds, renames, or restructures scripts under `code/`, verify
   that every `.R`, `.jl`, `.do`, `.ado`, and `.m` file appears as a
   prerequisite in some Makefile target.
2. Flag orphaned scripts as warnings. They may be dead code or missing from the
   build graph.

### Common Pitfalls

- **Relative paths:** use paths relative to the Makefile's directory
- **Assuming success:** verify output files exist and contain plausible content

### Verification Checklist:
```
[ ] Output file created successfully
[ ] No compilation/render errors
[ ] Images/figures display correctly
[ ] Changed dynamic-number contexts reviewed (when applicable)
[ ] Reported results to user
```

---

## Session Logging

**Location:** `quality_reports/session_logs/YYYY-MM-DD_description.md`
**Template:** `templates/session-log.md`

Create a session log only when context must survive a session boundary or the
task contains major decisions that future work will need. Record material
design decisions, user corrections, durable blockers, and the final state. Do
not log routine commands, every problem solved, or low-risk edits that are
fully explained by the diff and final report.

### Quality Reports

Generated **only at merge time** -- not at every commit or PR.
Save to `quality_reports/merges/YYYY-MM-DD_[branch-name].md` using `templates/quality-report.md`.

## Structured Handoffs

**Location:** `quality_reports/handoffs/YYYY-MM-DD_description/`
**Template:** `templates/handoff.md`

Write handoffs only when context actually transfers across a person, agent,
branch, session, or major stage. Each note should be short and contain:

- decisions made
- alternatives rejected
- active risks
- files touched or relevant
- what the next stage must verify or do

## Structured Learning

Use `/learn` or append directly to `MEMORY.md` when a lesson is both
project-specific and likely to recur.

Required format:

```markdown
[LEARN:category]
- Date: YYYY-MM-DD
- Trigger: [symptom, mistake, or question]
- Wrong: [incorrect assumption or behavior]
- Right: [correct rule or approach]
- Scope: [where this applies]
- Evidence: [file, command, output, or user correction]
- Action: [what to do next time]
```

Do not save generic advice. Save only durable lessons that would materially help
future work.

### Template Repo Hygiene

When maintaining this template repository itself, treat ad hoc files under
`quality_reports/` as branch-local artifacts. Before merging back to `main`,
remove task-specific plans, handoffs, session logs, merge reports, and scratch
directories so the template stays fresh. Keep only `.gitkeep` placeholders and
intentional template assets.

---

## Command Conventions

Issue one command per shell execution. Do not chain commands with `&&` or `;`.
Claude and Codex evaluate permission rules by command segment, so a chain can
replace one approved command with several interactive permission checks.

- **Independent commands** -- issue in parallel when possible (e.g., `git status` and `git diff`)
- **Dependent commands** -- issue sequentially, waiting for each result before the next (e.g., `git add` then `git commit`)
- **Repeated dependent workflows** -- prefer an existing Make target or a
  narrowly reviewed script over broad shell-chain permissions

## Workflow Quick Reference

**Workflow:** Risk-based (you set the goal; the agent applies proportionate planning, verification, and review)

```
Your instruction -> [CLASSIFY RISK] -> [PLAN if needed] -> [EXECUTE] -> [VERIFY] -> [REPORT]
```

**Ask the user when:** Design forks, code ambiguity, methodological edge cases, scope questions.
**Just execute when:** Obvious fixes, verification, documentation, plotting, deployment.
