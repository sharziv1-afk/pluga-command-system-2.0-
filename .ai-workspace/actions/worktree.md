# WORKTREE

מטרה: לבודד עבודה מקבילית בלי לשכפל repository או לערבב שינויים.

```powershell
.\.ai-workspace\bin\ai.cmd worktree -Operation create -TaskSlug "task-slug" -DryRun
.\.ai-workspace\bin\ai.cmd worktree -Operation list
.\.ai-workspace\bin\ai.cmd worktree -Operation path -TaskSlug "task-slug"
.\.ai-workspace\bin\ai.cmd worktree -Operation status -TaskSlug "task-slug"
.\.ai-workspace\bin\ai.cmd worktree -Operation remove -TaskSlug "task-slug"
.\.ai-workspace\bin\ai.cmd worktree -Operation prune-preview
```

Worktree נוצר כאח של ה־repo ב־`wt-pluga-<slug>` ועל branch `ai/<slug>`. create דורש base נקי ושם branch/path פנויים. remove הוא dry-run כברירת מחדל; הפעלה דורשת `-Apply`, ו־dirty worktree דורש גם `-Force` ואישור אנושי.

השתמש ב־worktree לעבודה מקבילית מורכבת. branch רגיל מספיק לעבודה סדרתית. אין לשני agents לכתוב לאותם קבצים.
