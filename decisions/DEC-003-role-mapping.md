# DEC-003 — Role Mapping

- **Status:** ACCEPTED
- **Version:** 3.0.0

## Context

Tools and models vary by runtime, while workflow responsibilities and separation of duties must remain stable.

## Decision

The core defines four abstract roles. Adapters map runtime capabilities to those roles without redefining responsibilities, authority, phases, or statuses.

## Alternatives

- Tool-specific roles in the core were rejected as non-portable.
- Implicit role inference from a model or session was rejected as unsafe.

## Consequences

Adapter validation rejects semantic overrides. Runtime mappings may change without changing the workflow core.

## References

- [Canonical roles](../core/roles.yaml)
- [Adapter boundary](../adapters/chatgpt/adapter.yaml)
