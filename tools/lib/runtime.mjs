export function checkRuntime({ nodeVersion = process.versions.node, npmVersion = null } = {}) {
  const errors = [];
  const nodeMajor = Number.parseInt(String(nodeVersion).split('.')[0], 10);
  if (nodeMajor !== 24) errors.push(`Node.js major 24 required; received ${nodeVersion ?? 'missing'}`);
  if (!npmVersion || !/^\d+\.\d+\.\d+/.test(String(npmVersion))) errors.push('npm version is missing or invalid');
  return {
    ok: errors.length === 0,
    status: errors.length === 0 ? 'READY' : 'NEEDS_STATE_VALIDATION',
    nodeVersion,
    npmVersion,
    errors,
  };
}

export function npmVersionFromUserAgent(userAgent = process.env.npm_config_user_agent) {
  return /npm\/([^\s]+)/.exec(userAgent ?? '')?.[1] ?? null;
}
