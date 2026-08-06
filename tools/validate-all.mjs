import { resolve } from 'node:path';
import { readResponseSnapshot, validateAdapters, validateHandoff } from './lib/adapters.mjs';
import { validateArtifacts } from './lib/artifacts.mjs';
import { validateDryRun } from './lib/dry-run.mjs';
import { validateDistributionManifest } from './lib/distribution.mjs';
import { frameworkRoot, readYaml } from './lib/io.mjs';
import { validateM2Contracts } from './lib/m2-contracts.mjs';
import { validateM4Release } from './validate-m4-release.mjs';
import { validateM5Lifecycle } from './validate-m5-lifecycle.mjs';
import { validateM6ProjectUpdate } from './validate-m6-project-update.mjs';
import { validateM7Installers } from './validate-m7-installers.mjs';
import { validateM8Ci } from './validate-m8-ci.mjs';
import { validatePolicies, validateSelectionBoundaries } from './lib/policies.mjs';
import { validateRetention } from './lib/retention.mjs';
import { validateApplicationProfile } from './lib/profile.mjs';
import { validateReports } from './lib/reports.mjs';
import { validateSkills } from './lib/skills.mjs';
import { validateSources } from './lib/sources.mjs';
import { validateSpecTraceability } from './lib/spec-traceability.mjs';
import { validateTransition } from './lib/transition.mjs';
import { validateWorkflow } from './lib/workflow.mjs';

const defaultProfile = await readYaml(resolve(frameworkRoot, 'contracts/templates/application-profile.yaml'));
const defaultDryRun = await readYaml(resolve(frameworkRoot, 'contracts/templates/dry-run-manifest.yaml'));
const defaultTransition = await readYaml(resolve(frameworkRoot, 'contracts/templates/transition-manifest.yaml'));
const defaultHandoff = await readResponseSnapshot(resolve(frameworkRoot, 'tests/adapters/snapshots/handoff.json'));
const checks = [
  ['workflow', await validateWorkflow()],
  ['artifacts', await validateArtifacts()],
  ['m2-contracts', await validateM2Contracts()],
  ['m4-release', await validateM4Release()],
  ['m5-lifecycle', await validateM5Lifecycle()],
  ['m6-project-update', await validateM6ProjectUpdate()],
  ['m7-installers', await validateM7Installers()],
  ['m8-ci-release', await validateM8Ci()],
  ['policies', await validatePolicies()],
  ['retention', await validateRetention()],
  ['selection-boundaries', await validateSelectionBoundaries()],
  ['application-profile', await validateApplicationProfile({ profile: defaultProfile })],
  ['dry-run', await validateDryRun(defaultDryRun)],
  ['distribution', await validateDistributionManifest()],
  ['transition', await validateTransition(defaultTransition)],
  ['skills', await validateSkills()],
  ['adapters', await validateAdapters()],
  ['handoff', await validateHandoff(defaultHandoff)],
  ['reports', await validateReports()],
  ['spec-traceability', await validateSpecTraceability()],
  ['sources', await validateSources()],
];
const failed = checks.filter(([, result]) => !result.ok);
for (const [name, result] of checks) console.log(JSON.stringify({ check: name, ...result }));
if (failed.length) process.exitCode = 1;
else console.log(JSON.stringify({ status: 'VALID', checks: checks.length }));
