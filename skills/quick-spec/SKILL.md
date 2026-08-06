---
name: quick-spec
description: Produces proportional requirements, design, tasks, and execution guidance when an approved change is clear, bounded, and low to moderate risk.
version: 3.0.0
role: ENGINEERING
phase: quick-spec
references:
  proportionality: references/proportionality.md
---
# Quick Spec

## When to use
Use for an approved, clear, small or moderate change with known architecture and controlled risk.

## Inputs
`discovery.md` at `APPROVED_FOR_SPEC`, confirmed decisions and directly related technical context.

## Procedure
Create proportional requirements, design, tasks and execution brief; preserve traceability and define tests, evidence and stop criteria. Reference [schemas](../../contracts/schemas/) rather than embedding formats.

## Limits
Do not restart discovery, implement code, invent a material control or use this modality for unresolved architecture or critical risk.

## Outputs
Four draft canonical artifacts ending in `DRAFT_READY_FOR_CONTRACT_REVIEW`.

## Interruption
Stop when a new material decision or complexity invalidates the lightweight modality.

## Next phase
Open an independent `contract-review` unless eligible LIGHT lint is explicitly proven by policy.
