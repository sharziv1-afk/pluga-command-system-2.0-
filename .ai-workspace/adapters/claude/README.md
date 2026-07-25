# Claude Code adapter — canonical source

This directory is the **tracked source of truth** for Claude Code configuration in
pluga-command-system. Because `.gitignore` excludes `.claude/`, `.agents/` and
`.codex/`, the real config cannot live only in `.claude/`. It lives here (committed)
and is synced down to the local, git-ignored `.claude/` adapter.

```
.ai-workspace/adapters/claude/
├── README.md            # this file
├── manifest.json        # the ONLY files the sync manages
├── agents/              # 8 subagents (→ .claude/agents/)
├── commands/            # 12 slash commands (→ .claude/commands/)
├── hooks/               # 4 PowerShell hook scripts (→ .claude/hooks/)
├── settings.json        # hooks wiring (→ .claude/settings.json)
├── rules/               # 8 canonical rules (docs; referenced from CLAUDE.md, NOT synced)
└── templates/           # pointer to shared .ai-workspace/templates
```

## Sync

```powershell
.\.ai-workspace\bin\ai.cmd claude-status      # show canonical vs local (drift)
.\.ai-workspace\bin\ai.cmd claude-sync -DryRun # plan only (create/update/conflict/unmanaged)
.\.ai-workspace\bin\ai.cmd claude-sync         # apply (backs up replaced files first)
.\.ai-workspace\bin\ai.cmd claude-validate     # validate frontmatter / JSON / manifest refs
```

The sync (`.ai-workspace/bin/ai-claude-sync.ps1`):

- resolves the repo root from Git and prints source + destination;
- copies **only** files listed in `manifest.json`;
- **DryRun is the default** for any delete/replace decision;
- never touches `manifest.protected` paths — including **`.claude/skills/` (impeccable, ui-ux-pro-max, 21st.dev, etc.)** and `settings.local.json`;
- backs up any file it is about to replace into `.ai-workspace/state/claude-backups/<timestamp>/` (git-ignored) before overwriting;
- never deletes files it does not manage;
- never copies secrets/credentials/MCP tokens (manifest carries none);
- changes no Git configuration.

## Native-capability notes (verified against this install)

- `agents/*.md` → `.claude/agents/` — native. Permission is enforced by the `tools:` allowlist (read-only agents omit Edit/Write). `permissionMode`, `disallowedTools`, per-agent `memory` and worktree `isolation` are **not** agent-file frontmatter fields; they are documented as policy in each agent body, and worktree isolation is applied at spawn time (`isolation: "worktree"`).
- `commands/*.md` → `.claude/commands/` — native slash commands.
- `hooks` in `settings.json` → native (SessionStart / PreToolUse / SubagentStop / Stop).
- `rules/` — Claude Code has **no** auto-loaded `.claude/rules/` directory; rules here are reference docs linked from `CLAUDE.md`. Directory-scoped `CLAUDE.md` files are the native path-scoping mechanism if needed.
- No new MCP servers or dependencies are introduced by this adapter.
