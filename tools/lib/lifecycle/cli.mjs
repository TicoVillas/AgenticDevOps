import { isAbsolute, normalize } from 'node:path';

export const EXIT_CODES = Object.freeze({
  OK: 0,
  USAGE: 2,
  BLOCKED: 3,
  AUTHORIZATION: 4,
  LOCKED: 5,
  UNCERTAIN: 6,
  VALIDATION: 7,
  INTERNAL: 8,
});

const COMMANDS = Object.freeze(['install', 'update', 'reconcile', 'resume', 'rollback', 'uninstall', 'inspect-plan', 'inspect-state', 'help']);
const MATERIAL = new Set(['install', 'update', 'resume', 'rollback', 'uninstall']);
const FLAGS = new Set(['--source', '--destination', '--state', '--cache', '--temp', '--authorization', '--operation-id', '--format', '--apply', '--help']);

export const HELP_TEXT = `agentic-lifecycle <command> [options]

Commands:
  install       Plan or apply a synthetic installation
  update        Plan or apply a synthetic update
  reconcile     Read-only observation of uncertain state
  resume        Resume only with a new explicit authorization
  rollback      Roll back only with a new explicit authorization
  uninstall     Plan or apply a guarded uninstall
  inspect-plan  Read-only plan inspection
  inspect-state Read-only state inspection
  help          Show this help

Required path options (no defaults):
  --source <absolute> --destination <absolute> --state <absolute>
  --cache <absolute> --temp <absolute>

Other options:
  --authorization <absolute> --operation-id <id>
  --format <human|json> --apply --help

Apply requires an explicit authorization envelope. Reconcile is always read-only.
`;

function usage(code, detail) {
  const error = new Error(detail);
  error.code = code;
  error.exitCode = EXIT_CODES.USAGE;
  throw error;
}

function validateAbsolute(value, flag) {
  if (!isAbsolute(value) || normalize(value) !== value) usage('INVALID_ABSOLUTE_PATH', `${flag} requires a normalized absolute path`);
  return value;
}

export function parseLifecycleArgs(argv) {
  if (!Array.isArray(argv)) usage('INVALID_ARGUMENT_VECTOR', 'arguments must be an array');
  const command = argv[0] ?? 'help';
  if (!COMMANDS.includes(command)) usage('UNKNOWN_COMMAND', `unknown command: ${command}`);
  const options = { apply: false };
  for (let index = 1; index < argv.length; index += 1) {
    const flag = argv[index];
    if (!FLAGS.has(flag)) usage('UNKNOWN_OPTION', `unknown option: ${flag}`);
    if (flag === '--apply') {
      if (options.apply) usage('DUPLICATE_OPTION', 'duplicate option: --apply');
      options.apply = true;
      continue;
    }
    if (flag === '--help') return Object.freeze({ command: 'help', options: Object.freeze({ format: options.format ?? 'human', apply: false }) });
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) usage('MISSING_OPTION_VALUE', `${flag} requires a value`);
    index += 1;
    const key = flag.slice(2).replaceAll('-', '_');
    if (Object.hasOwn(options, key)) usage('DUPLICATE_OPTION', `duplicate option: ${flag}`);
    options[key] = ['source', 'destination', 'state', 'cache', 'temp', 'authorization'].includes(key) ? validateAbsolute(value, flag) : value;
  }
  options.format ??= 'human';
  if (command === 'help') return Object.freeze({ command, options: Object.freeze(options) });
  if (!['human', 'json'].includes(options.format)) usage('INVALID_FORMAT', '--format must be human or json');
  for (const name of ['source', 'destination', 'state', 'cache', 'temp']) if (!options[name]) usage('MISSING_REQUIRED_OPTION', `--${name} is required; no HOME-derived default exists`);
  if (command === 'reconcile' && options.apply) usage('RECONCILE_READ_ONLY', 'reconcile cannot apply mutations');
  if (command === 'resume' && !options.apply) usage('RESUME_REQUIRES_APPLY', 'resume requires --apply and a fresh authorization');
  if (options.apply && !MATERIAL.has(command)) usage('APPLY_NOT_SUPPORTED', `${command} is read-only`);
  if (options.apply && !options.authorization) usage('AUTHORIZATION_REQUIRED', '--authorization is required for apply');
  return Object.freeze({ command, options: Object.freeze(options) });
}

