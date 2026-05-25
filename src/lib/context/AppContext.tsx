'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  Profile, Task, Gap, LogisticsRequest, ForumSummary, AuditLog, 
  RoleType, FrameType, TaskStatusType, TaskPriorityType, TaskCategoryType,
  GapStatusType, GapCategoryType, UrgencyType, RequestStatusType, RequestTypeType
} from '../types';
import { fetchCurrentProfile } from '../supabase/profile';

interface AppContextProps {
  // Authentication & Session
  currentUser: Profile | null;
  activeRole: RoleType | null;
  activeFrame: FrameType | null;
  isSimulating: boolean;
  isLoading: boolean;
  login: (email: string) => Promise<boolean>;
  register: (fullName: string, email: string, role: RoleType, frame: FrameType) => Promise<void>;
  logout: () => void;
  setSimulation: (role: RoleType, frame: FrameType) => void;
  resetSimulation: () => void;
  
  // Database Operations
  profiles: Profile[];
  approveUser: (userId: string) => void;
  rejectUser: (userId: string) => void;
  
  tasks: Task[];
  addTask: (task: Omit<Task, 'id' | 'created_at'>) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  deleteTask: (taskId: string) => void;
  
  gaps: Gap[];
  addGap: (gap: Omit<Gap, 'id' | 'created_at'>) => void;
  updateGap: (gapId: string, updates: Partial<Gap>) => void;
  convertGapToTask: (gapId: string, taskDetails: Omit<Task, 'id' | 'created_at' | 'source_type' | 'source_id'>) => void;
  
  requests: LogisticsRequest[];
  addRequest: (req: Omit<LogisticsRequest, 'id' | 'created_at'>) => void;
  updateRequest: (reqId: string, updates: Partial<LogisticsRequest>) => void;
  
  forumSummaries: ForumSummary[];
  addForumSummary: (summary: Omit<ForumSummary, 'id' | 'created_at'>) => void;
  updateForumSummary: (summaryId: string, updates: Partial<ForumSummary>) => void;
  
  auditLogs: AuditLog[];
  addAudit: (action: string, targetType: AuditLog['target_type'], targetId: string, details: string) => void;
}

const AppContext = createContext<AppContextProps | undefined>(undefined);

// ==================== SEED DATA ====================

const initialProfiles: Profile[] = [
  {
    id: 'user-mp',
    email: 'mp@army.gov.il',
    full_name: 'רס"ן אוריאל דוד',
    role: 'מ"פ',
    assigned_frame: 'פלוגה',
    status: 'approved',
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'user-smp',
    email: 'smp@army.gov.il',
    full_name: 'סרן איתי רפאל',
    role: 'סמ"פ',
    assigned_frame: 'פלוגה',
    status: 'approved',
    created_at: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'user-rasap',
    email: 'rasap@army.gov.il',
    full_name: 'רס"ל ערן כהן',
    role: 'רס"פ',
    assigned_frame: 'מפל"ג',
    status: 'approved',
    created_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'user-mm1',
    email: 'mm1@army.gov.il',
    full_name: 'סג"ם עמית מאיר',
    role: 'מ"מ',
    assigned_frame: 'מחלקה 1',
    status: 'approved',
    created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'user-mk1',
    email: 'mk1@army.gov.il',
    full_name: 'סמ"ר דניאל לוי',
    role: 'מ"כ',
    assigned_frame: 'כיתה 1',
    status: 'approved',
    created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'user-pending-mm2',
    email: 'pending_mm2@army.gov.il',
    full_name: 'סג"ם רוני אלבז',
    role: 'מ"מ',
    assigned_frame: 'מחלקה 2',
    status: 'pending',
    created_at: new Date().toISOString()
  }
];

