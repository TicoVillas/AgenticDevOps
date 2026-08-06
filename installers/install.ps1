#requires -Version 7.4
$ErrorActionPreference = 'Stop'

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($null -eq $nodeCommand) {
  [Console]::Out.WriteLine('{"schema_version":1,"ok":false,"status":"NEEDS_STATE_VALIDATION","reason_code":"NODE_RUNTIME_MISSING","exit_code":3,"sanitized":true}')
  exit 3
}
$nodeMajor = & $nodeCommand.Source -p 'process.versions.node.split(".")[0]'
if ($nodeMajor -ne '24') {
  [Console]::Out.WriteLine('{"schema_version":1,"ok":false,"status":"NEEDS_STATE_VALIDATION","reason_code":"RUNTIME_UNSUPPORTED","exit_code":3,"sanitized":true}')
  exit 3
}
$bootstrap = Join-Path (Split-Path -Parent $PSScriptRoot) 'tools/installer-bootstrap.mjs'
$bootstrapArgs = @($bootstrap, '--adapter', 'POWERSHELL') + $args
& $nodeCommand.Source @bootstrapArgs
exit $LASTEXITCODE
