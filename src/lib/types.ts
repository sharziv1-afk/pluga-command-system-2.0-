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
  event_id: string | null;
  due_at: string | null;
  completed_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface DbEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: 'training' | 'logistics' | 'meeting' | 'inspection' | 'operation' | 'admin' | 'other';
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  unit_id: string | null;
  created_by: string | null;
  responsible_user_id: string | null;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type TrackingStatus = 'empty' | 'passed' | 'failed' | 'makeup';

export interface DbSoldier {
  id: string;
  full_name: string;
  personal_number: string | null;
  unit_id: string;
  squad_label: string | null;
  role_label: string | null;
  notes: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbTrackingItem {
  id: string;
  title: string;
  description: string | null;
  category: string;
  subject: string | null;
  sort_order: number;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbTrackingRecord {
  id: string;
  soldier_id: string;
  tracking_item_id: string;
  status: TrackingStatus;
  note: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}
