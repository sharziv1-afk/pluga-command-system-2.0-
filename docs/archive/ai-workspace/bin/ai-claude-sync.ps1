[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('claude-sync', 'claude-status', 'claude-validate')]
    [string]$Command = 'claude-status',

    [switch]$DryRun
)

# Safe local sync for the Claude Code adapter.
# Canonical source:  .ai-workspace/adapters/claude  (tracked)
# Local destination: .claude                        (git-ignored)
# Copies ONLY manifest files. Never deletes unmanaged files. Never touches
# protected paths (skills/, settings.local.json). Backs up before replacing.
# PowerShell 5.1 compatible. No network. No secrets. No Git config changes.

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding

function Stop-Sync {
    param([string]$Message)
    [Console]::Error.WriteLine("ERROR: $Message")
    exit 1
}

function Get-RepoRoot {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Stop-Sync 'Git is not available on PATH.' }
    $root = (& git rev-parse --show-toplevel 2>$null)
    if ($LASTEXITCODE -ne 0 -or -not $root) { Stop-Sync 'Not inside a Git repository.' }
    return ($root | Out-String).Trim()
}

function Get-Sha {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
}

$RepoRoot = Get-RepoRoot
$ManifestPath = Join-Path $RepoRoot '.ai-workspace\adapters\claude\manifest.json'
if (-not (Test-Path -LiteralPath $ManifestPath)) { Stop-Sync "Manifest not found: $ManifestPath" }

try { $Manifest = Get-Content -LiteralPath $ManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json }
catch { Stop-Sync "Manifest is not valid JSON: $($_.Exception.Message)" }

