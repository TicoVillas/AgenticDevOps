# Execution Environment Policy v3.0

**Owner:** execution-environment

Detect surface, host, shell, workspace, roots, runtime, package manager, paths, permissions and action class before a material command. Use native syntax and explicit working directories. Host-specific syntax and surface integration belong to adapters, not this universal policy.

Actions are classified as read-only, local ephemeral, local write, destructive local, remote read, remote write or high-risk real. Fix destinations, contain paths, sanitize commands, record exit codes and effects, clean only owned temporaries, and never retry a stateful write while its effect is uncertain. A mode of autonomy does not grant authority.
