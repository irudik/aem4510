# MATLAB Code Standards

**Standard:** Senior Principal Computational Scientist + PhD researcher quality

## 1. Reproducibility

- `rng()` called ONCE at top if stochastic operations are present (never inside loops/functions)
- All paths relative to the script working directory (usually `code/[task_group]/`)
- Path construction uses `filesep` or `fullfile()` for cross-platform compatibility
- No hardcoded absolute paths (e.g., `/Users/...`, `C:\Users\...`)
- Rely on the Makefile to make directories (when Makefiles exist)

## 2. Function Design

- Consistent naming convention (`snake_case` matching existing codebase)
- Comment-block docstring immediately after function signature:
  ```matlab
  function [obj, grad, H] = objective_fn(x, data, Params)
  % OBJECTIVE_FN  Compute objective, gradient, and Hessian.
  %
  %   [obj, grad, H] = objective_fn(x, data, Params)
  %
  %   Inputs:
  %     x      - Parameter vector (N x 1)
  %     data   - Structure with fields: ...
  %     Params - Configuration structure with fields: ...
  %
  %   Outputs:
  %     obj  - Scalar objective value
  %     grad - Gradient vector (N x 1)
  %     H    - Hessian matrix (N x N)
  ```
- Use `Params` struct for configuration and tuning values (no magic numbers)
- Input validation via `assert()` for critical dimensions

## 3. Domain Correctness

- Verify objective function implementations match paper formulas (`latex/manuscript.tex`)
- Check known package/solver bugs (document below in Common Pitfalls)

## 4. Solver Configuration

Projects using optimization should follow a dual-solver pattern (e.g., KNITRO + fmincon) controlled by a configuration flag. Key requirements:

- Option file paths constructed with `filesep` or `fullfile()`
- Hessian callback matches the wrapper signature
- Both solver paths should produce consistent results
- Always check `exitflag` after solver call

## 5. Output Paths

Task-group scripts usually run from `code/[task_group]/`, so paths are
relative to that working directory. In the standard layout, define
`output_root` once and write into the main subdirectories under the repo-root
`output/` directory:

```matlab
output_root = fullfile("..", "..", "output");

writetable(results, fullfile(output_root, "tables", "results.csv"));
writematrix(data, fullfile(output_root, "tables", "output.csv"));
save(fullfile(output_root, "tables", "results.mat"), "results", "params");
```

Projects with a `Params` struct may wrap these paths (e.g., `Params.outputdir`
instead of `output_root`), but the main subdirectories (`tables/`,
`figures/`, `numbers/`) remain the same.

## 6. Common Pitfalls

| Pitfall | Impact | Prevention |
|---------|--------|------------|
| Hardcoded absolute paths | Breaks on other machines | Use relative paths with `filesep` |
| Unchecked solver `exitflag` | **Silent convergence failure (Critical, -20)** | Always check `exitflag > 0` |
| Missing NaN/Inf guards | Solver crashes or wrong results | Check before and after optimization |
| Inconsistent index trimming | Wrong data alignment | Trim all parallel arrays identically |
| `i`/`j` as loop variables | Shadows complex unit | Use `ii`, `jj`, `kk` or descriptive names |
| Asymmetric Hessian | **Silently wrong results (Critical, -25)** | Symmetrize: `H = (H + H') / 2` |
| Missing semicolons | Unwanted console output | End assignment lines with `;` |

## 7. Line Length

**Standard:** Keep lines <= 120 characters. Mathematical formulas may exceed 120 chars if breaking the line would harm readability, an inline comment explains the operation, and the line is in a numerically intensive section.

## 8. Code Quality Checklist

```
[ ] rng() once at top (if stochastic)
[ ] Clean header block with purpose, inputs, outputs, and assumptions
[ ] All paths relative with filesep/fullfile() from the script working directory
[ ] Functions documented (comment-block docstrings)
[ ] One operation per line; long calls split by argument where readable
[ ] Descriptive snake_case names matching the existing codebase
[ ] Solver exitflag checked after every optimization call
[ ] NaN/Inf guards on data input and solver output
[ ] Hessian symmetry verified
[ ] Output files saved (writetable/writematrix/save)
[ ] Comments explain WHY not WHAT
[ ] No magic numbers (use Params struct)
[ ] Semicolons on all assignment lines
```
