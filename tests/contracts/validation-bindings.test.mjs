import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { frameworkRoot } from '../../tools/lib/io.mjs';
import {
  loadValidationBindingContract,
  observeValidationBinding,
  resolveBindingContext,
  validateBindingObservation,
  validateValidationBinding,
} from '../../tools/lib/validation-bindings.mjs';

const milestones = ['M5', 'M6', 'M7', 'M8'];

async function loadedContract() {
  const loaded = await loadValidationBindingContract();
  assert.equal(loaded.ok, true, loaded.errors.join('\n'));
  return loaded.contract;
}

function historicalObservation(contract, canonical) {
  const descriptor = contract.contexts.HISTORICAL_MILESTONE_BINDING;
  const observation = structuredClone(canonical);
  observation.root.logical_source_root = descriptor.root_binding.logical_source_root;
  observation.package.name = descriptor.root_binding.package_name;
  observation.package.version = descriptor.root_binding.package_version;
  observation.package.repository = null;
  observation.package.lock_name = descriptor.root_binding.package_name;
  observation.package.lock_version = descriptor.root_binding.package_version;
  observation.package.lock_root_name = descriptor.root_binding.package_name;
  observation.package.lock_root_version = descriptor.root_binding.package_version;
  for (const name of ['package_json', 'package_lock', 'distribution_manifest', 'framework_lock']) {
    observation.artifacts[name].sha256 = descriptor.artifacts[name].sha256;
  }
  return observation;
}

test('canonical checkout binding validates the real 3.1.0 root for M5-M8', async () => {
  for (const milestone of milestones) {
    const result = await validateValidationBinding(frameworkRoot, { milestone });
    assert.equal(result.ok, true, `${milestone}: ${result.errors.join('\n')}`);
    assert.equal(result.binding_context, 'CANONICAL_CHECKOUT_BINDING');
    assert.equal(result.binding_contract_version, 1);
  }
});

test('historical milestone hashes remain explicit and independently verifiable', async () => {
  const contract = await loadedContract();
  const canonical = await observeValidationBinding();
  const historical = historicalObservation(contract, canonical);
  for (const milestone of milestones) {
    const result = validateBindingObservation(contract, 'HISTORICAL_MILESTONE_BINDING', historical, milestone);
    assert.equal(result.ok, true, `${milestone}: ${result.errors.join('\n')}`);
  }
});

test('historical context rejects the canonical lock and canonical context rejects the historical lock', async () => {
  const contract = await loadedContract();
  const canonical = await observeValidationBinding();
  const historical = historicalObservation(contract, canonical);
  const historicalWithCanonical = validateBindingObservation(contract, 'HISTORICAL_MILESTONE_BINDING', canonical, 'M8');
  assert.equal(historicalWithCanonical.ok, false);
  assert(historicalWithCanonical.errors.includes('package-lock.json: SHA256_MISMATCH'));
  const canonicalWithHistorical = validateBindingObservation(contract, 'CANONICAL_CHECKOUT_BINDING', historical, 'M8');
  assert.equal(canonicalWithHistorical.ok, false);
  assert(canonicalWithHistorical.errors.includes('package-lock.json: SHA256_MISMATCH'));
});

test('missing unknown or conflicting context fails without fallback', async () => {
  const contract = await loadedContract();
  const missing = structuredClone(contract);
  delete missing.active_context;
  assert.equal(resolveBindingContext(missing).ok, false);
  assert(resolveBindingContext(missing).errors.includes('BINDING_CONTEXT_REQUIRED'));
  const unknown = resolveBindingContext(contract, 'CURRENT');
  assert.equal(unknown.ok, false);
  assert(unknown.errors.includes('BINDING_CONTEXT_UNKNOWN'));
  const ambiguous = resolveBindingContext(contract, 'HISTORICAL_MILESTONE_BINDING');
  assert.equal(ambiguous.ok, false);
  assert(ambiguous.errors.includes('BINDING_CONTEXT_AMBIGUOUS'));
});

test('canonical binding rejects hash version and root alterations independently', async () => {
  const contract = await loadedContract();
  const canonical = await observeValidationBinding();
  const mutations = [
    (value) => { value.artifacts.package_lock.sha256 = '0'.repeat(64); },
    (value) => { value.package.version = '3.1.1'; },
    (value) => { value.root.logical_source_root = 'framework'; },
    (value) => { value.root.realpath_stable = false; },
  ];
  for (const mutate of mutations) {
    const changed = structuredClone(canonical);
    mutate(changed);
    assert.equal(validateBindingObservation(contract, 'CANONICAL_CHECKOUT_BINDING', changed, 'M8').ok, false);
  }
});

test('M5-M8 validators delegate context selection and contain no historical hash fallback', async () => {
  const oldHash = '3a5a335b5c5250443608441eeb45353793e1a58393515e14e975d70de6e58846';
  for (const path of [
    'tools/validate-m5-lifecycle.mjs',
    'tools/validate-m6-project-update.mjs',
    'tools/validate-m7-installers.mjs',
    'tools/validate-m8-ci.mjs',
  ]) {
    const source = await readFile(resolve(frameworkRoot, path), 'utf8');
    assert(source.includes('validateValidationBinding'), path);
    assert.equal(source.includes(oldHash), false, path);
    assert.equal(/basename\(|endsWith\(['"]AgenticDevOps-Canonical/.test(source), false, path);
  }
});
