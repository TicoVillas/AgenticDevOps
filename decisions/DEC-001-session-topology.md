# DEC-001 — Session Topology

- **Status:** ACCEPTED
- **Version:** 3.0.0

## Context

Engineering continuity preserves technical context, while initial assurance must avoid author confirmation bias.

## Decision

Production work resumes the engineering-author session. The first contract review and first delivery validation use new independent sessions; follow-ups resume their original assurance session.

## Alternatives

- A new session for every phase was rejected because it discards useful continuity.
- One session for all roles was rejected because it defeats independent assurance.

## Consequences

Adapters must preserve logical session identity even when physical processes differ. Transition validation blocks incompatible topology.

## References

- [Canonical roles](../core/roles.yaml)
- [Canonical workflow](../core/workflow.yaml)
