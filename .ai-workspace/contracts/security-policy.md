# Security Policy

- אין secrets בקוד, logs, screenshots או handoff.
- service role לעולם אינו frontend.
- Auth/RLS/tenant boundaries דורשים threat review.
- UI gating אינו תחליף ל־server/DB enforcement.
- SQL ומigrations הם manual-only לאחר הצעה ואישור.
- אין demo fallback חדש שעוקף auth או tenant boundary.
- audit נשאר best-effort ואינו חוסם פעולה עסקית.
