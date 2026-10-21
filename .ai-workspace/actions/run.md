# RUN

<!-- Current project state (2026-10-21): production is on cb8458e4dcb9f7f8cfb50d4726b423792e990fce (Ready); active modules are /dashboard and /forum. This file is a historical/process reference where applicable. See [../../WORKSPACE_MODE.md](../../WORKSPACE_MODE.md) for the current state and safe reactivation procedure. -->


מטרה: לשחזר בעיית runtime ולאתר root cause.

1. הגדר repro קצר ו־expected/actual.
2. הרץ את פקודת `dev` הקיימת בלבד ואסוף logs רלוונטיים ללא secrets.
3. בדוק network, console, server output ו־data flow.
4. הפרד symptom מ־cause ומפה את כל הנתיבים המשתמשים ב־cause.
5. עצור את השרת בסיום ותעד evidence.

אין שינוי production data ואין auth bypass לצורך repro.
