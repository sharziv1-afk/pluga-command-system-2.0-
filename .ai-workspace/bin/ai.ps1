[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('help', 'plan', 'design', 'implement', 'run', 'qa', 'review', 'security', 'performance', 'release', 'handoff', 'sync-notion', 'context', 'preflight', 'worktree', 'clean')]
    [string]$Command = 'help',

    [ValidateSet('quick', 'focused', 'full', 'report-only')]
    [string]$Mode = 'report-only',

    [ValidateSet('create', 'list', 'path', 'status', 'remove', 'prune-preview')]
    [string]$Operation = 'list',

    [string]$TaskSlug,
    [switch]$DryRun,
    [switch]$Apply,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding

function Stop-Ai {
    param([string]$Message)
    [Console]::Error.WriteLine("ERROR: $Message")
    exit 1
}

function Get-GitText {
    param([string[]]$Arguments)
    $output = & git @Arguments
    if ($LASTEXITCODE -ne 0) {
        Stop-Ai "Git failed: git $($Arguments -join ' ')"
    }
    return (($output | Out-String).Trim())
}

function Get-RepoRoot {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        Stop-Ai 'Git is not available on PATH.'
    }
    return Get-GitText @('rev-parse', '--show-toplevel')
}

$RepoRoot = Get-RepoRoot
$WorkspaceRoot = Join-Path $RepoRoot '.ai-workspace'

function Show-Context {
    $branch = Get-GitText @('-C', $RepoRoot, 'branch', '--show-current')
    $head = Get-GitText @('-C', $RepoRoot, 'rev-parse', 'HEAD')
    $status = Get-GitText @('-C', $RepoRoot, 'status', '--short')
    Write-Host "Repository: $RepoRoot"
    Write-Host "Branch:     $branch"
    Write-Host "HEAD:       $head"
    Write-Host "Status:     $(if ($status) { 'DIRTY' } else { 'CLEAN' })"
    if ($status) {
        Write-Host $status
    }
}

function New-ActionRun {
    param([string]$Action)

    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $runDirectory = Join-Path (Join-Path $WorkspaceRoot 'runs') "$stamp-$Action"
    New-Item -ItemType Directory -Path $runDirectory -Force | Out-Null

    $metadata = @(
        "# $($Action.ToUpperInvariant()) run"
        ''
        "- Created: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')"
        "- Branch: $(Get-GitText @('-C', $RepoRoot, 'branch', '--show-current'))"
        "- HEAD: $(Get-GitText @('-C', $RepoRoot, 'rev-parse', 'HEAD'))"
        "- Action: ../../actions/$Action.md"
    )
    Set-Content -LiteralPath (Join-Path $runDirectory 'RUN.md') -Value $metadata -Encoding UTF8

    $templates = @{
        plan = 'implementation-plan.md'
        design = 'design-brief.md'
        implement = 'task-brief.md'
        qa = 'qa-report.md'
        review = 'review-report.md'
        security = 'security-report.md'
        performance = 'performance-report.md'
        handoff = 'handoff-report.md'
        'sync-notion' = 'notion-update.md'
    }

    if ($templates.ContainsKey($Action)) {
        $template = Join-Path (Join-Path $WorkspaceRoot 'templates') $templates[$Action]
        Copy-Item -LiteralPath $template -Destination (Join-Path $runDirectory $templates[$Action])
    }

    if ($Action -eq 'sync-notion') {
        $artifactDirectory = Join-Path $WorkspaceRoot 'artifacts'
        New-Item -ItemType Directory -Path $artifactDirectory -Force | Out-Null
        Copy-Item -LiteralPath (Join-Path (Join-Path $WorkspaceRoot 'templates') 'notion-update.md') -Destination (Join-Path $artifactDirectory "$stamp-notion-update.md")
    }

    Write-Host "Run created: $runDirectory"
}

