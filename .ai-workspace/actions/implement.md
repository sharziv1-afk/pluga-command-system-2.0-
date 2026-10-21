# IMPLEMENT

<!-- Workspace guide: [../../WORKSPACE_MODE.md](../../WORKSPACE_MODE.md) describes the current active modules, deployment verification, QA limits, and safe reactivation procedure. This file remains a historical/process reference where applicable. -->


מטרה: לממש את השינוי המאושר הקטן ביותר.

1. אמת acceptance criteria ו־scope.
2. מפה helper/callers קיימים לפני הוספת abstraction.
3. שנה מעט קבצים ככל שניתן ושמור על RTL ועל guardrails ב־`AGENTS.md`.
4. אל תרחיב refactor, dependency, schema או הרשאות.
5. הרץ focused/quick gates ותעד לפי [`../templates/task-brief.md`](../templates/task-brief.md).

עצור לפני SQL, migration, deployment, commit או push ללא אישור מפורש.
