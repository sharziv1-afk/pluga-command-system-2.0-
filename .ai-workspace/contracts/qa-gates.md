# QA Gates

<!-- Workspace guide: [../../WORKSPACE_MODE.md](../../WORKSPACE_MODE.md) describes the current active modules, deployment verification, QA limits, and safe reactivation procedure. This file remains a historical/process reference where applicable. -->


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
