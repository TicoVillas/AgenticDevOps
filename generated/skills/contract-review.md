<!-- GENERATED FROM skills/contract-review/SKILL.md; DO NOT EDIT -->

---
name: contract-review
description: Independently reviews a draft engineering contract or its follow-up when approval, findings, and executability must be established.
version: 3.0.0
role: CONTRACT_ASSURANCE
phase: contract-review
references:
  ledger: references/ledger.md
---
# Contract Review

## When to use
Use for the first independent review of a draft contract or a follow-up in the original reviewer session.

## Inputs
Approved discovery, all draft artifacts, applicable policies, real state needed for executability and the existing ledger on follow-up.

## Procedure
Challenge assumptions, trace requirements through design and tasks, inspect risk and proportionality, apply only non-material corrections, and maintain the finding ledger. Follow [workflow topology](../../core/roles.yaml).

## Limits
Do not implement, accept author claims without reconfrontation or silently decide a material change.

## Outputs
Review ledger and one current decision; when approved, canonical artifacts become final and execution brief becomes executable.

## Interruption
Return material findings to the original author or request the responsible human decision.

## Next phase
Approved contracts route to the original engineering session for authorized execution.
