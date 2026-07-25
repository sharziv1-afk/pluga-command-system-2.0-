# commander SessionStart hook — prints repo context. Fail-soft, no network, no secrets.
$ErrorActionPreference = 'SilentlyContinue'
try {
    $root = (& git rev-parse --show-toplevel 2>$null)
    if (-not $root) { exit 0 }
    $branch = (& git -C $root branch --show-current 2>$null)
    $head = (& git -C $root rev-parse --short HEAD 2>$null)
    $status = (& git -C $root status --porcelain 2>$null)
    $state = if ($status) { 'DIRTY' } else { 'clean' }
    Write-Output "[commander] repo=$root branch=$branch head=$head tree=$state"
    Write-Output "[commander] Workflow source: .ai-workspace/ (ACTIONS.md, ROLE-MATRIX.md, WORKFLOW.md). Run preflight before edits; no commit/push or Notion writes without explicit approval."
} catch { }
exit 0
