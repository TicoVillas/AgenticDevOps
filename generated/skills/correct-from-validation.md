<!-- GENERATED FROM skills/correct-from-validation/SKILL.md; DO NOT EDIT -->

---
name: correct-from-validation
description: Applies the smallest authorized correction for explicit validation findings when a ready correction specification exists.
version: 3.0.0
role: ENGINEERING
phase: correct-from-validation
references:
  correction: references/correction.md
---
# Correct From Validation

## When to use
Use in the original executor session for explicitly authorized findings in a ready correction specification.

## Inputs
Previous validation, correction specification, included finding identifiers, affected contract slices and current attributable delta.

## Procedure
Confirm the bounded cause, apply the smallest corrective delta, preserve approved behavior, add regression coverage and record correction evidence.

## Limits
Do not rewrite the original contract, address excluded findings, redesign architecture, broaden permissions or claim revalidation.

## Outputs
Corrective code and tests plus correction `EXECUTION.md` tracing each finding to cause, change and evidence.

## Interruption
Replan if the cause, architecture, data, security, environment, rollback or blast radius differs materially.

## Next phase
Return every completed correction to the original validator session for revalidation.
