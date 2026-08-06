import { frameworkRoot } from './io.mjs';
import { validateArtifact } from './artifacts.mjs';

export const comparisonResults = Object.freeze([
  'MATCH',
  'USER_SELECTED_ALTERNATIVE',
  'FALLBACK_USED',
  'NOT_REPORTED',
]);

const recommendedFields = Object.freeze(['family', 'model', 'effort', 'agent_workflow', 'mode']);
const fallbackFields = Object.freeze(['family', 'model', 'effort']);

function fieldsMatch(left, right, fields) {
  return Boolean(left && right && fields.every((field) => left[field] === right[field]));
}

export function isValidFallbackSelection(selection) {
  const effective = selection?.effective_selection;
  const fallback = selection?.selection_guidance?.fallback_guidance;
  return Boolean(
    effective?.fallback_used === true
    && effective?.alternative_used === true
    && fieldsMatch(effective, fallback, fallbackFields),
  );
}

export function compareSelection(selection) {
  const effective = selection?.effective_selection;
  if (!effective) return 'NOT_REPORTED';
  if (isValidFallbackSelection(selection)) return 'FALLBACK_USED';
  if (fieldsMatch(effective, selection?.selection_guidance?.recommended, recommendedFields)) return 'MATCH';
  return 'USER_SELECTED_ALTERNATIVE';
}

export function validateSelectionComparison(selection) {
  const errors = [];
  const comparisonResult = compareSelection(selection);
  const effective = selection?.effective_selection;

  if (selection?.comparison_result !== comparisonResult) {
    errors.push(`Declared comparison_result ${selection?.comparison_result ?? '<missing>'} differs from computed ${comparisonResult}`);
  }

  if (effective) {
    if (effective.recorded_before_preflight !== true) errors.push('effective_selection must be recorded before preflight');
    if (comparisonResult === 'MATCH' && (effective.alternative_used || effective.fallback_used)) {
      errors.push('MATCH requires alternative_used=false and fallback_used=false');
    }
    if (comparisonResult === 'USER_SELECTED_ALTERNATIVE' && (effective.alternative_used !== true || effective.fallback_used !== false)) {
      errors.push('USER_SELECTED_ALTERNATIVE requires alternative_used=true and fallback_used=false');
    }
    if (comparisonResult === 'FALLBACK_USED' && !isValidFallbackSelection(selection)) {
      errors.push('FALLBACK_USED requires the effective family, model, and effort to match fallback guidance');
    }
  }

  return { ok: errors.length === 0, errors, comparisonResult };
}

export async function validateSelection(selection, { root = frameworkRoot } = {}) {
  const structural = await validateArtifact('execution-selection', selection, root);
  const comparison = validateSelectionComparison(selection);
  const errors = [...structural.errors, ...comparison.errors];
  const blocked = comparison.comparisonResult === 'NOT_REPORTED';
  return {
    ok: errors.length === 0 && !blocked,
    errors,
    warnings: [],
    findings: [],
    blocked,
    structurallyValid: structural.ok,
    comparisonValid: comparison.ok,
    comparisonResult: comparison.comparisonResult,
  };
}
