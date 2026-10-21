# IMPLEMENT

<!-- Current project state (2026-10-21): production is on cb8458e4dcb9f7f8cfb50d4726b423792e990fce (Ready); active modules are /dashboard and /forum. This file is a historical/process reference where applicable. See [../../WORKSPACE_MODE.md](../../WORKSPACE_MODE.md) for the current state and safe reactivation procedure. -->


מטרה: לממש את השינוי המאושר הקטן ביותר.

1. אמת acceptance criteria ו־scope.
2. מפה helper/callers קיימים לפני הוספת abstraction.
3. שנה מעט קבצים ככל שניתן ושמור על RTL ועל guardrails ב־`AGENTS.md`.
4. אל תרחיב refactor, dependency, schema או הרשאות.
5. הרץ focused/quick gates ותעד לפי [`../templates/task-brief.md`](../templates/task-brief.md).

עצור לפני SQL, migration, deployment, commit או push ללא אישור מפורש.
