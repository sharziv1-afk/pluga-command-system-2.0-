# PERFORMANCE

מטרה: לזהות bottleneck מדיד לפני optimization.

1. קבע user-visible symptom ומדד בסיס.
2. בדוק loading waterfalls, duplicate fetches, server/client boundaries, bundles ו־renders.
3. אסוף evidence בכלים קיימים בלבד.
4. הצע את השינוי הקטן ביותר ואת מדד ההצלחה.
5. כתוב לפי [`../templates/performance-report.md`](../templates/performance-report.md).

אין cache, memoization או dependency חדשים ללא evidence.
