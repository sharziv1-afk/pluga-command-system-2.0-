# commander Stop hook — reminds to run preflight when the tree has edits. Fail-soft.
$ErrorActionPreference = 'SilentlyContinue'
try {
    $root = (& git rev-parse --show-toplevel 2>$null)
    if (-not $root) { exit 0 }
    $status = (& git -C $root status --porcelain 2>$null)
    if ($status) {
        Write-Output "[commander] Working tree has changes. Run: .\.ai-workspace\bin\ai.cmd preflight -Mode quick   (no commit/push without approval)."
    }
} catch { }
exit 0
