# DEC-002 — Autopilot Default

- **Status:** ACCEPTED
- **Version:** 3.0.0

## Context

Unnecessary handoffs slow deterministic local work, but autonomy must not create authority or bypass human decisions.

## Decision

Autopilot is the default only while authorization is current, guards pass, no material decision is pending, and no required checkpoint applies.

## Alternatives

- Mandatory supervision for every step was rejected as disproportionate.
- Unbounded autonomy was rejected because mode cannot grant authorization.

## Consequences

Dry-run and transition classifiers remain fail-closed. Remote, material, and high-risk effects continue to require their own controls.

## References

- [Workflow invariants](../core/workflow-core.md)
- [Dry-run rules](../policies/dry-run-rules.yaml)
