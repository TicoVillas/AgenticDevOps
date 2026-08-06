# Git Safety Policy v3.0

**Owner:** git-safety

Before a repository write, confirm root, branch, head, base, working tree, staged and untracked changes, operations in progress, authorized paths, writer and current authorization. Preserve one writer per working tree and attribute every delta.

Staging, commit, push, pull request, merge, branch deletion, tag, release and deploy are distinct operations. Named conditional batches are allowed only while their conditions remain true. Prefer selective staging; never infer history rewrite, cleanup, hook bypass or remote authority. Merge retains its own checkpoint, and operational effects require separate authorization.
