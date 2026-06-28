import type { SupabaseClient } from '@supabase/supabase-js';

export type AuditActionType =
  | 'request_created'
  | 'request_status_changed'
  | 'request_assigned'
  | 'request_comment_added'
  | 'request_deleted'
  | 'request_updated'
  | 'task_created'
  | 'task_updated'
  | 'task_status_changed'
  | 'task_deleted'
  | 'event_created'
  | 'event_status_changed'
  | 'event_deleted'
  | 'event_updated'
  | 'forum_post_created'
  | 'forum_post_updated'
  | 'forum_daily_summary_created'
  | 'forum_daily_summary_updated'
  | 'forum_daily_summary_closed'
  | 'forum_daily_report_created'
  | 'forum_daily_report_updated'
  | 'forum_daily_report_submitted'
  | 'forum_daily_report_closed'
  | 'forum_daily_report_reopened'
  | 'forum_daily_report_reset'
  | 'forum_daily_report_deleted'
  | 'forum_daily_report_carried_forward'
  | 'forum_company_report_generated'
  | 'forum_company_report_saved'
  | 'forum_daily_forum_published'
  | 'tracking_soldier_created'
  | 'tracking_soldier_updated'
  | 'tracking_item_created'
  | 'tracking_item_updated'
  | 'tracking_record_updated'
  | 'tracking_exported_csv';

interface CreateAuditLogParams {
  userId: string;
  userName: string;
  userRole: string;
  actionType: AuditActionType;
  entityType:
    | 'request'
    | 'task'
    | 'event'
    | 'forum_post'
    | 'forum_daily_summary'
    | 'forum_daily_report'
    | 'tracking_soldier'
    | 'tracking_item'
    | 'tracking_record'
    | 'tracking_export';
  entityId: string;
  previousValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
}

export async function createAuditLog(
  supabase: SupabaseClient,
  params: CreateAuditLogParams,
): Promise<void> {
  const { error } = await supabase.from('audit_logs').insert({
    user_id: params.userId,
    user_name: params.userName,
    user_role: params.userRole,
    action_type: params.actionType,
    entity_type: params.entityType,
    entity_id: params.entityId,
    previous_value: params.previousValue ?? null,
    new_value: params.newValue ?? null,
  });

  if (error) {
    console.warn('[audit] insert failed:', error.message);
  }
}
