// Who can see a task is decided by the database (RLS, migration 002): the
// creator, the assignee, commanders (מ״פ, סמ״פ), and everyone whose unit is
// the task's unit_id. A task is saved with its creator's unit, so a commander
// in "פלוגה" who gave a task to himself was showing it to everyone in
// "פלוגה" (found 08.11.2026).
//
// A personal task — created by and assigned to the same person — is therefore
// saved with no unit: only its creator and the commanders see it.
// Pure and import-free: the site, the MCP tools and the node tests load it.

export function taskUnitIdFor(params: {
  createdBy: string | null | undefined;
  assignedTo: string | null | undefined;
  creatorUnitId: string | null | undefined;
}): string | null {
  const { createdBy, assignedTo, creatorUnitId } = params;
  if (createdBy && assignedTo && createdBy === assignedTo) return null;
  return creatorUnitId ?? null;
}
