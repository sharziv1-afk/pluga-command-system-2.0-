# Artifact Policy

נשמרים ב־Git: מסמכי `.ai-workspace`, templates, contracts, playbooks, `bin/ai.ps1` ו־launcher `bin/ai.cmd`.

מוחרגים: `runs/`, `artifacts/`, `screenshots/`, `traces/`, `logs/`, `tmp/` ו־`state/`.

recordings ו־Playwright traces נשמרים רק ב־`traces/`; auth state, cookies ו־test accounts רק ב־`state/`; debug exports ו־generated reports רק ב־`artifacts/`, `logs/` או `tmp/`. אין ליצור אותם מחוץ לנתיבים המוחרגים האלה.

אין secrets, ערכי env או absolute machine paths ב־artifact נשמר.