$SrcRoot = Join-Path $RepoRoot ($Manifest.sourceRoot -replace '/', '\')
$DestRoot = Join-Path $RepoRoot ($Manifest.destinationRoot -replace '/', '\')
$Protected = @($Manifest.protected)

Write-Host "Adapter:     $($Manifest.name) v$($Manifest.version)"
Write-Host "Repo root:   $RepoRoot"
Write-Host "Source:      $($Manifest.sourceRoot)"
Write-Host "Destination: $($Manifest.destinationRoot)"
Write-Host "Protected:   $($Protected -join ', ')"
Write-Host ''

function Test-Protected {
    param([string]$DestRel)
    $norm = ($DestRel -replace '/', '\')
    foreach ($p in $Protected) {
        $pn = ($p -replace '/', '\').TrimEnd('\')
        if ($norm -ieq $pn -or $norm -ilike "$pn\*") { return $true }
    }
    return $false
}

# Build the plan from the manifest.
$Plan = foreach ($f in $Manifest.files) {
    $srcPath = Join-Path $SrcRoot ($f.source -replace '/', '\')
    $destPath = Join-Path $DestRoot ($f.destination -replace '/', '\')
    if (-not (Test-Path -LiteralPath $srcPath)) { Stop-Sync "Manifest source missing: $($f.source)" }
    if (Test-Protected $f.destination) { Stop-Sync "Manifest targets a protected path: $($f.destination)" }
    $srcHash = Get-Sha $srcPath
    $destHash = Get-Sha $destPath
    $state = if (-not $destHash) { 'create' } elseif ($srcHash -eq $destHash) { 'in-sync' } else { 'update' }
    [pscustomobject]@{ Source = $f.source; Dest = $f.destination; SrcPath = $srcPath; DestPath = $destPath; State = $state }
}

$managedDest = @{}
foreach ($p in $Plan) { $managedDest[[IO.Path]::GetFullPath($p.DestPath).ToLowerInvariant()] = $true }

function Get-UnmanagedFiles {
    if (-not (Test-Path -LiteralPath $DestRoot)) { return @() }
    $result = @()
    foreach ($file in Get-ChildItem -LiteralPath $DestRoot -Recurse -File -ErrorAction SilentlyContinue) {
        $full = [IO.Path]::GetFullPath($file.FullName).ToLowerInvariant()
        if ($managedDest.ContainsKey($full)) { continue }
        $rel = $file.FullName.Substring($DestRoot.Length).TrimStart('\')
        if (Test-Protected $rel) { continue }
        $result += $rel
    }
    return $result
}

function Show-Plan {
    foreach ($p in $Plan) { Write-Host ("  [{0,-7}] {1}" -f $p.State, $p.Dest) }
    Write-Host ''
    $create = @($Plan | Where-Object { $_.State -eq 'create' }).Count
    $update = @($Plan | Where-Object { $_.State -eq 'update' }).Count
    $insync = @($Plan | Where-Object { $_.State -eq 'in-sync' }).Count
    Write-Host "Summary: create=$create update=$update in-sync=$insync (managed files: $($Plan.Count))"
    $protectedHits = @()
    foreach ($p in $Protected) {
        $full = Join-Path $DestRoot ($p -replace '/', '\')
        if (Test-Path -LiteralPath $full) { $protectedHits += $p }
    }
    if ($protectedHits) { Write-Host "Preserved (protected, untouched): $($protectedHits -join ', ')" }
    $unmanaged = Get-UnmanagedFiles
    if ($unmanaged) {
        Write-Host 'Unmanaged local files (left untouched):'
        foreach ($u in $unmanaged) { Write-Host "  - $u" }
    }
}

switch ($Command) {

    'claude-status' {
        Write-Host '== claude-status =='
        Show-Plan
        exit 0
    }

    'claude-validate' {
        Write-Host '== claude-validate =='
        $errors = @()
        $names = @{}
        foreach ($p in $Plan) {
            if ($p.Source -like 'agents/*.md') {
                $text = Get-Content -LiteralPath $p.SrcPath -Raw -Encoding UTF8
                if ($text -notmatch '(?ms)^---\s*.*?^name:\s*\S+.*?^description:\s*\S+.*?^---') {
                    $errors += "agent missing name/description frontmatter: $($p.Source)"
                }
                $m = [regex]::Match($text, '(?m)^name:\s*(\S+)')
                if ($m.Success) {
                    $n = $m.Groups[1].Value
                    if ($names.ContainsKey($n)) { $errors += "duplicate agent name: $n" } else { $names[$n] = $true }
                }
            }
            if ($p.Source -like '*.json') {
                try { Get-Content -LiteralPath $p.SrcPath -Raw -Encoding UTF8 | ConvertFrom-Json | Out-Null }
                catch { $errors += "invalid JSON: $($p.Source) ($($_.Exception.Message))" }
            }
            if ($p.Source -like 'hooks/*.ps1') {
                $tokens = $null; $perr = $null
                [void][System.Management.Automation.Language.Parser]::ParseFile($p.SrcPath, [ref]$tokens, [ref]$perr)
                if ($perr -and $perr.Count -gt 0) { $errors += "PowerShell parse error in $($p.Source)" }
            }
        }
        try { Get-Content -LiteralPath (Join-Path $SrcRoot 'settings.json') -Raw -Encoding UTF8 | ConvertFrom-Json | Out-Null }
        catch { $errors += "invalid settings.json: $($_.Exception.Message)" }

        if ($errors.Count -eq 0) {
            Write-Host "VALIDATION PASSED - $($Plan.Count) managed files, $($names.Count) unique agents."
            exit 0
        }
        foreach ($e in $errors) { [Console]::Error.WriteLine("  FAIL: $e") }
        Stop-Sync "Validation failed with $($errors.Count) issue(s)."
    }

    'claude-sync' {
        if ($DryRun) {
            Write-Host '== claude-sync (DRY-RUN) =='
            Show-Plan
            Write-Host ''
            Write-Host '[DRY-RUN] No files were written. Re-run without -DryRun to apply.'
            exit 0
        }

        Write-Host '== claude-sync (APPLY) =='
        Show-Plan
        Write-Host ''

        $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        $backupRoot = Join-Path $RepoRoot ".ai-workspace\state\claude-backups\$stamp"
        $applied = 0
        foreach ($p in $Plan) {
            if ($p.State -eq 'in-sync') { continue }
            $destDir = Split-Path -Parent $p.DestPath
            if (-not (Test-Path -LiteralPath $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
            if ($p.State -eq 'update') {
                if (-not (Test-Path -LiteralPath $backupRoot)) { New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null }
                $backupPath = Join-Path $backupRoot ($p.Dest -replace '/', '\')
                $backupDir = Split-Path -Parent $backupPath
                if (-not (Test-Path -LiteralPath $backupDir)) { New-Item -ItemType Directory -Path $backupDir -Force | Out-Null }
                Copy-Item -LiteralPath $p.DestPath -Destination $backupPath -Force
            }
            Copy-Item -LiteralPath $p.SrcPath -Destination $p.DestPath -Force
            $applied++
        }
        if (Test-Path -LiteralPath $backupRoot) { Write-Host "Backups of replaced files: .ai-workspace\state\claude-backups\$stamp" }
        Write-Host "Applied $applied change(s). Unmanaged and protected files were left untouched."
        exit 0
    }
}
