# MATLAB Optimizer Derivative Audit Protocol

## Purpose

Validate analytic gradients, Hessians, and constraint Jacobians against
numerical derivatives and confirm optimizer callback wiring is correct.

## When to Use

- Debugging MATLAB optimization functions and solver call sites
- KNITRO convergence failures or suspicious solutions
- Suspected sign, index, or scaling errors in derivative code
- Pre-port validation before translating MATLAB solver logic

## Workflow

1. Locate the optimization stack.
2. Verify parameter plumbing.
3. Validate derivatives numerically.
4. Isolate mismatch sources.
5. Report and patch.

### 1. Locate the Optimization Stack

- Find objective and constraint definitions.
- Find KNITRO call sites and callback registration.

### 2. Verify Parameter Plumbing

- Confirm variable ordering and shape assumptions.
- Confirm scaling and bounds mapping.
- Confirm transformed parameterizations are inverted correctly.

### 3. Validate Derivatives Numerically

- Compute finite-difference gradient checks.
- Compute Hessian checks or Hessian-vector checks where appropriate.
- Validate constraint Jacobian entries.

### 4. Isolate Mismatch Sources

- Classify sign errors, missing terms, index offsets, and scaling issues.
- Reproduce problems on minimal parameter vectors and test cases.

### 5. Report and Patch

- Provide a mismatch table with absolute and relative errors.
- Provide concrete patch suggestions tied to line-level logic.
- Re-run checks after edits.

## Required Checks

- Objective gradient vs finite differences
- Hessian symmetry and finite-difference consistency
- Constraint Jacobian vs finite differences
- Callback dimensions and order expected by KNITRO
- Bounds and scaling consistency

## Output Template

- `Functions audited`: objective, constraints, callbacks
- `Check points`: parameter vectors used
- `Derivative errors`: max abs/rel by block
- `Likely causes`: ranked root causes
- `Patch plan`: file-level actions
- `Recheck`: pass/fail after changes

## Guardrails

- Keep the algorithm choice unchanged unless requested.
- Treat "numerically close enough" with explicit tolerances.
- Separate optional Julia-port notes from the core derivative audit.

## Test Guidance

- Use multiple points, not just one nominal calibration.
- Include edge-case points near bounds.
- Persist a small reproducer test to prevent regression.
