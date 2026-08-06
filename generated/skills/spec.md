<!-- GENERATED FROM skills/spec/SKILL.md; DO NOT EDIT -->

---
name: spec
description: Produces a full traced specification with validation and rollback planning when work is complex, architectural, transversal, or high risk.
version: 3.0.0
role: ENGINEERING
phase: spec
references:
  architecture: references/architecture.md
---
# Full Spec

## When to use
Use for complex, transversal, architectural, integration, persistence, security, infrastructure or high-risk work.

## Inputs
Approved discovery, alignment decisions, applicable policies and focused repository evidence.

## Procedure
Define observable requirements, compatible design, ordered outcomes, progressive validation, rollback and a bounded execution brief. Use [artifact contracts](../../contracts/ArtifactContract.md) and applicable policies by reference.

## Limits
Do not implement, conceal uncertainty, convert recommendations into decisions or authorize an operation through planning.

## Outputs
Requirements or bug contract, design, tasks and execution brief in review-ready draft state.

## Interruption
Stop on unresolved behavior, data, security, environment, blast-radius or authorization decisions.

## Next phase
Route to a new independent `contract-review` session.
