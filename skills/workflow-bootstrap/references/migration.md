# Conditional migration and post-restart detail

Load this reference only for an existing installation, recovery, or Stage B validation. The adapter distribution manifest is the sole source-to-destination map; do not reproduce its managed entries here.

## Stage A preflight and checkpoint

Confirm explicit roots, manifest/lock/package/generated identities, source integrity, snapshot identity, prior provenance, current authorization, plan decision, backup target, rollback and observability. Present predicted effects, exact legacy retirements, backup set, stop criteria and prohibited operations. Any drift, unmanaged conflict, modified legacy file, symlink/type/containment issue, unknown effect or incomplete backup is `BLOCKED`.

For a separately authorized synthetic or future real Stage A, verify every operation in planner order. The entrypoint must be verified before baseline-exact retirements. Prepare the external pre-restart receipt with `pending_action: skill-bootstrap`; it must not claim self-update success. Write `skills/workflow-bootstrap/SKILL.md` last, return `RESTART_REQUIRED`, and hard-stop without another file, journal, receipt, evidence, project, Git or remote write.

## Stage B read-only flow

Stage B requires a real restart and a new execution. It is not called by Stage A. In read-only mode:

1. confirm new process/session and loaded v3 bootstrap Skill;
2. reconcile journal, pre-restart receipt and the observed self-update hash;
3. validate manifest, lock, package and generated payload identities;
4. rebuild the destination snapshot and prove 64/64 paths, hashes and applicable metadata;
5. resolve relative references and directly observe the `agentic-workflow.md` loader plus all ten Skills;
6. prove all nine legacy paths absent and mixed authority absent;
7. run the planner again and require 64 `NO_CHANGE`, zero mutable action and no new backup;
8. verify the rollback plan without executing it;
9. only after direct observation, finalize the receipt.

Loader observation, Windows ACL/atomicity on a Windows host, restart, real Stage A/B, real rollback and the pilot are not simulated as proof. `PROJECT_UPDATE` for a pilot is a later, separately authorized transition. Adapters outside the approved adapter scope, Git, release and deploy remain outside this flow.
