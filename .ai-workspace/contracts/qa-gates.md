# QA Gates

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
