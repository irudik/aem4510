# Makefile Conventions

## Structure

- Every Makefile has `all` and `clean` as `.PHONY` targets
- `all` is the default (first) target and builds everything in that directory
- `clean` removes all generated outputs
- Root Makefile delegates to sub-Makefiles with a `$(MAKE) -C` loop

## Directory Creation

Use order-only prerequisites for output subdirectories. In task-group
Makefiles under `code/[task_group]/`, keep script prerequisites local and route
generated files to the repo-root `output/` directory through a relative output
root:

```make
OUTPUT_ROOT = ../../output

$(OUTPUT_ROOT)/tables/results.csv: analysis.R | $(OUTPUT_ROOT)/tables
	Rscript $<
$(OUTPUT_ROOT)/figures/plot.pdf: figures.R | $(OUTPUT_ROOT)/figures
	Rscript $<
$(OUTPUT_ROOT)/numbers/estimate.txt: analysis.R | $(OUTPUT_ROOT)/numbers
	Rscript $<

$(OUTPUT_ROOT)/tables $(OUTPUT_ROOT)/figures $(OUTPUT_ROOT)/numbers:
	mkdir -p $@
```

Scripts must NOT create directories themselves. The Makefile owns all directory creation.

## Cross-Makefile Dependencies

```make
OUTPUT_ROOT = ../../output

$(OUTPUT_ROOT)/tables/sibling_output.csv:
	$(MAKE) -C ../sibling_dir $(OUTPUT_ROOT)/tables/sibling_output.csv
```

## Expensive Intermediates

Mark expensive-to-produce files as `.PRECIOUS` so Make does not delete them on interruption.

## Pattern Rules

```make
OUTPUT_ROOT = ../../output
STATA ?= stata-mp

$(OUTPUT_ROOT)/tables/%.rds: %.R | $(OUTPUT_ROOT)/tables
	Rscript $<

$(OUTPUT_ROOT)/tables/%.csv: %.jl | $(OUTPUT_ROOT)/tables
	julia $<

$(OUTPUT_ROOT)/tables/%.dta: %.do | $(OUTPUT_ROOT)/tables
	$(STATA) -b do $<
```

## Joint Production

When a single script produces multiple outputs, declare one primary target with the recipe and secondary targets with an empty recipe (`;`).

```make
OUTPUT_ROOT = ../../output

$(OUTPUT_ROOT)/tables/results.csv $(OUTPUT_ROOT)/figures/diagnostics.pdf: analysis.R | $(OUTPUT_ROOT)/tables $(OUTPUT_ROOT)/figures
	Rscript $<
$(OUTPUT_ROOT)/figures/diagnostics.pdf: $(OUTPUT_ROOT)/tables/results.csv ;
```

## Recipe Conventions

- R scripts: `Rscript $<`
- Julia scripts: `julia $<`
- Stata scripts: `$(STATA) -b do $<` with `STATA ?= stata-mp` (or your local Stata binary)
- MATLAB scripts: `matlab -batch "run('$<')"`
- Always use `$<` (first prerequisite) and `$@` (target) automatic variables
- Never use absolute paths
- In task-group Makefiles, keep script prerequisites local (`analysis.R`) and
  route outputs through `$(OUTPUT_ROOT)`

## Root Makefile Pattern

The project root Makefile delegates to `code/` and `latex/`:

```make
SUBDIRS = code latex

.PHONY: all clean $(SUBDIRS)

all: $(SUBDIRS)

$(SUBDIRS):
	$(MAKE) -C $@

clean:
	for dir in $(SUBDIRS); do $(MAKE) -C $$dir clean; done
```

The `code/Makefile` in turn delegates to sub-Makefiles in each task-group directory.

## Validation

- When a Makefile or dependency declaration changes, run a scoped `make -n`
  and confirm that it produces the intended plan before building the affected
  target. A separate dry run is optional for source-only changes under a stable
  Makefile.
- Every `.R`, `.jl`, `.do`, `.ado`, and `.m` file under `code/` should appear as a prerequisite in some Makefile target -- orphaned scripts are a warning sign
