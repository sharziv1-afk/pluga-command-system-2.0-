# SYNC-NOTION

<!-- Workspace guide: [../../WORKSPACE_MODE.md](../../WORKSPACE_MODE.md) describes the current active modules, deployment verification, QA limits, and safe reactivation procedure. This file remains a historical/process reference where applicable. -->


מטרה: להכין artifact מסודר לעדכון Notion, לא לכתוב אליו אוטומטית.

1. ודא שהשינוי עומד ב־[`../contracts/notion-sync-policy.md`](../contracts/notion-sync-policy.md).
2. סכם behavior, files, validation, decisions, open items ו־Git state.
3. השתמש ב־[`../templates/notion-update.md`](../templates/notion-update.md).
4. בדוק שאין secrets או runtime noise.

ה־dispatcher יוצר artifact מקומי מוחרג. כתיבה ל־Notion מותרת רק בבקשה מפורשת ובחיבור נתמך.
