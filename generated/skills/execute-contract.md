<!-- GENERATED FROM skills/execute-contract/SKILL.md; DO NOT EDIT -->

---
name: execute-contract
description: Implements an independently approved contract with progressive testing and evidence when explicit execution authorization is current.
version: 3.0.0
role: ENGINEERING
phase: execute-contract
references:
  checkpoints: references/checkpoints.md
---
# Execute Contract

## When to use
Use only after independent approval, final artifacts and explicit implementation authorization.

## Inputs
Final contract, current review, execution brief, tasks, repository state, authorized paths and pre-existing changes.

## Procedure
Implement authorized tasks incrementally, test progressively, review the delta, update only allowed task state, and write execution evidence. Apply [environment](../../policies/ExecutionEnvironmentPolicy.md), [security](../../policies/SecureDevelopmentPolicy.md) and [Git safety](../../policies/GitSafetyPolicy.md).

## Limits
Do not change the contract, broaden scope, infer remote authority, perform independent validation or absorb a material divergence.

## Outputs
Implementation delta, test results and `EXECUTION.md` with a factual completion status.

## Interruption
Use `REQUIRES_REPLANNING` for material divergence and stop at required visual, manual or high-risk checkpoints.

## Next phase
Open a new independent `validate-delivery` session; execution evidence remains a report.
