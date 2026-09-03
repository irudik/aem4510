# Julia Code Standards

**Standard:** Senior Principal Computational Scientist + PhD researcher quality

## 1. Reproducibility

- `Random.seed!(YYYYMMDD)` called ONCE at top (YYYYMMDD format) **ONCE CHOOSING A SEED DO NOT CHANGE IT AGAIN**
- All dependencies loaded at top via `using` or `import`
- All paths relative to the script working directory using `joinpath()`
- Rely on the Makefile to make directories

## 2. Function Design

- `snake_case` for functions and variables, `CamelCase` for types and modules
- Verb-noun pattern (e.g., `run_simulation`, `generate_dgp`, `compute_effect`)
- Triple-quoted docstrings with signature, arguments, and return type
- Default parameters for all tuning values, no magic numbers
- Return `NamedTuple` or custom `struct` (not bare tuples)

## 3. Domain Correctness

<!-- Customize for your field's known pitfalls -->
- Verify estimator/simulation implementations match paper formulas (`latex/manuscript.tex`)
- Check known package bugs
- Be aware of Float64 precision differences vs R

## 4. Output Paths & Data Persistence

Task-group scripts usually run from `code/[task_group]/`, so paths are
relative to that working directory. In the standard layout, define
`output_root` once and write into the main subdirectories under the repo-root
`output/` directory:

```julia
output_root = joinpath("..", "..", "output")

# Figures
savefig(joinpath(output_root, "figures", "my_plot.pdf"))

# Tables / data
CSV.write(joinpath(output_root, "tables", "my_results.csv"), df)

# Inline numbers for manuscript
open(joinpath(output_root, "numbers", "my_estimate.txt"), "w") do io
    println(io, "\\newcommand{\\myEstimate}{2.31}")
end
```

**Heavy computations saved to disk; downstream scripts load pre-computed data.**

Prefer JLD2 for Julia-native objects. Use CSV for model output. When saving parameterized results, include parameter values in filenames (ASCII only, strip hats).

## 5. Common Pitfalls

| Pitfall | Impact | Prevention |
|---------|--------|------------|
| Global variables in hot loops | Severe performance regression | Pass as arguments or use `const` |
| Abstract-typed struct fields | Type instability, slow dispatch | Always annotate fields with concrete types |
| `1:length(x)` instead of `eachindex(x)` | Off-by-one risk with OffsetArrays | Use `eachindex(x)` or `axes(x, dim)` |
| Unfused broadcasts | Allocates intermediates | Use `@.` macro |
| Missing `@views` on slices | Allocates copies | Wrap in `@views` |
| Hardcoded paths | Breaks on other machines | Use `joinpath()` with relative paths |

## 6. Line Length

**Standard:** Keep lines <= 92 characters (Julia community convention). Mathematical formulas may exceed 92 chars under the same conditions as R.

## 7. Type Stability & Performance

- Run `@code_warntype` on hot functions during development
- Struct fields must have concrete types (no `Any`, no abstract types)
- Use `const` for module-level constants
- Use `@views` to avoid allocating array slices in loops
- Pre-allocate output arrays when size is known

## 8. Broadcasting & Fusion

- Prefer `@.` macro for multi-operation broadcast expressions
- Use `map` / `reduce` / comprehensions for non-broadcastable transforms
- Avoid allocating intermediate arrays where fused broadcasts suffice

## 9. Code Quality Checklist

```
[ ] Dependencies loaded at top via using/import
[ ] Random.seed!() once at top
[ ] Clean header block with purpose, inputs, outputs, and assumptions
[ ] All paths relative via joinpath() from the script working directory
[ ] Functions documented (triple-quoted docstrings)
[ ] One operation per line; long calls split by argument where readable
[ ] Descriptive snake_case names for values/functions and CamelCase types
[ ] JLD2: every computed object saved
[ ] Comments explain WHY not WHAT
[ ] Struct fields have concrete types
[ ] Hot loops use @views and pre-allocation
[ ] Broadcasts fused with @. where applicable
```
