# Rule: Workflow

- The main Claude session is the **orchestrator**. Subagents handle isolated research, design, implementation, debugging, QA and independent review.
- Use **Plan mode** for non-trivial work; get the plan approved before implementing.
- Never run two **writing** agents on the same files in parallel — isolate parallel writers in git worktrees.
- Pick the workflow from [`.ai-workspace/WORKFLOW.md`](../../../WORKFLOW.md); each phase maps to an action in [`.ai-workspace/ACTIONS.md`](../../../ACTIONS.md) and an agent in [`ROLE-MATRIX.md`](../../../ROLE-MATRIX.md).
- End every significant batch with independent review + handoff.

Canonical sources: [`WORKFLOW.md`](../../../WORKFLOW.md), [`ROLE-MATRIX.md`](../../../ROLE-MATRIX.md), [`contracts/definition-of-ready.md`](../../../contracts/definition-of-ready.md), [`contracts/definition-of-done.md`](../../../contracts/definition-of-done.md).
