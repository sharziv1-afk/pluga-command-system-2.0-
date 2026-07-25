---
description: Manage isolated git worktrees for safe parallel work
argument-hint: <create|list|status|remove> <slug>
---
Manage a git **worktree** for parallel/isolated work (via the workspace runner):

```
.\.ai-workspace\bin\ai.cmd worktree -Operation list
.\.ai-workspace\bin\ai.cmd worktree -Operation create -TaskSlug "<slug>" -DryRun
.\.ai-workspace\bin\ai.cmd worktree -Operation status -TaskSlug "<slug>"
.\.ai-workspace\bin\ai.cmd worktree -Operation remove -TaskSlug "<slug>"   # DryRun by default
```

Use a worktree whenever two writing agents would otherwise touch the same tree. `create`/`remove` are guarded (dirty tree / existing branch / confirmation). Spawn the **implementation-engineer** with `isolation: "worktree"` for the actual edits. Never run two writers on the same files.
