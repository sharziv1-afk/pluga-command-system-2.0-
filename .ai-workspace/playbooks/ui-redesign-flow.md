# UI Redesign Flow

<!-- Current project state (2026-10-21): production is on cb8458e4dcb9f7f8cfb50d4726b423792e990fce (Ready); active modules are /dashboard and /forum. This file is a historical/process reference where applicable. See [../../WORKSPACE_MODE.md](../../WORKSPACE_MODE.md) for the current state and safe reactivation procedure. -->


1. בצע audit של המסך וה־design primitives הקיימים.
2. הגדר hierarchy, states, RTL, responsive ו־accessibility.
3. שמור Light Gloss: רקע בהיר, `#FF6B02`, glass cards ו־`#020108`.
4. ממש CSS/components קיימים לפני abstraction חדש.
5. QA ב־375/430/768/1024/1440 ובדוק keyboard/focus/overflow.

אין DB/Auth/RLS במסגרת UI-only.
