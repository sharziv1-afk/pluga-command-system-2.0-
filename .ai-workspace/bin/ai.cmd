@echo off
setlocal EnableDelayedExpansion
set "AI_FIRST=%~1"
if /I "!AI_FIRST:~0,7!"=="claude-" (
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0ai-claude-sync.ps1" %*
) else (
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0ai.ps1" %*
)
exit /b %ERRORLEVEL%
