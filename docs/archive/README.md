# Archive

Retired material, kept for history. Nothing here describes the current system — for that, start at [`WORKSPACE_MODE.md`](../../WORKSPACE_MODE.md) and [`AGENTS.md`](../../AGENTS.md).

| Item | What it was | Retired |
|---|---|---|
| `AI_HANDOFF_CHECKPOINT.md` | Technical handoff for a fresh AI agent (2026-09-04/06) | 2026-10-24 |
| `QA_OWNER_MAPPING_REQUIREMENTS.md` | Prerequisites for a multi-platoon forum QA run (2026-08) | 2026-10-24 |
| `RESEARCH_FINDINGS.md` | Market research on comparable systems (2026-09-06) | 2026-10-24 |
| `ai-workspace/` | Windows/PowerShell agent toolkit (`ai.cmd` preflight, playbooks, Claude adapter). It cannot run on macOS, so the mandatory preflight was dropped | 2026-10-24 |
| `PROJECT_HANDOFF_AI_CONTEXT.md`, `PROJECT_SUMMARY.md`, `README_HISTORY.md` | Older handoffs and the original README journal | before 2026-10-21 |

Deleted outright on 2026-10-24 (recover them from git history if ever needed): `CODEX_AUDIT.md`, `CODEX_PHASE2_AUDIT_PROMPT.md`, `CODEX_PRELAUNCH_REVIEW_PROMPT.md`, `CODEX_REVIEW_PROMPT.md` and `CHATGPT_RESTART_PROMPT_TRACKING_CHECKPOINT.md`. These were one-off prompts for other tools, and nothing referenced them. `git log --diff-filter=D --name-only -- '*.md'` lists them.
