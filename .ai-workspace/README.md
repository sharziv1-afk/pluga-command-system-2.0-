# סביבת העבודה הסוכנתית של "המפקד"

זהו ה־source of truth לתהליכי execution מקומיים של Codex וכלי פיתוח אחרים. Notion נשאר מקור האמת למוצר, משימות, החלטות ו־Roadmap; ה־repository הוא מקור האמת לקוד.

## התחלה מהירה

```powershell
.\.ai-workspace\bin\ai.cmd context
.\.ai-workspace\bin\ai.cmd preflight -Mode report-only
.\.ai-workspace\bin\ai.cmd plan -DryRun
```

לאחר preflight בוחרים פעולה מתוך [ACTIONS.md](ACTIONS.md) או flow מתוך [WORKFLOW.md](WORKFLOW.md). כל הרצה אמיתית של פעולה יוצרת תיקיית run מקומית ומוחרגת; `-DryRun` רק מציג את התכנון.

## גבולות

- אין commit, push, deployment, migration או כתיבה ל־Notion מתוך ה־dispatcher.
- אין קריאת secrets או שמירת auth state.
- אין התקנת dependencies.
- תוצרי runtime נוצרים לפי צורך תחת `runs/`, `artifacts/`, `screenshots/`, `traces/`, `logs/`, `tmp/` ו־`state/` ומוחרגים מ־Git.
- recordings, auth state, cookies, test accounts ו־debug exports חייבים להישמר רק בתיקיות runtime אלה.
- `clean` הוא preview בלבד; אין מחיקה רקורסיבית אוטומטית.
- Skills קיימים תחת `.agents/`, `.codex/` ו־`.claude/` נשארים local-only ואינם מקור אמת נוסף.

## מסמכי ליבה

- [WORKFLOW.md](WORKFLOW.md) — preflight, בחירת flow ומחזור העבודה.
- [ACTIONS.md](ACTIONS.md) — פקודות dispatcher.
- [ROLE-MATRIX.md](ROLE-MATRIX.md) — אחריות והרשאות לוגיות.
- [`actions/`](actions/) — הוראות לכל פעולה.
- [`playbooks/`](playbooks/) — flows לפי סוג שינוי.
- [`contracts/`](contracts/) — חוזי בטיחות ואיכות.
- [`templates/`](templates/) — תוצרי עבודה עקביים.
- [`bin/ai.ps1`](bin/ai.ps1) — dispatcher יחיד; [`bin/ai.cmd`](bin/ai.cmd) הוא launcher למדיניות Windows שחוסמת `.ps1`.

Project-level Codex Skills אינם נוצרים כאן: גרסת ה־CLI שנבדקה לא גילתה את `.agents/skills` של הפרויקט. ה־adapter האמין הוא `AGENTS.md` הקצר שמפנה למסמכים אלה.
