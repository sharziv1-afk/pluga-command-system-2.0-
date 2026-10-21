# WORKTREE

<!-- Current project state (2026-10-21): production is on cb8458e4dcb9f7f8cfb50d4726b423792e990fce (Ready); active modules are /dashboard and /forum. This file is a historical/process reference where applicable. See [../../WORKSPACE_MODE.md](../../WORKSPACE_MODE.md) for the current state and safe reactivation procedure. -->


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
