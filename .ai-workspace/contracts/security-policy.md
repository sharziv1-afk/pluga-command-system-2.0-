# Security Policy

<!-- Current project state (2026-10-21): production is on cb8458e4dcb9f7f8cfb50d4726b423792e990fce (Ready); active modules are /dashboard and /forum. This file is a historical/process reference where applicable. See [../../WORKSPACE_MODE.md](../../WORKSPACE_MODE.md) for the current state and safe reactivation procedure. -->


- אין secrets בקוד, logs, screenshots או handoff.
- service role לעולם אינו frontend.
- Auth/RLS/tenant boundaries דורשים threat review.
- UI gating אינו תחליף ל־server/DB enforcement.
- SQL ומigrations הם manual-only לאחר הצעה ואישור.
- אין demo fallback חדש שעוקף auth או tenant boundary.
- audit נשאר best-effort ואינו חוסם פעולה עסקית.