const REDACTION_PATTERNS = [
  /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /(?:gh[pousr]_|github_pat_|npm_)[A-Za-z0-9_]+/gi,
  /-----BEGIN(?: [A-Z0-9]+)? PRIVATE KEY-----.*?-----END(?: [A-Z0-9]+)? PRIVATE KEY-----/gi,
  /(?:AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN|GITHUB_TOKEN|NPM_TOKEN|SSH_AUTH_SOCK|GPG_AGENT_INFO)\s*[:=]\s*[^\s,;]+/gi,
  /(?:token|secret|password|authorization|prompt|file_content)\s*[:=]\s*[^,;]+/gi,
  /(?:\/home\/[^/\s]+|[A-Za-z]:\\Users\\[^\\\s]+)/g,
];

export function sanitizeMessage(value) {
  let output = String(value ?? 'operation failed').replace(/[\r\n\t]+/g, ' ');
  for (const pattern of REDACTION_PATTERNS) output = output.replace(pattern, '[REDACTED]');
  return output.replace(/\s+/g, ' ').trim().slice(0, 512) || 'operation failed';
}

export function reasonCode(error) {
  const candidate = String(error?.code ?? error?.message ?? 'INTERNAL_ERROR').split(':', 1)[0].toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  return /^[A-Z][A-Z0-9_]*$/.test(candidate) ? candidate : 'INTERNAL_ERROR';
}

export function exitCodeFor(code) {
  if (/^(?:UNKNOWN|PARTIAL)/.test(code)) return EXIT_CODES.UNCERTAIN;
  if (/AUTHORIZATION|EXPIRED|SCOPE/.test(code)) return EXIT_CODES.AUTHORIZATION;
  if (/LOCK/.test(code)) return EXIT_CODES.LOCKED;
  if (/INVALID|DIVERGED|MISMATCH|UNSAFE|OUTSIDE|TRAVERSAL|SYMLINK|TYPE|VALIDATION/.test(code)) return EXIT_CODES.VALIDATION;
  if (/BLOCKED|NOT_AUTHORIZED|REQUIRED/.test(code)) return EXIT_CODES.BLOCKED;
  return EXIT_CODES.INTERNAL;
}

export function structuredResult({ command, ok, status, reason = null, exitCode = ok ? EXIT_CODES.OK : exitCodeFor(reason ?? 'INTERNAL_ERROR'), operationId = null, result = null, errors = [] }) {
  return Object.freeze({
    schema_version: 1,
    command,
    ok,
    status,
    reason_code: reason,
    exit_code: exitCode,
    operation_id: operationId,
    result,
    errors: errors.map((error) => Object.freeze({ code: reasonCode(error), message: sanitizeMessage(error?.message ?? error) })),
    sanitized: true,
  });
}

export function formatLifecycleResult(result, format = 'human') {
  if (format === 'json') return `${JSON.stringify(result)}\n`;
  const parts = [result.ok ? 'OK' : 'ERROR', result.status];
  if (result.reason_code) parts.push(result.reason_code);
  if (result.operation_id) parts.push(result.operation_id);
  return `${parts.join(' ')}\n`;
}

export async function runLifecycleCli(argv, { execute }) {
  try {
    const parsed = parseLifecycleArgs(argv);
    if (parsed.command === 'help') return { exitCode: EXIT_CODES.OK, output: HELP_TEXT, result: structuredResult({ command: 'help', ok: true, status: 'COMPLETED' }) };
    if (typeof execute !== 'function') throw Object.assign(new Error('lifecycle executor unavailable'), { code: 'EXECUTOR_UNAVAILABLE' });
    const result = await execute(parsed);
    return { exitCode: result.exit_code, output: formatLifecycleResult(result, parsed.options.format), result };
  } catch (error) {
    const code = reasonCode(error);
    const exitCode = error?.exitCode ?? exitCodeFor(code);
    const command = COMMANDS.includes(argv?.[0]) ? argv[0] : 'help';
    const result = structuredResult({ command, ok: false, status: exitCode === EXIT_CODES.USAGE ? 'USAGE_ERROR' : 'BLOCKED', reason: code, exitCode, errors: [error] });
    const format = argv?.includes('--format') && argv[argv.indexOf('--format') + 1] === 'json' ? 'json' : 'human';
    return { exitCode, output: formatLifecycleResult(result, format), result };
  }
}
