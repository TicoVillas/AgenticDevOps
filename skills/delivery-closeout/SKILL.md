---
name: delivery-closeout
description: Executes only named closeout operations after accepted technical closure when separate local or remote closeout authorization is current.
version: 3.0.0
role: ENGINEERING
phase: delivery-closeout
references:
  remote: references/remote.md
---
# Delivery Closeout

## When to use
Use after accepted technical closure and a named local or remote closeout authorization.

## Inputs
Accepted validation, final-review decision, current repository and remote state, authorized operations, conditions, checkpoints and prohibited actions.

## Procedure
Preflight current state, present the bounded batch, execute each named operation separately, revalidate conditions before writes, verify resulting state and record closeout evidence.

## Limits
Do not infer staging, history, remote, merge, deletion, tag, release, deploy, migration or rollback authority. Never bypass hooks or rewrite history by convenience.

## Outputs
Verified closeout state and `CLOSEOUT.md` separating authorized, executed, verified and not executed actions.

## Interruption
Stop on changed head, branch, delta, remote, review, checks, triggers, authorization or uncertain partial effect.

## Next phase
A separately authorized post-operation may follow; closeout itself does not authorize one.