function Invoke-Action {
    param([string]$Action)
    $actionFile = Join-Path (Join-Path $WorkspaceRoot 'actions') "$Action.md"
    if (-not (Test-Path -LiteralPath $actionFile)) {
        Stop-Ai "Action file not found: $actionFile"
    }

    Show-Context
    Write-Host "`nAction file: $actionFile`n"
    Get-Content -LiteralPath $actionFile -Encoding UTF8

    if ($DryRun) {
        Write-Host "`n[DRY-RUN] No run directory was created."
        return
    }
    New-ActionRun $Action
}

function Invoke-Step {
    param(
        [string]$Name,
        [string]$Executable,
        [string[]]$Arguments
    )
    Write-Host "`n==> $Name"
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) {
        Stop-Ai "$Name failed with exit code $LASTEXITCODE."
    }
}

function Invoke-Preflight {
    Show-Context

    $tsc = Join-Path $RepoRoot 'node_modules\.bin\tsc.cmd'
    if (-not (Test-Path -LiteralPath $tsc)) {
        Stop-Ai 'Local TypeScript executable is missing. Restore existing dependencies before running preflight.'
    }

    $steps = @(
        @{ Name = 'Git diff check'; Executable = 'git'; Arguments = @('-C', $RepoRoot, 'diff', '--check') },
        @{ Name = 'ESLint'; Executable = 'npm.cmd'; Arguments = @('run', 'lint') },
        @{ Name = 'TypeScript'; Executable = $tsc; Arguments = @('-p', (Join-Path $RepoRoot 'tsconfig.json'), '--noEmit') }
    )

    if ($Mode -eq 'full' -or $Mode -eq 'report-only') {
        $steps += @{ Name = 'Production build'; Executable = 'npm.cmd'; Arguments = @('run', 'build') }
    }

    if ($Mode -eq 'focused') {
        Write-Host "`nChanged files:"
        Get-GitText @('-C', $RepoRoot, 'status', '--short') | Write-Host
        Write-Host 'No focused test infrastructure exists; running the quick gates.'
    }

    Write-Host "`nPreflight mode: $Mode"
    foreach ($step in $steps) {
        Write-Host "- $($step.Name): $($step.Executable) $($step.Arguments -join ' ')"
    }

    if ($Mode -eq 'report-only') {
        Write-Host '[REPORT-ONLY] Commands were not executed.'
        return
    }

    Push-Location $RepoRoot
    try {
        foreach ($step in $steps) {
            Invoke-Step $step.Name $step.Executable $step.Arguments
        }
    }
    finally {
        Pop-Location
    }
}

