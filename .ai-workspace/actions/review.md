# REVIEW

<!-- Current project state (2026-10-21): production is on cb8458e4dcb9f7f8cfb50d4726b423792e990fce (Ready); active modules are /dashboard and /forum. This file is a historical/process reference where applicable. See [../../WORKSPACE_MODE.md](../../WORKSPACE_MODE.md) for the current state and safe reactivation procedure. -->


מטרה: לקרוא את ה־diff כאילו נכתב בידי מפתח אחר.

1. קרא `git diff` ואת הקבצים המלאים שנגעו בזרימה.
2. בדוק correctness, scope, edge cases, אבטחה, a11y ותחזוקה.
3. אמת כל finding מול evidence וקרא לכל caller רלוונטי.
4. דרג findings לפי חומרה; אל תמציא בעיה כדי למלא דוח.
5. כתוב לפי [`../templates/review-report.md`](../templates/review-report.md).

אם אין findings, אמור זאת וציין פערי בדיקה שנותרו.
