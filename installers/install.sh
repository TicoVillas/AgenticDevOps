#!/usr/bin/env bash
set -euo pipefail

if (( BASH_VERSINFO[0] < 5 )); then
  printf '%s\n' '{"schema_version":1,"ok":false,"status":"NEEDS_STATE_VALIDATION","reason_code":"BASH_RUNTIME_UNSUPPORTED","exit_code":3,"sanitized":true}'
  exit 3
fi
if ! node_bin=$(command -v node); then
  printf '%s\n' '{"schema_version":1,"ok":false,"status":"NEEDS_STATE_VALIDATION","reason_code":"NODE_RUNTIME_MISSING","exit_code":3,"sanitized":true}'
  exit 3
fi
node_major=$($node_bin -p 'process.versions.node.split(".")[0]')
if [[ $node_major != 24 ]]; then
  printf '%s\n' '{"schema_version":1,"ok":false,"status":"NEEDS_STATE_VALIDATION","reason_code":"RUNTIME_UNSUPPORTED","exit_code":3,"sanitized":true}'
  exit 3
fi
script_dir=${BASH_SOURCE[0]%/*}
exec "$node_bin" "$script_dir/../tools/installer-bootstrap.mjs" --adapter BASH "$@"
