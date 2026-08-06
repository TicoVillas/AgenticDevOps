<!-- GENERATED; DO NOT EDIT -->

# v2.4 to v3.0 Behavioral Equivalence

**Decision:** NO_UNAUTHORIZED_MATERIAL_DIFFERENCE

| Behavior | v2.4 source | v3.0 source | Classification | Evidence |
|---|---|---|---|---|
| Canonical phases and gates | Kiro_v2_4_source/Controls/workflow-core.md | core/workflow.yaml | PRESERVED | Fourteen phases and human final-review/closeout gates remain represented. |
| Roles and assurance separation | Kiro_v2_4_source/Controls/workflow-core.md | core/roles.yaml | STRUCTURAL_EQUIVALENT | Responsibilities are normalized into four tool-neutral roles. |
| Author/reviewer/validator continuity | Kiro_v2_4_source/Contracts/ContextPolicy.md | core/roles.yaml; decisions/DEC-001-session-topology.md | PRESERVED | Initial assurance stays independent and follow-ups return to original sessions. |
| Per-operation authorization | Kiro_v2_4_source/Contracts/GitSafetyPolicy.md | core/workflow.yaml; tools/lib/transition.mjs | PRESERVED | Chaining cannot create or expand authority. |
| Security and high-risk controls | Kiro_v2_4_source/Contracts/SecureDevelopmentPolicy.md | policies/SecureDevelopmentPolicy.md; policies/HighRiskOverlay.md | STRUCTURAL_EQUIVALENT | Normative controls are separated from procedures and remain fail-closed. |
| Artifact lifecycle | Kiro_v2_4_source/Contracts/ArtifactContract.md | contracts/schemas/; contracts/templates/ | STRUCTURAL_EQUIVALENT | Schemas govern structure and templates govern presentation. |
| Ten operational Skills | Kiro_v2_4_source/Skills/ | skills/; generated/skills/ | STRUCTURAL_EQUIVALENT | The ten Skills remain, with one concise manual source each. |
| Capability selection | Kiro_v2_4_source/Contracts/ModelSelectionPolicy.md | policies/CapabilitySelectionPolicy.md; adapters/ | INTENTIONAL_NON_MATERIAL_CHANGE | Concrete runtime catalogs move to adapters without changing authority or workflow. |
| Project configuration root | Kiro_v2_4_source/Controls/AGENTS.md | .agentic/ canonical; adapters/kiro/ compatibility | INTENTIONAL_COMPATIBILITY_CHANGE | .agentic becomes canonical while .kiro remains a non-normative adapter layer. |
| Router compatibility | Kiro_v2_4_source/Controls/DiscoveryRouter.md | core/WorkflowRouter.md; adapters/kiro/generated/DiscoveryRouter.md | INTENTIONAL_COMPATIBILITY_CHANGE | The legacy name remains as a generated warning alias under the versioned lifecycle. |
| Automation and checkpoints | Kiro_v2_4_source/Controls/workflow-core.md | core/workflow.yaml; tools/lib/dry-run.mjs; tools/lib/transition.mjs | STRUCTURAL_EQUIVALENT | Safe deterministic transitions automate; material human checkpoints remain explicit. |
