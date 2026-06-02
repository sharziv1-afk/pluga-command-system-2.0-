export type RoleType = 'מ"פ' | 'סמ"פ' | 'מ"מ' | 'מ"כ' | 'רס"פ';

export type FrameType = 
  | 'פלוגה' 
  | 'מפל"ג' 
  | 'מחלקה 1' 
  | 'מחלקה 2' 
  | 'מחלקה 3' 
  | 'מחלקה 4'
  | 'כיתה 1' 
  | 'כיתה 2' 
  | 'כיתה 3' 
  | 'כיתה 4';

export type UserStatusType = 'pending' | 'approved' | 'rejected';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: RoleType;
  assigned_frame: FrameType;
  status: UserStatusType;
  created_at: string;
}

export type TaskStatusType = 
  | 'חדשה' 
  | 'לביצוע' 
  | 'בתהליך' 
  | 'ממתין לאישור' 
  | 'הושלם' 
  | 'תקוע';

export type TaskPriorityType = 'רגיל' | 'חשוב' | 'דחוף' | 'קריטי';

export type TaskCategoryType = 'לוחמה' | 'ערכים' | 'חינוך' | 'חניכה' | 'מנהלה' | 'לוגיסטיקה';

export interface Task {
  id: string;
  title: string;
  description: string;
  creator_id: string;
  creator_name?: string;
  owner_id: string;
  owner_name?: string;
  assigned_frame: FrameType;
  status: TaskStatusType;
  priority: TaskPriorityType;
  category: TaskCategoryType;
  deadline: string;
  location?: string;
  output_required: string;
  control_questions: string[];
  notes?: string;
  stuck_reason?: string;
  requires_commander_decision: boolean;
  source_type?: 'gap' | 'forum' | 'tracking' | 'manual';
  source_id?: string;
  created_at: string;
}

export type GapCategoryType = 'לוגיסטי' | 'הדרכתי' | 'לו״זי';

export type GapStatusType = 'פתוח' | 'בטיפול' | 'נסגר';

export type UrgencyType = 'רגיל' | 'חשוב' | 'דחוף' | 'קריטי';

export interface Gap {
  id: string;
  title: string;
  description: string;
  category: GapCategoryType;
  reported_by: string;
  reported_by_name?: string;
  assigned_frame: FrameType;
  urgency: UrgencyType;
  status: GapStatusType;
  handler_id?: string;
  handler_name?: string;
  requires_commander_decision: boolean;
  notes?: string;
  created_at: string;
}

export type RequestStatusType = 'נפתחה' | 'בטיפול' | 'ממתין לאישור' | 'סופק' | 'נסגר' | 'תקוע';

export type RequestTypeType = 'ציוד' | 'כשירות' | 'תחמושת' | 'הזנה' | 'אחר';

export interface LogisticsRequest {
  id: string;
  title: string;
  description: string;
  requesting_frame: FrameType;
  requested_by: string;
  requested_by_name?: string;
  handler_id?: string;
  handler_name?: string;
  status: RequestStatusType;
  due_date: string;
  type: RequestTypeType;
  created_at: string;
}

export interface AbsentDetail {
  name: string;
  reason: string;
}

export interface PlanVsActual {
  subject: string;
  planned: string;
  actual: string;
  completed: boolean;
}

export type ForumStatusType = 'בתהליך' | 'מוכן';

export interface ForumSummary {
  id: string;
  date: string;
  assigned_frame: FrameType;
  author_id: string;
  author_name?: string;
  status: ForumStatusType;
  present_count: number;
  total_count: number;
  absent_details: AbsentDetail[];
  welfare_notes?: string;
  medical_notes?: string;
  logistics_notes?: string;
  readiness_notes?: string;
  plan_vs_actual: PlanVsActual[];
  daily_lesson?: string;
  commander_decisions: string[];
  returned_note?: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  user_name: string;
  user_role: RoleType;
  action: string;
  target_type: 'task' | 'gap' | 'logistics' | 'forum' | 'user' | 'system';
  target_id: string;
  details: string;
  timestamp: string;
}

export interface DbAuditLog {
  id: string;
  user_id: string | null;
  user_name: string | null;
  user_role: string | null;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  previous_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
}

export interface DbTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string | null;
  assigned_to: string | null;
  created_by: string | null;
  unit_id: string | null;
  due_at: string | null;
  completed_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface TrackingColumn {
  id: string;
  name: string;
  category: 'לוחמה' | 'שיעורים' | 'חניכה' | 'כשירות' | 'לוגיסטיקה';
  assigned_frame: FrameType;
  order: number;
}

export interface TrackingCell {
  id: string;
  soldier_name: string;
  assigned_frame: FrameType;
  column_id: string;
  value: 'ריק' | 'עבר' | 'לא עבר' | 'השלמה';
  updated_by: string;
}
