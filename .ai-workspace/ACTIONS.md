# Actions

הממשק האחיד:

```powershell
.\.ai-workspace\bin\ai.cmd <action> [-DryRun]
```

| פעולה | קובץ | פקודה |
|---|---|---|
| PLAN | [`actions/plan.md`](actions/plan.md) | `.\.ai-workspace\bin\ai.cmd plan` |
| DESIGN | [`actions/design.md`](actions/design.md) | `.\.ai-workspace\bin\ai.cmd design` |
| IMPLEMENT | [`actions/implement.md`](actions/implement.md) | `.\.ai-workspace\bin\ai.cmd implement` |
| RUN | [`actions/run.md`](actions/run.md) | `.\.ai-workspace\bin\ai.cmd run` |
| QA | [`actions/qa.md`](actions/qa.md) | `.\.ai-workspace\bin\ai.cmd qa` |
| REVIEW | [`actions/review.md`](actions/review.md) | `.\.ai-workspace\bin\ai.cmd review` |
| SECURITY | [`actions/security.md`](actions/security.md) | `.\.ai-workspace\bin\ai.cmd security` |
| PERFORMANCE | [`actions/performance.md`](actions/performance.md) | `.\.ai-workspace\bin\ai.cmd performance` |
| RELEASE | [`actions/release.md`](actions/release.md) | `.\.ai-workspace\bin\ai.cmd release` |
| HANDOFF | [`actions/handoff.md`](actions/handoff.md) | `.\.ai-workspace\bin\ai.cmd handoff` |
| SYNC-NOTION | [`actions/sync-notion.md`](actions/sync-notion.md) | `.\.ai-workspace\bin\ai.cmd sync-notion` |
| WORKTREE | [`actions/worktree.md`](actions/worktree.md) | `.\.ai-workspace\bin\ai.cmd worktree -Operation create -TaskSlug "<slug>" -DryRun` |

כל action רגיל מציג context וקובץ הוראות. ללא `-DryRun` הוא יוצר run מקומי עם metadata ותבנית מתאימה. `sync-notion` יוצר גם artifact מקומי; הוא לעולם אינו כותב ישירות ל־Notion.

`worktree create/remove` יוצרים run רק אחרי שינוי מוצלח; פעולות הקריאה אינן יוצרות artifact. `clean` מציג preview בלבד ולעולם אינו מוחק אוטומטית.

פקודות תפעול:

```powershell
.\.ai-workspace\bin\ai.cmd context
.\.ai-workspace\bin\ai.cmd preflight -Mode quick
.\.ai-workspace\bin\ai.cmd preflight -Mode focused
.\.ai-workspace\bin\ai.cmd preflight -Mode full
.\.ai-workspace\bin\ai.cmd preflight -Mode report-only
.\.ai-workspace\bin\ai.cmd clean
```
