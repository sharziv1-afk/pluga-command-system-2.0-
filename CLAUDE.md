@AGENTS.md

## Claude Code notes

- `AGENTS.md` (imported above) holds the durable rules. Current live state is in [`WORKSPACE_MODE.md`](WORKSPACE_MODE.md); databases are in [`ENVIRONMENTS.md`](ENVIRONMENTS.md). This file adds only what is specific to Claude Code — do not restate state or invariants here.
- Start every task with `git fetch`, `git status`, and a comparison against `origin/main`. Work in a fresh branch (or `git worktree add`) cut from `origin/main`; never switch or reset an existing checkout that holds someone else's work.
- Production data is real. Browser QA against the live site is read-only unless the user explicitly authorizes a specific write.
- No commit, push, PR, merge, SQL, RLS change or Edge Function deploy without explicit approval for that action.
- Plan mode for multi-step or risky work; subagents for wide read-only searches. Never run two writing agents on the same files.
- The `.ai-workspace/` PowerShell toolkit was retired on 2026-10-24 (it cannot run on macOS) and lives in `docs/archive/ai-workspace/` for reference only. There is no mandatory preflight script; the steps above replace it.
