# PERFORMANCE

<!-- Current project state (2026-10-21): production is on cb8458e4dcb9f7f8cfb50d4726b423792e990fce (Ready); active modules are /dashboard and /forum. This file is a historical/process reference where applicable. See [../../WORKSPACE_MODE.md](../../WORKSPACE_MODE.md) for the current state and safe reactivation procedure. -->


מטרה: לזהות bottleneck מדיד לפני optimization.

1. קבע user-visible symptom ומדד בסיס.
2. בדוק loading waterfalls, duplicate fetches, server/client boundaries, bundles ו־renders.
3. אסוף evidence בכלים קיימים בלבד.
4. הצע את השינוי הקטן ביותר ואת מדד ההצלחה.
5. כתוב לפי [`../templates/performance-report.md`](../templates/performance-report.md).

אין cache, memoization או dependency חדשים ללא evidence.
