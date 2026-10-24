# commander PreToolUse(Bash) hook — blocks a small set of destructive / secret-exposing
# commands (exit code 2 = block). Fail-soft: any parse error allows the command (exit 0).
# No network. Narrow patterns to avoid false positives.
$ErrorActionPreference = 'SilentlyContinue'
try {
    $raw = [Console]::In.ReadToEnd()
    if (-not $raw) { exit 0 }
    $data = $raw | ConvertFrom-Json
    $cmd = [string]$data.tool_input.command
    if (-not $cmd) { exit 0 }

    $patterns = @(
        'git\s+reset\s+--hard',
        'git\s+clean\s+-\S*f',
        'git\s+push\s+[^\n]*(--force\b|--force-with-lease\b|\s-f\b)',
        'supabase\s+db\s+(reset|push)',
        'drop\s+(table|schema|database)\b',
        '(^|\s)(cat|type|Get-Content)\s+[^\n|]*\.env'
    )
    foreach ($p in $patterns) {
        if ($cmd -imatch $p) {
            [Console]::Error.WriteLine("BLOCKED by commander git-safety hook: matches destructive/secret pattern '$p'. Run it manually outside the agent if truly intended.")
            exit 2
        }
    }
} catch { exit 0 }
exit 0
