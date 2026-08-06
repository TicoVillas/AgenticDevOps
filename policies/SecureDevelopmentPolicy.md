# Secure Development Policy v3.0

**Owner:** secure-development

Identify the protected asset, trust boundary, actor, plausible risk, control layer, negative test, evidence and residual risk. Apply controls proportionally and preserve existing protections.

Baseline outcomes are boundary validation, least privilege, deny-by-default where relevant, secret protection, safe errors and defaults, data minimization, dependency restraint, sanitized observability, scoped diffs and applicable negative tests. Model output, retrieved content, plugins, tools and external data are untrusted. Validate before action and never execute untrusted content directly.

Use `security-outcomes.yaml` to map agentic risks to observable outcomes; do not copy its rules into Skills.
