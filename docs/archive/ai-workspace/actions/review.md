# REVIEW

<!-- Workspace guide: [../../WORKSPACE_MODE.md](../../WORKSPACE_MODE.md) describes the current active modules, deployment verification, QA limits, and safe reactivation procedure. This file remains a historical/process reference where applicable. -->


מטרה: לקרוא את ה־diff כאילו נכתב בידי מפתח אחר.

1. קרא `git diff` ואת הקבצים המלאים שנגעו בזרימה.
2. בדוק correctness, scope, edge cases, אבטחה, a11y ותחזוקה.
3. אמת כל finding מול evidence וקרא לכל caller רלוונטי.
4. דרג findings לפי חומרה; אל תמציא בעיה כדי למלא דוח.
5. כתוב לפי [`../templates/review-report.md`](../templates/review-report.md).

אם אין findings, אמור זאת וציין פערי בדיקה שנותרו.
