import { validateCompatibility, validateDecisionRecords } from './compatibility.mjs';
import { frameworkRoot } from './io.mjs';
import { verifyFrameworkLock } from './source-lock.mjs';

export async function validateSources(root = frameworkRoot) {
  const [lock, decisions, compatibility] = await Promise.all([
    verifyFrameworkLock(root),
    validateDecisionRecords(root),
    validateCompatibility({ root, version: '3.0' }),
  ]);
  const errors = [...lock.errors, ...decisions.errors, ...compatibility.errors];
  return {
    ok: errors.length === 0,
    errors,
    warnings: compatibility.warnings,
    expectedCount: lock.expectedCount,
    actualCount: lock.actualCount,
    decisionCount: decisions.count,
    compatibility: {
      version: compatibility.version,
      consumers: compatibility.consumers,
      removalEligible: compatibility.removalEligible,
    },
  };
}
