# RUN

<!-- Workspace guide: [../../WORKSPACE_MODE.md](../../WORKSPACE_MODE.md) describes the current active modules, deployment verification, QA limits, and safe reactivation procedure. This file remains a historical/process reference where applicable. -->


מטרה: לשחזר בעיית runtime ולאתר root cause.

1. הגדר repro קצר ו־expected/actual.
2. הרץ את פקודת `dev` הקיימת בלבד ואסוף logs רלוונטיים ללא secrets.
3. בדוק network, console, server output ו־data flow.
4. הפרד symptom מ־cause ומפה את כל הנתיבים המשתמשים ב־cause.
5. עצור את השרת בסיום ותעד evidence.

אין שינוי production data ואין auth bypass לצורך repro.
