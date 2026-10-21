# DESIGN

<!-- Current project state (2026-10-21): production is on cb8458e4dcb9f7f8cfb50d4726b423792e990fce (Ready); active modules are /dashboard and /forum. This file is a historical/process reference where applicable. See [../../WORKSPACE_MODE.md](../../WORKSPACE_MODE.md) for the current state and safe reactivation procedure. -->


מטרה: לתכנן UI/UX וארכיטקטורת ממשק לפני מימוש.

1. בדוק את ה־design system הקיים ואת הזרימה בפועל.
2. הגדר states: loading, empty, error, success, disabled ו־permission denied.
3. תכנן RTL, keyboard, labels, focus ו־responsive ב־375/430/768/1024/1440.
4. העדף primitives ו־patterns קיימים; אין framework חדש.
5. כתוב לפי [`../templates/design-brief.md`](../templates/design-brief.md).

אין לשנות DB/Auth/RLS במסגרת design-only.
