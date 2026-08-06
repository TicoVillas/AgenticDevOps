# Capability Selection Policy v3.0

**Owner:** capability-selection

Selection belongs to each round and expresses only minimum capabilities, reasoning effort, context capacity, tool needs, maturity, governance constraints and a bounded fallback. The selected capability never grants authorization.

## Decision

1. Classify complexity, ambiguity, risk, duration and verifiability.
2. Require the minimum adequate reasoning, context and tool capabilities.
3. Prefer a stable option when capability is equivalent.
4. Record selected capability, effort, fallback and objective fallback condition.
5. Resolve concrete runtime availability only through an adapter.
6. Stop when fallback would materially reduce assurance or violate governance.

Concrete provider catalogs, product names and runtime identifiers are forbidden in this policy and in the core.
