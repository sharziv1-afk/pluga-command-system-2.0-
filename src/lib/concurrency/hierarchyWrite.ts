import type { SupabaseClient } from '@supabase/supabase-js';

export interface HierarchyWriteParams {
  supabase: SupabaseClient;
  table: string;
  id: string;
  baseUpdatedAt: string;
  payload: Record<string, unknown>;
  currentUserId: string;
  currentPermissionLevel: number;
}

export type HierarchyWriteResult =
  | { status: 'applied' }
  | { status: 'blocked'; editorName: string; editorRole: string };

/**
 * Optimistic-concurrency write guarded by an updated_at staleness check.
 * On conflict (someone else saved first), a higher permission_level editor's
 * write overrides theirs; an equal-or-lower one is blocked and told who to
 * coordinate with, instead of either side silently losing data (plain LWW).
 */
export async function writeWithHierarchyResolution({
  supabase,
  table,
  id,
  baseUpdatedAt,
  payload,
  currentUserId,
  currentPermissionLevel,
}: HierarchyWriteParams): Promise<HierarchyWriteResult> {
  const { data: applied, error } = await supabase
    .from(table)
    .update({ ...payload, updated_by: currentUserId })
    .eq('id', id)
    .eq('updated_at', baseUpdatedAt)
    .select('id');

  if (error) throw error;
  if (applied && applied.length > 0) return { status: 'applied' };

  const { data: current } = await supabase
    .from(table)
    .select('updated_by')
    .eq('id', id)
    .maybeSingle();

  const otherEditorId = (current as { updated_by: string | null } | null)?.updated_by ?? null;
  let otherPermissionLevel = 0;
  let otherName = 'משתמש אחר';
  let otherRole = '';

  if (otherEditorId && otherEditorId !== currentUserId) {
    const { data: otherUser } = await supabase
      .from('users')
      .select('full_name,role,permission_level')
      .eq('id', otherEditorId)
      .maybeSingle();
    if (otherUser) {
      otherPermissionLevel = (otherUser as { permission_level: number | null }).permission_level ?? 0;
      otherName = (otherUser as { full_name: string | null }).full_name ?? otherName;
      otherRole = (otherUser as { role: string | null }).role ?? '';
    }
  }

  if (currentPermissionLevel > otherPermissionLevel) {
    const { error: overrideError } = await supabase
      .from(table)
      .update({ ...payload, updated_by: currentUserId })
      .eq('id', id);
    if (overrideError) throw overrideError;
    return { status: 'applied' };
  }

  return { status: 'blocked', editorName: otherName, editorRole: otherRole };
}
