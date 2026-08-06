<!-- GENERATED FROM skills/low-level-discovery/SKILL.md; DO NOT EDIT -->

---
name: low-level-discovery
description: Investigates repository reality against an approved high-level brief when engineering discovery is required before specification.
version: 3.0.0
role: ENGINEERING
phase: low-level-discovery
references:
  investigation: references/investigation.md
---
# Low-Level Discovery

## When to use
Use after an approved high-level brief to confront product intent with repository reality.

## Inputs
Approved brief, project instructions, related code, tests, architecture and current state.

## Procedure
Trace the relevant flow, confirm or refute assumptions, identify boundaries, data, integrations, security, tests and trade-offs, then write only `discovery.md`. Follow [context](../../policies/ContextPolicy.md) and [artifact structure](../../contracts/ArtifactContract.md).

## Limits
Do not implement, repeat product discovery, test a real environment or infer a material decision.

## Outputs
`discovery.md` with evidence and `READY_FOR_CONFIRMATION`, plus one recommended specification modality.

## Interruption
Stop for a contradiction or undiscoverable choice that changes behavior, architecture, data, integration, security or scope.

## Next phase
Return to alignment; specification generation requires later `APPROVED_FOR_SPEC`.
