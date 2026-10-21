# QA Gates

<!-- Current project state (2026-10-21): production is on cb8458e4dcb9f7f8cfb50d4726b423792e990fce (Ready); active modules are /dashboard and /forum. This file is a historical/process reference where applicable. See [../../WORKSPACE_MODE.md](../../WORKSPACE_MODE.md) for the current state and safe reactivation procedure. -->


## Code

- `git diff --check`
- lint
- TypeScript
- build ב־full
- tests/E2E רק אם קיימים

## Smoke

Login, Onboarding, Pending Approval, Dashboard, Sidebar/navigation, Requests, Tasks, Schedule, Forum, Forum Daily, Tracking, Admin, Help.

## Responsive

375, 430, 768, 1024, 1440 פיקסלים; בדוק overflow, touch targets, dialogs, sticky navigation ו־RTL.

## Reporting

סמן כל gate כ־pass, fail או not-run. אין Playwright בפרויקט כרגע ואין להתקינו אוטומטית.
