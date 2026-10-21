# DESIGN

<!-- Workspace guide: [../../WORKSPACE_MODE.md](../../WORKSPACE_MODE.md) describes the current active modules, deployment verification, QA limits, and safe reactivation procedure. This file remains a historical/process reference where applicable. -->


מטרה: לתכנן UI/UX וארכיטקטורת ממשק לפני מימוש.

1. בדוק את ה־design system הקיים ואת הזרימה בפועל.
2. הגדר states: loading, empty, error, success, disabled ו־permission denied.
3. תכנן RTL, keyboard, labels, focus ו־responsive ב־375/430/768/1024/1440.
4. העדף primitives ו־patterns קיימים; אין framework חדש.
5. כתוב לפי [`../templates/design-brief.md`](../templates/design-brief.md).

אין לשנות DB/Auth/RLS במסגרת design-only.
