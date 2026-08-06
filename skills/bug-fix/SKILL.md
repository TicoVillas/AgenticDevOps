---
name: bug-fix
description: Defines a cause-based minimal defect correction contract when a reproducible bug can be bounded without adding new behavior.
version: 3.0.0
role: ENGINEERING
phase: bug-fix
references:
  causality: references/causality.md
---
# Bug Fix Contract

## When to use
Use for a known defect whose symptom, reproduction and supported cause can be bounded without adding a feature.

## Inputs
Approved discovery, reproduction evidence, affected behavior, preservation constraints and related tests.

## Procedure
Separate symptom, hypotheses and cause; specify the minimum correction, preserved behaviors, regressions and proof. Reference [evidence rules](../../contracts/EvidenceAndFeedbackContract.md).

## Limits
Do not mask the symptom, redesign silently, claim a cause without evidence or implement during contract authorship.

## Outputs
`bugfix.md`, design, tasks and execution brief at `DRAFT_READY_FOR_CONTRACT_REVIEW`.

## Interruption
Stop when the cause changes materially, confidence is insufficient or the request is actually new behavior.

## Next phase
Open independent `contract-review` for the defect contract.