const initialTasks: Task[] = [
  {
    id: 'task-1',
    title: 'אישור תוכניות (אש"ת) לתרגיל פלוגתי רטוב',
    description: 'הכנת מצגת אש"ת מלאה כולל צירי התקדמות, אמצעי קשר, סיוע מנהלתי ולו"ז. הצגה למח"ט ביום חמישי ב-14:00.',
    creator_id: 'user-mp',
    creator_name: 'רס"ן אוריאל דוד',
    owner_id: 'user-smp',
    owner_name: 'סרן איתי רפאל',
    assigned_frame: 'פלוגה',
    status: 'בתהליך',
    priority: 'קריטי',
    category: 'לוחמה',
    deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    location: 'חדר דיונים חטיבתי',
    output_required: 'מצגת אש"ת מאושרת על ידי המח"ט',
    control_questions: [
      'האם ציר המילוט הלוגיסטי מאושר?',
      'האם בוצע תיאום קשר מול הגדוד השכן?'
    ],
    requires_commander_decision: true,
    source_type: 'manual',
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'task-2',
    title: 'השלמת מטווחים והסמכות כשירות קליעה למחלקה 1',
    description: 'ביצוע יום מטווחים מרוכז להשלמת כשירות ירי יום/לילה ל-15 לוחמים שלא השלימו את המקצה האחרון.',
    creator_id: 'user-mp',
    creator_name: 'רס"ן אוריאל דוד',
    owner_id: 'user-mm1',
    owner_name: 'סג"ם עמית מאיר',
    assigned_frame: 'מחלקה 1',
    status: 'לביצוע',
    priority: 'חשוב',
    category: 'חניכה',
    deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    location: 'מטווח 24',
    output_required: 'דוח 1 מעודכן עם 100% הסמכות',
    control_questions: [
      'האם הוזמנה תחמושת ייעודית מראש?',
      'האם יש חובש מלווה למטווח?'
    ],
    requires_commander_decision: false,
    source_type: 'gap',
    source_id: 'gap-1',
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'task-3',
    title: 'מסדר פלוגתי לביקורת אמל"ח וציוד לחימה ב\'',
    description: 'פריסת כלל הציוד הפלוגתי במגרש המסדרים. רס"פ יוביל את הרישום והשלמת החוסרים מול המחסן הגדודי.',
    creator_id: 'user-smp',
    creator_name: 'סרן איתי רפאל',
    owner_id: 'user-rasap',
    owner_name: 'רס"ל ערן כהן',
    assigned_frame: 'מפל"ג',
    status: 'חדשה',
    priority: 'דחוף',
    category: 'לוגיסטיקה',
    deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    location: 'מגרש מסדרים פלוגתי',
    output_required: 'טבלת חוסרים חתומה על ידי הסמ"פ',
    control_questions: [
      'האם הוזמנו חלקי חילוף לנשקים תקועים?',
      'האם הוכנו ארגזי חריגים?'
    ],
    requires_commander_decision: false,
    source_type: 'manual',
    created_at: new Date().toISOString()
  }
];

const initialGaps: Gap[] = [
  {
    id: 'gap-1',
    title: 'חוסר של 5 מכשירי קשר תקינים במחלקת החוד',
    description: 'מכשירי הקשר הישנים יצאו מכלל שימוש. קיים קושי בפיקוד ובקרה בתרגילים מחלקתיים.',
    category: 'לוגיסטי',
    reported_by: 'user-mm1',
    reported_by_name: 'סג"ם עמית מאיר',
    assigned_frame: 'מחלקה 1',
    urgency: 'דחוף',
    status: 'בטיפול',
    handler_id: 'user-rasap',
    handler_name: 'רס"ל ערן כהן',
    requires_commander_decision: true,
    notes: 'הרס"פ פתח דרישה מול מחסן קשר אוגדתי. ממתינים למשיכה.',
    created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'gap-2',
    title: 'חוסר בהסמכת מדריכת קליעה לתרגיל פלוגתי',
    description: 'על פי פקודות הבטיחות, לא ניתן לבצע ירי רטוב ללא נוכחות מדריכת קליעה או מפקד מטווח מוסמך.',
    category: 'הדרכתי',
    reported_by: 'user-smp',
    reported_by_name: 'סרן איתי רפאל',
    assigned_frame: 'פלוגה',
    urgency: 'קריטי',
    status: 'פתוח',
    requires_commander_decision: true,
    notes: 'הסמ"פ מנסה לקבל הקצאה מבית הספר לקליעה באוגדה.',
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  }
];

