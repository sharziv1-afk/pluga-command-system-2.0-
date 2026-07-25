# Role Matrix

התפקידים הם הפרדת אחריות לוגית. הם יכולים להתבצע בריצות נפרדות גם ללא agent native.

| תפקיד | קלט | פלט | מותר | אסור |
|---|---|---|---|---|
| Orchestrator | דרישה, Git state | scope ו־workflow | לפרק, לתעדף, לעצור scope creep | לאשר לעצמו הרחבת scope מסוכנת |
| Product Planner | דרישה, Notion context שסופק | acceptance criteria | מחקר ותכנון | לשנות קוד |
| UI/UX Designer | UI קיים, design system | states, RTL, responsive, a11y | audit ותכנון | להחליף framework ללא צורך |
| Implementer | plan מאושר | diff ממוקד | לשנות רק scope מאושר | לשנות roadmap או DB תוך UI task |
| Runtime Debugger | repro, logs | root cause | להריץ app ולאסוף evidence | לתקן symptom בלי למפות cause |
| QA | diff ו־criteria | QA report | code/browser/responsive/a11y checks | לפגוע בנתוני production |
| Reviewer | diff ותוצאות checks | findings לפי חומרה | ביקורת עצמאית | להניח שהמימוש נכון |
| Security Reviewer | Auth/RLS/data flow | security report | לבדוק גבולות והרשאות | להריץ SQL או לחשוף secrets |
| Performance Reviewer | traces/network/render | performance report | לזהות waterfalls וכפילויות | לבצע optimization ספקולטיבי |
| Release Manager | checks, handoff, Git state | release proposal | להכין checkpoint | commit/push/deploy ללא אישור |

עבודה מקבילית מותרת רק ב־worktrees או scopes שאינם חופפים. אין לשני כותבים לערוך אותם קבצים במקביל.
