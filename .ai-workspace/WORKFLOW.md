# Workflow

## Preflight חובה

1. הרץ `.\.ai-workspace\bin\ai.cmd context`.
2. בדוק branch, HEAD ו־working tree; אל תדרוס שינויים קיימים.
3. קרא את `AGENTS.md`, את action הנבחר ואת ה־playbook הרלוונטי.
4. הרץ `.\.ai-workspace\bin\ai.cmd preflight -Mode report-only` ובחר gate מתאים.
5. הגדר scope, acceptance criteria ו־stop conditions.

## מחזור עבודה

`AUDIT → DESIGN → IMPLEMENT → DRY RUN → VALIDATE → REVIEW → HANDOFF`

- שינוי קטן וקוהרנטי בלבד.
- bugfix מטופל בשורש המשותף לאחר מיפוי callers.
- UI task אינו מרחיב scope ל־DB/Auth/RLS.
- SQL מוצע בלבד וממתין להרצה ידנית מפורשת.
- reviewer קורא את ה־diff מחדש ואינו נשען על טענות המממש.

## בחירת flow

- feature: [`playbooks/feature-flow.md`](playbooks/feature-flow.md)
- bug: [`playbooks/bug-flow.md`](playbooks/bug-flow.md)
- UI: [`playbooks/ui-redesign-flow.md`](playbooks/ui-redesign-flow.md)
- database: [`playbooks/database-change-flow.md`](playbooks/database-change-flow.md)
- Auth/RLS: [`playbooks/auth-rls-flow.md`](playbooks/auth-rls-flow.md)
- performance: [`playbooks/performance-flow.md`](playbooks/performance-flow.md)
- QA: [`playbooks/qa-flow.md`](playbooks/qa-flow.md)
- release: [`playbooks/release-flow.md`](playbooks/release-flow.md)

## סיום

השלם את [Definition of Done](contracts/definition-of-done.md), הרץ gates רלוונטיים, כתוב handoff לפי [`templates/handoff-report.md`](templates/handoff-report.md), והצג `git status --short`. commit/push מבוצעים רק לאחר הוראה מפורשת.