const initialRequests: LogisticsRequest[] = [
  {
    id: 'req-1',
    title: 'מנות קרב ומים ל-120 לוחמים ליום שטח מחלקתי',
    description: "דרישת אספקת 30 מארזי מנות קרב, 20 ג'ריקנים מים מלאים ומצרכי פריסה לשטח.",
    requesting_frame: 'מחלקה 1',
    requested_by: 'user-mm1',
    requested_by_name: 'סג"ם עמית מאיר',
    handler_id: 'user-rasap',
    handler_name: 'רס"ל ערן כהן',
    status: 'בטיפול',
    due_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
    type: 'הזנה',
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'req-2',
    title: 'השלמת 40 פנסים אישיים טקטיים לקראת תרגיל לילה',
    description: 'חוסר בפנסי ראש אדומים המתאימים לעבודה חשוכה במבצעים.',
    requesting_frame: 'מחלקה 2',
    requested_by: 'user-pending-mm2',
    requested_by_name: 'סג"ם רוני אלבז',
    handler_id: 'user-rasap',
    handler_name: 'רס"ל ערן כהן',
    status: 'נפתחה',
    due_date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
    type: 'ציוד',
    created_at: new Date().toISOString()
  }
];

const initialForumSummaries: ForumSummary[] = [
  {
    id: 'forum-1',
    date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    assigned_frame: 'מחלקה 1',
    author_id: 'user-mm1',
    author_name: 'סג"ם עמית מאיר',
    status: 'מוכן',
    present_count: 28,
    total_count: 30,
    absent_details: [
      { name: 'סמל מתן לוי', reason: 'חופשת מחלה (גימלים)' },
      { name: 'לוחם ניב שרון', reason: 'שמירה בבסיס עורפי' }
    ],
    welfare_notes: 'אין נושאי ת"ש חריגים. לוחם אחד ממתין לשיחת משק"ית ת"ש ביום ראשון.',
    medical_notes: 'לוחם אחד עם פטור זמני מנעליים (דרמטולוגי), מבצע עבודות רס"פ.',
    logistics_notes: 'הוזמנה השלמת שקי שינה. קיבלנו את מנות המים שביקשנו.',
    readiness_notes: 'כוננות מלאה לקראת שבוע השטח.',
    plan_vs_actual: [
      { subject: 'אימון קרב מגע', planned: '14:00-16:00', actual: 'בוצע במלואו', completed: true },
      { subject: 'שיעור עזרה ראשונה', planned: '16:30-18:00', actual: 'קוצר בשל מסדר בטיחות', completed: false }
    ],
    daily_lesson: 'מומלץ לבצע תדריכי בטיחות בנשק בקבוצות קטנות יותר כדי לשפר את יעילות הזמן.',
    commander_decisions: ['אישור יציאת סמל מחלקה לחופשה מיוחדת.'],
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  }
];

const initialAuditLogs: AuditLog[] = [
  {
    id: 'audit-1',
    user_id: 'user-mp',
    user_name: 'רס"ן אוריאל דוד',
    user_role: 'מ"פ',
    action: 'אתחול מערכת',
    target_type: 'system',
    target_id: 'system-root',
    details: 'מערכת הפיקוד הפלוגתית הופעלה לראשונה בגרסה 2.0 (Clean Rebuild).',
    timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'audit-2',
    user_id: 'user-smp',
    user_name: 'סרן איתי רפאל',
    user_role: 'סמ"פ',
    action: 'יצירת משימה',
    target_type: 'task',
    target_id: 'task-3',
    details: 'נוצרה משימת "מסדר פלוגתי לביקורת אמל"ח וציוד לחימה ב"".',
    timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
  }
];

