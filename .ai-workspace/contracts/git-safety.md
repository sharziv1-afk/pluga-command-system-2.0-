# Git Safety

<!-- Workspace guide: [../../WORKSPACE_MODE.md](../../WORKSPACE_MODE.md) describes the current active modules, deployment verification, QA limits, and safe reactivation procedure. This file remains a historical/process reference where applicable. -->


- תמיד הצג branch, HEAD ו־status לפני edit.
- אל תמחק, תאפס או תדרוס שינוי שאינו שלך.
- אין `reset --hard`, `clean`, checkout destructive או force push.
- אין commit/push ללא הוראה מפורשת.
- worktree remove מלוכלך דורש `-Force` ואישור אנושי.
- עבודה מקבילית משתמשת ב־worktrees או scopes לא חופפים.
