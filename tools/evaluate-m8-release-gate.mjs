import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { evaluateImmutabilityGate } from './lib/release-security.mjs';

function fail(code, detail = '') {
  throw new Error(detail ? `${code}:${detail}` : code);
}

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined) fail('INVALID_GATE_ARGUMENTS');
    values[key.slice(2)] = value;
  }
  return values;
}

export function evaluateWorkflowImmutabilityGate(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('GATE_INPUT_REQUIRED');
  let compensatingControl;
  if (input.compensatingControlJson !== undefined && input.compensatingControlJson !== '') {
    try { compensatingControl = JSON.parse(input.compensatingControlJson); }
    catch { fail('INVALID_COMPENSATING_CONTROL_JSON'); }
  }
  const decision = evaluateImmutabilityGate({
    releaseId: input.releaseId,
    observedAt: input.observedAt,
    providerCapability: input.providerCapability,
    nativeImmutable: input.nativeImmutable === true || input.nativeImmutable === 'true',
    compensatingControl,
    expectedAuthorizationSha256: input.expectedAuthorizationSha256,
  });
  return Object.freeze({ ...decision, authorization_granted: false });
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  const args = parseArgs(process.argv.slice(2));
  const decision = evaluateWorkflowImmutabilityGate({
    releaseId: args['release-id'],
    observedAt: args['observed-at'],
    providerCapability: args['provider-capability'],
    nativeImmutable: args['native-immutable'],
    compensatingControlJson: args['compensating-control-json'],
    expectedAuthorizationSha256: args['expected-authorization-sha256'],
  });
  console.log(JSON.stringify(decision));
  if (decision.result !== 'READY' || decision.publish_authorized !== false || decision.checkpoint_required !== true) process.exitCode = 1;
}
