# Workflow Router v3.0

The router reads `workflow.yaml`, `roles.yaml`, `statuses.yaml`, the current canonical artifact, current authorization and real state.

It returns exactly:

- current phase and role;
- current canonical artifact and status;
- assurance level;
- next valid phase;
- required session strategy;
- missing decision or authorization;
- `CHAINED`, `CHECKPOINT_REQUIRED` or `BLOCKED` when evaluating automatic chaining.

It never reproduces Skill procedures or policy text, never creates authority, and never converts final review or closeout entry into automatic edges.
