<!-- GENERATED FROM skills/workflow-bootstrap/SKILL.md; DO NOT EDIT -->

---
name: workflow-bootstrap
description: Validates and coordinates framework bootstrap prerequisites, installation stages, restart reconciliation, and migration when global or project workflow state is absent, stale, or conflicting.
version: 3.0.0
role: ENGINEERING
phase: workflow-bootstrap
references:
  migration: references/migration.md
---
# Workflow Bootstrap

## When to use
Use when global framework or project prerequisites are absent, stale or conflicting. Global installation, retirement, restart, rollback and project migration remain separate high-risk operations.

## Inputs
Validated adapter distribution manifest, framework lock and package identities, explicit source/destination/backup roots, read-only snapshot, prior receipt when present, planner output, mode and current authorization.

## Procedure
1. Inventory read-only and validate manifest, lock, generated payload and package.
2. Build the snapshot and consume `planDistribution`; do not infer or maintain a second source-to-destination map.
3. Stop on any blocked item, stale snapshot/authorization, incomplete backup, unexpected path/type/link, unknown partial effect or unavailable rollback.
4. Present predicted effects, backup set, retirements, rollback preview, stop criteria and prohibited operations at a supervised checkpoint.
5. Only a separately authorized Stage A may apply the validated plan. It must verify each non-self action, apply the entrypoint, retire only baseline-exact legacy files, prepare the pre-restart receipt, and write `workflow-bootstrap/SKILL.md` last.
6. After the self-update, return `RESTART_REQUIRED` immediately. No journal, receipt, evidence, project, Git or remote write may follow in that execution.
7. Stage B is a new post-restart execution and is read-only until reconciliation succeeds. Load [migration detail](references/migration.md) only for migration or post-restart work.

Follow [workflow state](../../core/workflow.yaml), [environment](../../policies/ExecutionEnvironmentPolicy.md) and [high risk](../../policies/HighRiskOverlay.md).

## Limits
Do not edit canonical source, infer paths outside the validated manifest, initialize history, target adapters outside the approved adapter scope, auto-restart, migrate a project, execute rollback, or perform real global writes without their own authorization and checkpoint.

## Outputs
Read-only inventory and plan; when separately authorized, external backup/journal/pre-restart receipt references and exactly one terminal status: `RESTART_REQUIRED`, `BLOCKED`, `PARTIAL` or `NEEDS_USER_DECISION`.

## Interruption
Stop on ambiguous roots, changed hashes or authorization, unowned changes, missing backup/rollback, mixed authority, failure after an uncertain effect, or any attempted write after self-update.

## Next phase
After Stage B proves 64/64 managed files, ten Skills, loader behavior, nine legacy absences, no mixed authority and a 64 `NO_CHANGE` second plan, route to the authorized next phase. `PROJECT_UPDATE` remains a separate transition.