// ==================== PROVIDER COMPONENT ====================

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Database States
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [requests, setRequests] = useState<LogisticsRequest[]>([]);
  const [forumSummaries, setForumSummaries] = useState<ForumSummary[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Auth / Active View States
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [activeRole, setActiveRole] = useState<RoleType | null>(null);
  const [activeFrame, setActiveFrame] = useState<FrameType | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize DB from LocalStorage or Seed Data
  useEffect(() => {
    const getOrSet = <T,>(key: string, initial: T): T => {
      const data = localStorage.getItem(key);
      if (data) {
        try { return JSON.parse(data); } catch { return initial; }
      }
      localStorage.setItem(key, JSON.stringify(initial));
      return initial;
    };

    setProfiles(getOrSet('pluga_profiles', initialProfiles));
    setTasks(getOrSet('pluga_tasks', initialTasks));
    setGaps(getOrSet('pluga_gaps', initialGaps));
    setRequests(getOrSet('pluga_requests', initialRequests));
    setForumSummaries(getOrSet('pluga_forum_summaries', initialForumSummaries));
    setAuditLogs(getOrSet('pluga_audit_logs', initialAuditLogs));

    async function initializeAuth() {
      setIsLoading(true);
      try {
        const supabaseProfile = await fetchCurrentProfile();
        if (supabaseProfile) {
          setCurrentUser(supabaseProfile);
          setActiveRole(supabaseProfile.role);
          setActiveFrame(supabaseProfile.assigned_frame);
          setIsSimulating(false);
          setIsLoading(false);
          return;
        }
      } catch (err) {
        console.error('Failed to load profile from Supabase, falling back to mock state:', err);
      }

      // LocalStorage/Mock Fallback
      const sessionUser = localStorage.getItem('pluga_session');
      if (sessionUser) {
        try {
          const user = JSON.parse(sessionUser) as Profile;
          setCurrentUser(user);
          
          const simRole = localStorage.getItem('pluga_sim_role');
          const simFrame = localStorage.getItem('pluga_sim_frame');
          if (simRole && simFrame) {
            setActiveRole(simRole as RoleType);
            setActiveFrame(simFrame as FrameType);
            setIsSimulating(true);
          } else {
            setActiveRole(user.role);
            setActiveFrame(user.assigned_frame);
          }
        } catch {
          const defaultMp = initialProfiles.find(p => p.role === 'מ"פ') || null;
          setCurrentUser(defaultMp);
          setActiveRole(defaultMp?.role || null);
          setActiveFrame(defaultMp?.assigned_frame || null);
        }
      } else {
        const defaultMp = initialProfiles.find(p => p.role === 'מ"פ') || null;
        setCurrentUser(defaultMp);
        setActiveRole(defaultMp?.role || null);
        setActiveFrame(defaultMp?.assigned_frame || null);
        if (defaultMp) {
          localStorage.setItem('pluga_session', JSON.stringify(defaultMp));
        }
      }
      setIsLoading(false);
    }

    initializeAuth();
  }, []);

  // Helper to persist states to localStorage
  const saveToStorage = (key: string, data: any) => {
    localStorage.setItem(key, JSON.stringify(data));
  };

  // Add an Audit Log
  const addAudit = (action: string, targetType: AuditLog['target_type'], targetId: string, details: string) => {
    if (!currentUser) return;
    
    const newLog: AuditLog = {
      id: `audit-${Math.random().toString(36).substr(2, 9)}`,
      user_id: currentUser.id,
      user_name: currentUser.full_name,
      user_role: activeRole || currentUser.role,
      action,
      target_type: targetType,
      target_id: targetId,
      details,
      timestamp: new Date().toISOString()
    };

    setAuditLogs(prev => {
      const updated = [newLog, ...prev].slice(0, 200); // limit to 200 logs
      saveToStorage('pluga_audit_logs', updated);
      return updated;
    });
  };

  // ==================== AUTH OPERATIONS ====================

  const login = async (email: string): Promise<boolean> => {
    const user = profiles.find(p => p.email === email);
    if (!user) return false;

    setCurrentUser(user);
    setActiveRole(user.role);
    setActiveFrame(user.assigned_frame);
    setIsSimulating(false);
    
    localStorage.setItem('pluga_session', JSON.stringify(user));
    localStorage.removeItem('pluga_sim_role');
    localStorage.removeItem('pluga_sim_frame');

    // Add Audit Log
    const newLog: AuditLog = {
      id: `audit-${Math.random().toString(36).substr(2, 9)}`,
      user_id: user.id,
      user_name: user.full_name,
      user_role: user.role,
      action: 'התחברות משתמש',
      target_type: 'user',
      target_id: user.id,
      details: `המשתמש ${user.full_name} התחבר למערכת בהצלחה בתפקיד ${user.role}.`,
      timestamp: new Date().toISOString()
    };

    setAuditLogs(prev => {
      const updated = [newLog, ...prev];
      saveToStorage('pluga_audit_logs', updated);
      return updated;
    });

    return true;
  };

  const register = async (fullName: string, email: string, role: RoleType, frame: FrameType): Promise<void> => {
    const newProfile: Profile = {
      id: `user-${Math.random().toString(36).substr(2, 9)}`,
      email,
      full_name: fullName,
      role,
      assigned_frame: frame,
      status: 'pending', // Starts pending! Mandatory onboarding
      created_at: new Date().toISOString()
    };

    const updatedProfiles = [...profiles, newProfile];
    setProfiles(updatedProfiles);
    saveToStorage('pluga_profiles', updatedProfiles);

    // Auto log-in to pending screen
    setCurrentUser(newProfile);
    setActiveRole(newProfile.role);
    setActiveFrame(newProfile.assigned_frame);
    setIsSimulating(false);
    localStorage.setItem('pluga_session', JSON.stringify(newProfile));

    // Audit log
    const newLog: AuditLog = {
      id: `audit-${Math.random().toString(36).substr(2, 9)}`,
      user_id: newProfile.id,
      user_name: newProfile.full_name,
      user_role: newProfile.role,
      action: 'רישום למערכת (Onboarding)',
      target_type: 'user',
      target_id: newProfile.id,
      details: `המשתמש ${newProfile.full_name} נרשם למערכת והועבר לאישור מפקד. תפקיד מבוקש: ${newProfile.role}, מסגרת: ${newProfile.assigned_frame}.`,
      timestamp: new Date().toISOString()
    };

    setAuditLogs(prev => {
      const updated = [newLog, ...prev];
      saveToStorage('pluga_audit_logs', updated);
      return updated;
    });
  };

  const logout = () => {
    setCurrentUser(null);
    setActiveRole(null);
    setActiveFrame(null);
    setIsSimulating(false);
    localStorage.removeItem('pluga_session');
    localStorage.removeItem('pluga_sim_role');
    localStorage.removeItem('pluga_sim_frame');
  };

  // Role Simulation flow
  const setSimulation = (role: RoleType, frame: FrameType) => {
    if (!currentUser || (currentUser.role !== 'מ"פ' && currentUser.role !== 'סמ"פ')) return;
    
    setActiveRole(role);
    setActiveFrame(frame);
    setIsSimulating(true);
    
    localStorage.setItem('pluga_sim_role', role);
    localStorage.setItem('pluga_sim_frame', frame);

    addAudit(
      'הדמיית תפקיד', 
      'user', 
      currentUser.id, 
      `${currentUser.full_name} נכנס למצב הדמיה של תפקיד ${role} במסגרת ${frame}.`
    );
  };

  const resetSimulation = () => {
    if (!currentUser) return;
    
    setActiveRole(currentUser.role);
    setActiveFrame(currentUser.assigned_frame);
    setIsSimulating(false);
    
    localStorage.removeItem('pluga_sim_role');
    localStorage.removeItem('pluga_sim_frame');

    addAudit(
      'יציאה מהדמיית תפקיד', 
      'user', 
      currentUser.id, 
      `${currentUser.full_name} חזר לתפקידו המקורי כמפקד במערכת.`
    );
  };

  // ==================== PROFILE MANAGEMENT ====================

  const approveUser = (userId: string) => {
    const updated = profiles.map(p => p.id === userId ? { ...p, status: 'approved' as const } : p);
    setProfiles(updated);
    saveToStorage('pluga_profiles', updated);

    // If the approved user is the current user (e.g. testing pending state), update session
    if (currentUser && currentUser.id === userId) {
      const updatedCurrentUser = { ...currentUser, status: 'approved' as const };
      setCurrentUser(updatedCurrentUser);
      saveToStorage('pluga_session', updatedCurrentUser);
    }

    const approvedUser = profiles.find(p => p.id === userId);
    if (approvedUser && currentUser) {
      addAudit(
        'אישור משתמש', 
        'user', 
        userId, 
        `${currentUser.full_name} אישר את בקשת הגישה של ${approvedUser.full_name} בתפקיד ${approvedUser.role}.`
      );
    }
  };

  const rejectUser = (userId: string) => {
    const updated = profiles.map(p => p.id === userId ? { ...p, status: 'rejected' as const } : p);
    setProfiles(updated);
    saveToStorage('pluga_profiles', updated);

    const rejectedUser = profiles.find(p => p.id === userId);
    if (rejectedUser && currentUser) {
      addAudit(
        'דחיית משתמש', 
        'user', 
        userId, 
        `${currentUser.full_name} דחה את בקשת הגישה של ${rejectedUser.full_name}.`
      );
    }
  };

  // ==================== TASK OPERATIONS ====================

  const addTask = (taskData: Omit<Task, 'id' | 'created_at'>) => {
    const newTask: Task = {
      ...taskData,
      id: `task-${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString()
    };

    setTasks(prev => {
      const updated = [newTask, ...prev];
      saveToStorage('pluga_tasks', updated);
      return updated;
    });

    addAudit(
      'יציאת משימה', 
      'task', 
      newTask.id, 
      `נוצרה משימה חדשה: "${newTask.title}" עבור מסגרת ${newTask.assigned_frame}.`
    );
  };

  const updateTask = (taskId: string, updates: Partial<Task>) => {
    setTasks(prev => {
      const updated = prev.map(t => t.id === taskId ? { ...t, ...updates } : t);
      saveToStorage('pluga_tasks', updated);
      return updated;
    });

    const originalTask = tasks.find(t => t.id === taskId);
    if (originalTask) {
      const changes = Object.keys(updates).map(k => {
        if (k === 'status') return `סטטוס שונה מ-"${originalTask.status}" ל-"${updates.status}"`;
        if (k === 'stuck_reason') return `סיבת תקיעה: "${updates.stuck_reason}"`;
        return `שדה ${k} עודכן`;
      }).join(', ');

      addAudit(
        'עדכון משימה', 
        'task', 
        taskId, 
        `המשימה "${originalTask.title}" עודכנה: ${changes}.`
      );
    }
  };

  const deleteTask = (taskId: string) => {
    const originalTask = tasks.find(t => t.id === taskId);
    setTasks(prev => {
      const updated = prev.filter(t => t.id !== taskId);
      saveToStorage('pluga_tasks', updated);
      return updated;
    });

    if (originalTask) {
      addAudit(
        'מחיקת משימה', 
        'task', 
        taskId, 
        `המשימה "${originalTask.title}" נמחקה לצמיתות מהמערכת.`
      );
    }
  };

  // ==================== GAP OPERATIONS ====================

  const addGap = (gapData: Omit<Gap, 'id' | 'created_at'>) => {
    const newGap: Gap = {
      ...gapData,
      id: `gap-${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString()
    };

    setGaps(prev => {
      const updated = [newGap, ...prev];
      saveToStorage('pluga_gaps', updated);
      return updated;
    });

    addAudit(
      'דיווח פער', 
      'gap', 
      newGap.id, 
      `דווח פער חדש: "${newGap.title}" במסגרת ${newGap.assigned_frame} בדחיפות ${newGap.urgency}.`
    );
  };

  const updateGap = (gapId: string, updates: Partial<Gap>) => {
    setGaps(prev => {
      const updated = prev.map(g => g.id === gapId ? { ...g, ...updates } : g);
      saveToStorage('pluga_gaps', updated);
      return updated;
    });

    const originalGap = gaps.find(g => g.id === gapId);
    if (originalGap) {
      const changes = Object.keys(updates).map(k => {
        if (k === 'status') return `סטטוס פער שונה ל-"${updates.status}"`;
        return `עודכן שדה ${k}`;
      }).join(', ');

      addAudit(
        'עדכון פער', 
        'gap', 
        gapId, 
        `הפער "${originalGap.title}" עודכן: ${changes}.`
      );
    }
  };

  const convertGapToTask = (
    gapId: string, 
    taskDetails: Omit<Task, 'id' | 'created_at' | 'source_type' | 'source_id'>
  ) => {
    // 1. Add Task linked to Gap
    const newTask: Task = {
      ...taskDetails,
      id: `task-${Math.random().toString(36).substr(2, 9)}`,
      source_type: 'gap',
      source_id: gapId,
      created_at: new Date().toISOString()
    };

    setTasks(prev => {
      const updated = [newTask, ...prev];
      saveToStorage('pluga_tasks', updated);
      return updated;
    });

    // 2. Update Gap status to 'בטיפול'
    updateGap(gapId, { status: 'בטיפול', notes: `הומר למשימה: "${newTask.title}"` });

    addAudit(
      'המרת פער למשימה', 
      'gap', 
      gapId, 
      `הפער הומר למשימת עבודה פתוחה: "${newTask.title}". המשימה הוקצתה ל-${newTask.owner_name}.`
    );
  };

  // ==================== LOGISTICS REQUESTS ====================

  const addRequest = (reqData: Omit<LogisticsRequest, 'id' | 'created_at'>) => {
    const newReq: LogisticsRequest = {
      ...reqData,
      id: `req-${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString()
    };

    setRequests(prev => {
      const updated = [newReq, ...prev];
      saveToStorage('pluga_requests', updated);
      return updated;
    });

    addAudit(
      'בקשה לוגיסטית', 
      'logistics', 
      newReq.id, 
      `נפתחה דרישה לוגיסטית חדשה: "${newReq.title}" מסוג ${newReq.type} עבור ${newReq.requesting_frame}.`
    );
  };

  const updateRequest = (reqId: string, updates: Partial<LogisticsRequest>) => {
    setRequests(prev => {
      const updated = prev.map(r => r.id === reqId ? { ...r, ...updates } : r);
      saveToStorage('pluga_requests', updated);
      return updated;
    });

    const originalReq = requests.find(r => r.id === reqId);
    if (originalReq) {
      const changes = Object.keys(updates).map(k => {
        if (k === 'status') return `סטטוס שונה ל-"${updates.status}"`;
        return `עודכן שדה ${k}`;
      }).join(', ');

      addAudit(
        'עדכון דרישה לוגיסטית', 
        'logistics', 
        reqId, 
        `הדרישה הלוגיסטית "${originalReq.title}" עודכנה: ${changes}.`
      );
    }
  };

  // ==================== FORUM SUMMARIES ====================

  const addForumSummary = (sumData: Omit<ForumSummary, 'id' | 'created_at'>) => {
    const newSum: ForumSummary = {
      ...sumData,
      id: `forum-${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString()
    };

    setForumSummaries(prev => {
      const updated = [newSum, ...prev];
      saveToStorage('pluga_forum_summaries', updated);
      return updated;
    });

    addAudit(
      'פורום מוביל', 
      'forum', 
      newSum.id, 
      `הוגש סיכום יומי חדש עבור ${newSum.assigned_frame} בתאריך ${newSum.date}.`
    );
  };

  const updateForumSummary = (summaryId: string, updates: Partial<ForumSummary>) => {
    setForumSummaries(prev => {
      const updated = prev.map(s => s.id === summaryId ? { ...s, ...updates } : s);
      saveToStorage('pluga_forum_summaries', updated);
      return updated;
    });

    const originalSum = forumSummaries.find(s => s.id === summaryId);
    if (originalSum) {
      addAudit(
        'עדכון פורום מוביל', 
        'forum', 
        summaryId, 
        `סיכום יומי של ${originalSum.assigned_frame} מיום ${originalSum.date} עודכן במערכת.`
      );
    }
  };

  return (
    <AppContext.Provider value={{
      currentUser,
      activeRole,
      activeFrame,
      isSimulating,
      isLoading,
      login,
      register,
      logout,
      setSimulation,
      resetSimulation,
      
      profiles,
      approveUser,
      rejectUser,
      
      tasks,
      addTask,
      updateTask,
      deleteTask,
      
      gaps,
      addGap,
      updateGap,
      convertGapToTask,
      
      requests,
      addRequest,
      updateRequest,
      
      forumSummaries,
      addForumSummary,
      updateForumSummary,
      
      auditLogs,
      addAudit
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
