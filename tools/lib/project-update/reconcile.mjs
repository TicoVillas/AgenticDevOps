import { reconcileUncertainReadOnly } from '../lifecycle/reconcile.mjs';
import { GIT_OPERATIONS_NOT_AUTHORIZED } from './snapshot.mjs';

export async function reconcileProjectUpdateReadOnly({ fs, projectRoot, plan, journal, clock = () => new Date() }) {
  const mutablePlan = {
    mutable_actions: plan.actions.map((action) => ({
      item_id: action.item_id,
      path: action.path,
      action: action.action === 'CREATE' ? 'CREATE' : 'UPDATE',
      source_sha256: action.after_sha256,
      before_sha256: action.before_sha256,
    })),
  };
  const result = await reconcileUncertainReadOnly({ fs, destinationRoot: projectRoot, plan: mutablePlan, journal, clock });
  return Object.freeze({
    ...result,
    operations_not_authorized: [...new Set([...result.operations_not_authorized, ...GIT_OPERATIONS_NOT_AUTHORIZED])],
  });
}
