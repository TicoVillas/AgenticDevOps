# Workflow Core v3.0

This is the human view of `workflow.yaml`; the YAML is the executable source of truth.

## Roles

- `CONSULTING`: product discovery, alignment, final review and closure.
- `ENGINEERING`: technical discovery, contract authorship, execution, correction and closeout.
- `CONTRACT_ASSURANCE`: independent initial contract review and follow-up in the original reviewer session.
- `DELIVERY_ASSURANCE`: independent initial validation and revalidation in the original validator session.

## Canonical flow

`workflow-bootstrap` prepares the framework when needed. The delivery flow is `discovery-high-level → low-level-discovery → alignment → quick-spec|spec|bug-fix → contract-review → execute-contract → validate-delivery → correct-from-validation/revalidation when needed → final-review → authorized delivery-closeout → separately authorized post-operation`.

## Invariants

Authorization is per operation. Autopilot is the default only when no human intervention is pending. The current artifact and real state override session memory. Initial assurance is independent; follow-ups resume the original assurance session. One writer owns a working tree. Planning, implementation, validation, correction, Git, merge, release and deploy remain distinct authorizations.

## Automatic versus human transitions

Only `automatic_transitions` in `workflow.yaml` may chain after all guards pass. Final `CONSULTING` review and entry into `delivery-closeout` are deliberately human-authorized transitions and must never be added to the automatic allowlist.
