# Operational Retention Policy

This document is the single normative source for lifecycle retention. Consumers must parse the machine-readable block and must not duplicate its values.

```yaml
retention_policy:
  schema_version: 1
  records:
    receipts: INDEFINITE
    journals: INDEFINITE
    tombstones: INDEFINITE
  backups:
    installation_original: ENTIRE_INSTALLATION
    successful_versions:
      minimum_count: 3
      minimum_days: 90
    post_uninstall_days: 30
  legal_holds:
    outcomes: [UNKNOWN, PARTIAL]
    reconciliation_states: [UNRECONCILED]
```

A purge decision is fail-closed when timestamps, version ordering, operation outcome, or reconciliation state are missing or invalid. A legal hold overrides every finite backup retention rule.
