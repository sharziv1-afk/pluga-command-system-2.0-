# Artifact Policy

<!-- Current project state (2026-10-21): production is on cb8458e4dcb9f7f8cfb50d4726b423792e990fce (Ready); active modules are /dashboard and /forum. This file is a historical/process reference where applicable. See [../../WORKSPACE_MODE.md](../../WORKSPACE_MODE.md) for the current state and safe reactivation procedure. -->


נשמרים ב־Git: מסמכי `.ai-workspace`, templates, contracts, playbooks, `bin/ai.ps1` ו־launcher `bin/ai.cmd`.

מוחרגים: `runs/`, `artifacts/`, `screenshots/`, `traces/`, `logs/`, `tmp/` ו־`state/`.

recordings ו־Playwright traces נשמרים רק ב־`traces/`; auth state, cookies ו־test accounts רק ב־`state/`; debug exports ו־generated reports רק ב־`artifacts/`, `logs/` או `tmp/`. אין ליצור אותם מחוץ לנתיבים המוחרגים האלה.

אין secrets, ערכי env או absolute machine paths ב־artifact נשמר.
