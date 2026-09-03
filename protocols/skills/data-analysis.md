# Data Analysis Workflow Protocol

Run an end-to-end data analysis in R: load, explore, analyze, and produce
publication-ready output.

## Input

A dataset path such as `data/county_panel.csv` or a description of the analysis
goal.

## Constraints

- Follow `protocols/conventions/shared.md` and `protocols/conventions/r.md`.
- Save all scripts to the appropriate `code/[task_group]/` directory.
- Save all outputs to `output/` under the appropriate subdirectory.
- Use `saveRDS()` for every computed object.
- Use the project theme for all figures.
- Prefer clear, explicit steps over clever compact expressions.
- Use one operation per line, and split long calls one argument per line when
  it improves scanability.
- Use descriptive `snake_case` names that read like prose.

## Workflow Phases

### Phase 1: Setup and Data Loading

1. Read the applicable R conventions.
2. Create an R script with a clean header: title, author, purpose, inputs,
   outputs, and key assumptions or runtime notes.
3. Load required packages at the top with `library()`.
4. Set the seed once at the top in `YYYYMMDD` format.
5. Load and inspect the dataset.

### Phase 2: Exploratory Data Analysis

Generate diagnostic outputs:

- Summary statistics, missingness rates, and variable types
- Histograms for key continuous variables
- Scatter plots and correlation matrices
- Time-series or panel trends when relevant
- Group comparisons for treatment and control splits

Save all diagnostic figures to `output/figures/`.

### Phase 3: Main Analysis

Choose the main design based on the research question:

- Use `fixest` for panel-data regressions when appropriate
- Use `lm()` or `glm()` for cross-sectional work when appropriate
- Cluster standard errors at the correct level and document why
- Start with simple specifications and add controls progressively
- Report standardized effects alongside raw coefficients when useful

### Phase 4: Publication-Ready Output

#### Tables

- Prefer `modelsummary` for regression tables
- Include coefficients, standard errors, significance stars, `N`, and
  fit statistics
- Export as `.tex` for LaTeX and `.html` for quick viewing

#### Figures

- Use `ggplot2` with the project theme
- Set `bg = "transparent"` for LaTeX compatibility when needed
- Use clear axis labels with units
- Export with explicit dimensions
- Save as both `.pdf` and `.png` when appropriate

### Phase 5: Save and Review

1. Save all key objects with `saveRDS()`.
2. Rely on the Makefile for directory creation instead of `dir.create()`.
3. Run `/review-r` on the generated script.
4. Address any Critical or High issues before presenting results.

## Script Structure

```r
# ============================================================
# [Descriptive Title]
# Author: [from project context]
# Purpose: [What this script does]
# Inputs: [Data files]
# Outputs: [Figures, tables, RDS files]
# Assumptions: [Key sample, timing, or model assumptions]
# ============================================================

# 0. Setup ----
library(tidyverse)
library(fixest)
library(modelsummary)

set.seed(20260211)  # YYYYMMDD format

# Note: output directories are created by the Makefile, not the script

# 1. Data Loading ----
# 2. Exploratory Analysis ----
# 3. Main Analysis ----
# 4. Tables and Figures ----
# 5. Export ----
```

## Important

- Reproduce the requested analysis exactly.
- Show summary statistics before jumping to regressions.
- Check for multicollinearity, outliers, and separation issues.
- Use relative paths throughout.
- Avoid hardcoded analysis values.
- Keep code readable enough for a coauthor or referee to audit line by line.
