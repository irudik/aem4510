# Review Domain Substance Protocol

Run the substantive domain review protocol for manuscripts, slides, or lecture
materials.

## Steps

1. **Identify files to review:**
   - If an argument is a specific filename such as `.tex`, `.qmd`, or `.md`,
     review that file only.
   - If the argument is `all`, review all `.tex` files in `latex/` excluding
     `latex/latex_extras/`, plus any `.qmd` files if the project contains them.

2. **For each file, follow the domain review protocol:**
   - Apply all five lenses.
   - Check `literature/` for citation fidelity if that directory exists in the
     project.
   - Check `code/` for code-theory alignment.
   - Check `latex/references/references.bib` for bibliography cross-referencing.
   - Save the report to
     `quality_reports/[FILENAME_WITHOUT_EXT]_substance_review.md`.

3. **After all reviews complete, present a summary:**
   - Overall assessment
   - Total issues found per file
   - Breakdown by severity
   - Top three most critical issues

4. **Do not edit source files.** Produce reports only.

## The Five-Lens Protocol

### Lens 1: Identification and Causal Claims

- Are causal claims supported by the identification strategy?
- Are assumptions stated and plausible?
- Are threats to identification discussed?

### Lens 2: Derivations and Mathematical Correctness

- Do derivations follow from stated assumptions?
- Are boundary conditions and edge cases handled?
- Are approximations acknowledged and bounded?

### Lens 3: Citation Fidelity

- Do cited claims match the original source?
- Are key methodological references included?
- Are any claims attributed to the wrong paper?

### Lens 4: Code-Theory Alignment

- Does the code implement what the paper claims?
- Do variable names and transformations match the model?
- Are estimation commands consistent with the stated specification?

### Lens 5: Backward Logic and Internal Consistency

- Do conclusions follow from the reported results?
- Are results contradicted elsewhere in the document?
- Is the narrative consistent from introduction through conclusion?
