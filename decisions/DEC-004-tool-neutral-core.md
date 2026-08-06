# DEC-004 — Tool-Neutral Core

- **Status:** ACCEPTED
- **Version:** 3.0.0

## Context

Concrete runtime catalogs change independently from workflow semantics and create coupling when embedded in core policy.

## Decision

Core, policies, contracts, and Skills express capabilities, effort, fallback conditions, and governance only. Concrete runtime names are resolved exclusively by adapters.

## Alternatives

- A central concrete catalog in core was rejected because it couples lifecycle and semantics.
- Model names copied into Skills were rejected because they create multiple sources.

## Consequences

Contract scans reject concrete names in normative sources. Adapter mappings carry runtime-specific resolution and fallback.

## References

- [Capability selection policy](../policies/CapabilitySelectionPolicy.md)
- [Adapter mapping](../adapters/codex/model-map.yaml)
