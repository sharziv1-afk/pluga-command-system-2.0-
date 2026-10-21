# Git Safety

<!-- Current project state (2026-10-21): production is on cb8458e4dcb9f7f8cfb50d4726b423792e990fce (Ready); active modules are /dashboard and /forum. This file is a historical/process reference where applicable. See [../../WORKSPACE_MODE.md](../../WORKSPACE_MODE.md) for the current state and safe reactivation procedure. -->


- תמיד הצג branch, HEAD ו־status לפני edit.
- אל תמחק, תאפס או תדרוס שינוי שאינו שלך.
- אין `reset --hard`, `clean`, checkout destructive או force push.
- אין commit/push ללא הוראה מפורשת.
- worktree remove מלוכלך דורש `-Force` ואישור אנושי.
- עבודה מקבילית משתמשת ב־worktrees או scopes לא חופפים.
