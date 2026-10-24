# Security Policy

<!-- Workspace guide: [../../WORKSPACE_MODE.md](../../WORKSPACE_MODE.md) describes the current active modules, deployment verification, QA limits, and safe reactivation procedure. This file remains a historical/process reference where applicable. -->


- אין secrets בקוד, logs, screenshots או handoff.
- service role לעולם אינו frontend.
- Auth/RLS/tenant boundaries דורשים threat review.
- UI gating אינו תחליף ל־server/DB enforcement.
- SQL ומigrations הם manual-only לאחר הצעה ואישור.
- אין demo fallback חדש שעוקף auth או tenant boundary.
- audit נשאר best-effort ואינו חוסם פעולה עסקית.
