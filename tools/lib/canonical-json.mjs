import { createHash } from 'node:crypto';

function canonicalize(value, ancestors, path) {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`NON_FINITE_NUMBER:${path}`);
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (typeof value === 'undefined') throw new TypeError(`UNDEFINED_VALUE:${path}`);
  if (typeof value !== 'object') throw new TypeError(`UNSUPPORTED_VALUE:${path}`);
  if (ancestors.has(value)) throw new TypeError(`CYCLIC_VALUE:${path}`);
  if (Object.getPrototypeOf(value) !== Object.prototype && !Array.isArray(value)) throw new TypeError(`UNSUPPORTED_OBJECT:${path}`);

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      const entries = [];
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.hasOwn(value, index)) throw new TypeError(`UNDEFINED_VALUE:${path}[${index}]`);
        entries.push(canonicalize(value[index], ancestors, `${path}[${index}]`));
      }
      return `[${entries.join(',')}]`;
    }
    const entries = [];
    for (const key of Object.keys(value).sort()) entries.push(`${JSON.stringify(key)}:${canonicalize(value[key], ancestors, `${path}.${key}`)}`);
    return `{${entries.join(',')}}`;
  } finally {
    ancestors.delete(value);
  }
}

export function canonicalJson(value) {
  return canonicalize(value, new Set(), '$');
}

export function canonicalJsonBytes(value) {
  return Buffer.from(canonicalJson(value), 'utf8');
}

export function canonicalSha256(value) {
  return createHash('sha256').update(canonicalJsonBytes(value)).digest('hex');
}
