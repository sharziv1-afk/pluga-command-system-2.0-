# commander SubagentStop hook — appends a minimal line (no transcript). Fail-soft.
$ErrorActionPreference = 'SilentlyContinue'
try {
    [Console]::In.ReadToEnd() | Out-Null
    $root = (& git rev-parse --show-toplevel 2>$null)
    if (-not $root) { exit 0 }
    $logDir = Join-Path $root '.ai-workspace\logs'
    if (-not (Test-Path -LiteralPath $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
    $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Add-Content -LiteralPath (Join-Path $logDir 'subagents.log') -Value "$stamp  subagent stopped" -Encoding UTF8
} catch { }
exit 0
