---
name: validate-delivery
description: Independently validates an implementation or revalidates authorized corrections when delivery claims must be proven against real evidence.
version: 3.0.0
role: DELIVERY_ASSURANCE
phase: validate-delivery
references:
  evidence: references/evidence.md
---
# Validate Delivery

## When to use
Use in a new independent session for initial delivery validation or in the original validator session for revalidation.

## Inputs
Final contract, contract review, execution brief, executor report, real delta, tests, runtime evidence and prior findings when revalidating.

## Procedure
Treat execution claims as reports, inspect the real delta, rerun relevant positive and negative checks, validate runtime and security when required, and map each requirement or finding to evidence.

## Limits
Do not correct code, alter tests to accept output, adapt the contract to implementation or operate a real high-risk environment.

## Outputs
`VALIDATION.md`, findings and a bounded correction specification when needed.

## Interruption
Block when mandatory evidence, environment, independence or attributable state cannot be established.

## Next phase
Pass returns to final review; correctable failure returns to the original executor after authorization.
