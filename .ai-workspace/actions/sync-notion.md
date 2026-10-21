# SYNC-NOTION

<!-- Current project state (2026-10-21): production is on cb8458e4dcb9f7f8cfb50d4726b423792e990fce (Ready); active modules are /dashboard and /forum. This file is a historical/process reference where applicable. See [../../WORKSPACE_MODE.md](../../WORKSPACE_MODE.md) for the current state and safe reactivation procedure. -->


מטרה: להכין artifact מסודר לעדכון Notion, לא לכתוב אליו אוטומטית.

1. ודא שהשינוי עומד ב־[`../contracts/notion-sync-policy.md`](../contracts/notion-sync-policy.md).
2. סכם behavior, files, validation, decisions, open items ו־Git state.
3. השתמש ב־[`../templates/notion-update.md`](../templates/notion-update.md).
4. בדוק שאין secrets או runtime noise.

ה־dispatcher יוצר artifact מקומי מוחרג. כתיבה ל־Notion מותרת רק בבקשה מפורשת ובחיבור נתמך.
