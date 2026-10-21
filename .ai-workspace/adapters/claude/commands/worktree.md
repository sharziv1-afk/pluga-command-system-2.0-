---
description: Manage isolated git worktrees for safe parallel work
argument-hint: <create|list|status|remove> <slug>
---

<!-- Current project state (2026-10-21): production is on cb8458e4dcb9f7f8cfb50d4726b423792e990fce (Ready); active modules are /dashboard and /forum. This file is a historical/process reference where applicable. See [../../../../WORKSPACE_MODE.md](../../../../WORKSPACE_MODE.md) for the current state and safe reactivation procedure. -->

Manage a git **worktree** for parallel/isolated work (via the workspace runner):

```
.\.ai-workspace\bin\ai.cmd worktree -Operation list
.\.ai-workspace\bin\ai.cmd worktree -Operation create -TaskSlug "<slug>" -DryRun
.\.ai-workspace\bin\ai.cmd worktree -Operation status -TaskSlug "<slug>"
.\.ai-workspace\bin\ai.cmd worktree -Operation remove -TaskSlug "<slug>"   # DryRun by default
```

Use a worktree whenever two writing agents would otherwise touch the same tree. `create`/`remove` are guarded (dirty tree / existing branch / confirmation). Spawn the **implementation-engineer** with `isolation: "worktree"` for the actual edits. Never run two writers on the same files.