function Get-WorktreeTarget {
    param([string]$Slug)
    if (-not $Slug -or $Slug -notmatch '^[a-z0-9]+(?:-[a-z0-9]+)*$') {
        Stop-Ai 'TaskSlug must use lowercase letters, digits and single hyphens.'
    }
    $repoParent = Split-Path -Parent $RepoRoot
    $target = [IO.Path]::GetFullPath((Join-Path $repoParent "wt-pluga-$Slug"))
    $parentPrefix = [IO.Path]::GetFullPath($repoParent).TrimEnd('\') + '\'
    if (-not $target.StartsWith($parentPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        Stop-Ai 'Resolved worktree target is outside the repository parent directory.'
    }
    return $target
}

function Invoke-Worktree {
    Show-Context
    $actionFile = Join-Path (Join-Path $WorkspaceRoot 'actions') 'worktree.md'
    Write-Host "`nAction file: $actionFile`n"
    Get-Content -LiteralPath $actionFile -Encoding UTF8

    if ($Operation -eq 'list') {
        & git -C $RepoRoot worktree list
        return
    }
    if ($Operation -eq 'prune-preview') {
        & git -C $RepoRoot worktree prune --dry-run
        return
    }

    $target = Get-WorktreeTarget $TaskSlug
    $branch = "ai/$TaskSlug"

    if ($Operation -eq 'path') {
        Write-Host $target
        return
    }
    if ($Operation -eq 'status') {
        if (-not (Test-Path -LiteralPath $target)) {
            Stop-Ai "Worktree not found: $target"
        }
        & git -C $target status --branch --short
        return
    }
    if ($Operation -eq 'create') {
        $base = Get-GitText @('-C', $RepoRoot, 'rev-parse', 'HEAD')
        $dirty = Get-GitText @('-C', $RepoRoot, 'status', '--porcelain')
        & git -C $RepoRoot show-ref --verify --quiet "refs/heads/$branch"
        $branchExists = $LASTEXITCODE -eq 0

        Write-Host "Base:   $base"
        Write-Host "Branch: $branch"
        Write-Host "Path:   $target"

        if ($dirty -or $branchExists -or (Test-Path -LiteralPath $target)) {
            $reason = if ($dirty) { 'base worktree is dirty' } elseif ($branchExists) { 'branch already exists' } else { 'target path already exists' }
            if ($DryRun) {
                Write-Warning "[DRY-RUN] Create would stop: $reason."
                return
            }
            Stop-Ai "Cannot create worktree: $reason."
        }
        if ($DryRun) {
            Write-Host '[DRY-RUN] No branch or worktree was created.'
            return
        }
        & git -C $RepoRoot worktree add -b $branch $target $base
        if ($LASTEXITCODE -ne 0) {
            Stop-Ai 'git worktree add failed.'
        }
        New-ActionRun 'worktree'
        return
    }
    if ($Operation -eq 'remove') {
        if (-not (Test-Path -LiteralPath $target)) {
            Stop-Ai "Worktree not found: $target"
        }
        $dirty = Get-GitText @('-C', $target, 'status', '--porcelain')
        if ($dirty -and -not $Force) {
            Stop-Ai 'Worktree is dirty. Review it first; removal requires -Force and human confirmation.'
        }
        if (-not $Apply) {
            Write-Host "[DRY-RUN] Would remove: $target"
            return
        }
        if ($Force) {
            Write-Warning 'Forced removal can destroy uncommitted work.'
            if ((Read-Host "Type REMOVE-$TaskSlug to continue") -ne "REMOVE-$TaskSlug") {
                Stop-Ai 'Removal cancelled.'
            }
        }
        $arguments = @('-C', $RepoRoot, 'worktree', 'remove')
        if ($Force) { $arguments += '--force' }
        $arguments += $target
        & git @arguments
        if ($LASTEXITCODE -ne 0) {
            Stop-Ai 'git worktree remove failed.'
        }
        New-ActionRun 'worktree'
    }
}

function Invoke-Clean {
    $runtimeNames = @('runs', 'artifacts', 'screenshots', 'traces', 'logs', 'tmp', 'state')
    $workspacePrefix = [IO.Path]::GetFullPath($WorkspaceRoot).TrimEnd('\') + '\'
    $targets = foreach ($name in $runtimeNames) {
        $path = [IO.Path]::GetFullPath((Join-Path $WorkspaceRoot $name))
        if (-not $path.StartsWith($workspacePrefix, [StringComparison]::OrdinalIgnoreCase)) {
            Stop-Ai "Unsafe cleanup target: $path"
        }
        if (Test-Path -LiteralPath $path) { $path }
    }

    if (-not $targets) {
        Write-Host 'No runtime directories exist.'
        return
    }
    $targets | ForEach-Object { Write-Host "Runtime directory: $_" }
    if ($Apply) {
        Stop-Ai 'Automated recursive cleanup is intentionally disabled. Review the listed directories and remove selected artifacts manually.'
    }
    Write-Host '[PREVIEW] Nothing was removed; automated recursive cleanup is intentionally disabled.'
}

if ($Command -eq 'help') {
    Get-Content -LiteralPath (Join-Path $WorkspaceRoot 'ACTIONS.md') -Encoding UTF8
}
elseif ($Command -eq 'context') {
    Show-Context
}
elseif ($Command -eq 'preflight') {
    Invoke-Preflight
}
elseif ($Command -eq 'worktree') {
    Invoke-Worktree
}
elseif ($Command -eq 'clean') {
    Invoke-Clean
}
else {
    Invoke-Action $Command
}
