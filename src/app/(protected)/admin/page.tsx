'use client';

import React, { useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { GlossyButton } from '@/components/ui/GlossyButton';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useApp } from '@/lib/context/AppContext';
import { getPermissionLevelForRole } from '@/lib/permissions';
import { 
  Shield, 
  UserCheck, 
  UserX, 
  Clock, 
  Database, 
  ShieldAlert, 
  Loader2, 
  Check, 
  X, 
  Edit2,
  Lock
} from 'lucide-react';

interface DbUnit {
  id: string;
  name: string;
}

interface DbRole {
  name: string;
}

interface AdminUserProfile {
  id: string;
  auth_user_id: string | null;
  email: string;
  name: string;
  role: string;
  unit_id: string | null;
  permission_level: number;
  role_approval_status: 'pending' | 'approved' | 'rejected';
  status: 'active' | 'pending' | 'blocked' | 'inactive';
  created_at: string;
  units: { name: string } | null;
}

export default function AdminPage() {
  const { currentUser, isLoading: isContextLoading } = useApp();
  
  const [profilesList, setProfilesList] = useState<AdminUserProfile[]>([]);
  const [roles, setRoles] = useState<DbRole[]>([]);
  const [units, setUnits] = useState<DbUnit[]>([]);
  
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isActionSubmitting, setIsActionSubmitting] = useState<string | null>(null);
  const [rlsError, setRlsError] = useState<string | null>(null);

  // Inline edit state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState('');
  const [editUnitId, setEditUnitId] = useState<string>('none');
  const [editPermissionLevel, setEditPermissionLevel] = useState<number>(0);

  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    async function loadAdminData() {
      setIsLoadingData(true);
      setRlsError(null);

      try {
        const [{ data: rolesData }, { data: unitsData }, { data: usersData, error: usersError }] = await Promise.all([
          supabase.from('roles').select('name').order('permission_level', { ascending: false }),
          supabase.from('units').select('id,name').order('created_at', { ascending: true }),
          supabase.from('users').select('*, units(name)').order('created_at', { ascending: false })
        ]);

        if (rolesData) setRoles(rolesData);
        if (unitsData) setUnits(unitsData);

        if (usersError) {
          console.error('Database users fetch error:', usersError);
          // "בינתיים אפשר להציג error ברור: נדרשת מדיניות RLS נוספת לניהול משתמשים"
          if (usersError.code === '42501') {
            setRlsError('נדרשת מדיניות RLS (Row Level Security) נוספת לניהול משתמשים. אנא ודא שהרצת את קוד ה-SQL המתאים בסופבייס.');
          } else {
            setRlsError(`שגיאת מסד נתונים: ${usersError.message}`);
          }
        } else if (usersData) {
          setProfilesList(usersData as AdminUserProfile[]);
        }
      } catch (err) {
        console.error('Failed to load admin data:', err);
        setRlsError('שגיאה בלתי צפויה בטעינת נתוני מנהל.');
      } finally {
        setIsLoadingData(false);
      }
    }

    if (currentUser) {
      loadAdminData();
    }
  }, [currentUser]);

  // Authorization Check
  const isAuthorized = currentUser && (
    (currentUser.role as string) === 'מ״פ' || 
    (currentUser.role as string) === 'מ"פ' || 
    (currentUser.role as string) === 'סמ״פ' || 
    (currentUser.role as string) === 'סמ"פ'
  ) && currentUser.status === 'approved';

  if (isContextLoading || isLoadingData) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#FF6B02]" />
          <span className="text-sm font-black text-slate-400">טוען בקרת גישה פלוגתית...</span>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="space-y-6 text-right">
        <PageHeader title="אישור מפקדים" subtitle="ניהול הרשאות ואישורי סגל פלוגתי" />
        <GlassCard className="py-12 flex flex-col items-center justify-center text-center text-slate-500">
          <Lock className="w-12 h-12 mb-3 text-[#FF6B02]" />
          <span className="text-sm font-black text-[#020108]">אין לך הרשאות גישה למסך זה</span>
          <p className="text-xs text-[#667085] mt-2 max-w-sm leading-relaxed">
            הגישה לפאנל ניהול הרשאות מוגבלת למפקד הפלוגה (מ״פ) או סגנו (סמ״פ) בלבד, ופרופיל המפקד שלך חייב להיות מאושר במערכת.
          </p>
        </GlassCard>
      </div>
    );
  }

  const handleApprove = async (userId: string, role: string) => {
    setIsActionSubmitting(userId);
    setRlsError(null);

    const calculatedLevel = getPermissionLevelForRole(role);

    try {
      const { error } = await supabase
        .from('users')
        .update({
          status: 'active',
          role_approval_status: 'approved',
          permission_level: calculatedLevel,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        console.error('Failed to approve user:', error);
        if (error.code === '42501') {
          setRlsError('נדרשת מדיניות RLS (Row Level Security) נוספת לניהול משתמשים. אנא ודא שהרצת את קוד ה-SQL המתאים בסופבייס.');
        } else {
          setRlsError(`שגיאת עדכון: ${error.message}`);
        }
        return;
      }

      // Local state update
      setProfilesList(prev => 
        prev.map(p => p.id === userId ? { ...p, status: 'active', role_approval_status: 'approved', permission_level: calculatedLevel } : p)
      );
    } catch (err) {
      console.error(err);
      setRlsError('שגיאה בלתי צפויה בעת אישור משתמש.');
    } finally {
      setIsActionSubmitting(null);
    }
  };

  const handleReject = async (userId: string) => {
    setIsActionSubmitting(userId);
    setRlsError(null);

    try {
      const { error } = await supabase
        .from('users')
        .update({
          status: 'inactive',
          role_approval_status: 'rejected',
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        console.error('Failed to reject user:', error);
        if (error.code === '42501') {
          setRlsError('נדרשת מדיניות RLS (Row Level Security) נוספת לניהול משתמשים. אנא ודא שהרצת את קוד ה-SQL המתאים בסופבייס.');
        } else {
          setRlsError(`שגיאת עדכון: ${error.message}`);
        }
        return;
      }

      setProfilesList(prev => 
        prev.map(p => p.id === userId ? { ...p, status: 'inactive', role_approval_status: 'rejected' } : p)
      );
    } catch (err) {
      console.error(err);
      setRlsError('שגיאה בלתי צפויה בעת דחיית משתמש.');
    } finally {
      setIsActionSubmitting(null);
    }
  };

  const startEditing = (user: AdminUserProfile) => {
    setEditingUserId(user.id);
    setEditRole(user.role);
    setEditUnitId(user.unit_id || 'none');
    setEditPermissionLevel(user.permission_level);
  };

  const handleRoleChange = (selectedRole: string) => {
    setEditRole(selectedRole);
    setEditPermissionLevel(getPermissionLevelForRole(selectedRole));
  };

  const saveEdit = async (userId: string) => {
    setIsActionSubmitting(userId);
    setRlsError(null);

    const mappedUnitId = editUnitId === 'none' ? null : editUnitId;
    const unitName = units.find(u => u.id === mappedUnitId)?.name || null;

    try {
      const { error } = await supabase
        .from('users')
        .update({
          role: editRole,
          unit_id: mappedUnitId,
          permission_level: editPermissionLevel,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        console.error('Failed to save profile edits:', error);
        if (error.code === '42501') {
          setRlsError('נדרשת מדיניות RLS (Row Level Security) נוספת לניהול משתמשים. אנא ודא שהרצת את קוד ה-SQL המתאים בסופבייס.');
        } else {
          setRlsError(`שגיאת עדכון: ${error.message}`);
        }
        return;
      }

      setProfilesList(prev => 
        prev.map(p => p.id === userId ? { 
          ...p, 
          role: editRole, 
          unit_id: mappedUnitId, 
          permission_level: editPermissionLevel,
          units: unitName ? { name: unitName } : null
        } : p)
      );
      setEditingUserId(null);
    } catch (err) {
      console.error(err);
      setRlsError('שגיאה בלתי צפויה בעת שמירת שינויים.');
    } finally {
      setIsActionSubmitting(null);
    }
  };

  const activeRequests = profilesList.filter(r => r.role_approval_status === 'pending');
  const pastRequests = profilesList.filter(r => r.role_approval_status !== 'pending');

  return (
    <div className="space-y-6 text-right">
      {/* Page Header */}
      <PageHeader 
        title="ניהול הרשאות ואישור מפקדים" 
        subtitle="בקרת גישה פלוגתית מאובטחת. כאן מפקד הפלוגה (המ״פ) או הסמ״פ מאשרים בקשות הצטרפות של מפקדים וסגל המפל״ג למערכת."
      />

      {rlsError && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm leading-relaxed text-red-800">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{rlsError}</span>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending Requests Column */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xs font-black text-slate-400 flex items-center gap-2">
            <Clock className="w-4 h-4 text-orange-400" />
            בקשות גישה ממתינות לאישור ({activeRequests.length})
          </h2>

          {activeRequests.length === 0 ? (
            <GlassCard className="py-12 flex flex-col items-center justify-center text-center text-slate-500">
              <UserCheck className="w-8 h-8 mb-3 text-slate-600" />
              <span className="text-xs font-black text-slate-350">אין בקשות גישה ממתינות</span>
              <p className="text-[10px] text-slate-500 mt-1">כל בקשות המפקדים והסגל טופלו ואושרו בהצלחה.</p>
            </GlassCard>
          ) : (
            <div className="space-y-3">
              {activeRequests.map((req) => (
                <GlassCard key={req.id} glow="orange" className="p-5 flex flex-col gap-4">
                  {editingUserId === req.id ? (
                    /* Inline Editing Mode */
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-[rgba(2,1,8,0.06)] pb-2">
                        <span className="text-xs font-black text-[#020108]">עריכת פרטי סגל: {req.name}</span>
                        <GlossyButton variant="slate" size="sm" onClick={() => setEditingUserId(null)}>
                          <X className="w-3 h-3" />
                          ביטול
                        </GlossyButton>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3">
                        <label className="block space-y-1.5">
                          <span className="block text-[11px] font-black text-[#344054]">תפקיד</span>
                          <select
                            value={editRole}
                            onChange={(e) => handleRoleChange(e.target.value)}
                            className="command-select min-h-10 text-xs"
                          >
                            {roles.map((r) => (
                              <option key={r.name} value={r.name}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="block space-y-1.5">
                          <span className="block text-[11px] font-black text-[#344054]">מסגרת</span>
                          <select
                            value={editUnitId}
                            onChange={(e) => setEditUnitId(e.target.value)}
                            className="command-select min-h-10 text-xs"
                          >
                            <option value="none">ללא</option>
                            {units.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="block space-y-1.5">
                          <span className="block text-[11px] font-black text-[#344054]">רמת הרשאה</span>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={editPermissionLevel}
                            onChange={(e) => setEditPermissionLevel(Number(e.target.value))}
                            className="command-input min-h-10 text-center font-mono text-xs"
                          />
                        </label>
                      </div>

                      <div className="flex justify-end gap-2">
                        <GlossyButton 
                          variant="cyan" 
                          size="sm" 
                          disabled={isActionSubmitting === req.id}
                          onClick={() => saveEdit(req.id)}
                        >
                          {isActionSubmitting === req.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          שמור שינויים
                        </GlossyButton>
                      </div>
                    </div>
                  ) : (
                    /* Default View Mode */
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2.5">
                          <span className="text-sm font-black text-[#020108]">{req.name}</span>
                          <StatusBadge status={req.role_approval_status === 'pending' ? 'ממתין לאישור' : req.role_approval_status} />
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#667085] font-bold">
                          <span>תפקיד: <strong className="text-[#FF6B02]">{req.role}</strong></span>
                          <span>•</span>
                          <span>מסגרת: <strong className="text-[#020108]">{req.units?.name || 'פלוגה'}</strong></span>
                          <span>•</span>
                          <span>דוא״ל: <strong className="text-slate-600 font-mono">{req.email}</strong></span>
                          <span>•</span>
                          <span>הרשאה: <strong className="text-[#020108] font-mono">{req.permission_level}</strong></span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 self-end sm:self-center">
                        <GlossyButton
                          variant="slate"
                          size="sm"
                          onClick={() => startEditing(req)}
                          disabled={isActionSubmitting !== null}
                          className="border-slate-300 text-slate-600 hover:text-[#020108]"
                        >
                          <Edit2 className="w-3 h-3" />
                          ערוך
                        </GlossyButton>

                        <GlossyButton 
                          variant="slate" 
                          size="sm" 
                          disabled={isActionSubmitting !== null}
                          onClick={() => handleReject(req.id)}
                          className="border-red-300/30 text-red-600 hover:bg-red-500/10 hover:text-red-700 hover:border-red-500/20"
                        >
                          {isActionSubmitting === req.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserX className="w-3.5 h-3.5" />}
                          דחה
                        </GlossyButton>

                        <GlossyButton 
                          variant="orange" 
                          size="sm" 
                          disabled={isActionSubmitting !== null}
                          onClick={() => handleApprove(req.id, req.role)}
                        >
                          {isActionSubmitting === req.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                          אשר מפקד
                        </GlossyButton>
                      </div>
                    </div>
                  )}
                </GlassCard>
              ))}
            </div>
          )}
        </div>

        {/* History Column */}
        <div className="space-y-4">
          <h2 className="text-xs font-black text-slate-400 flex items-center gap-2">
            <Database className="w-4 h-4 text-cyan-500" />
            מפקדים וסגל שאושרו / נדחו
          </h2>

          <div className="space-y-3">
            {pastRequests.length === 0 ? (
              <p className="text-center text-xs font-bold text-slate-400 py-6">טרם טופלו מפקדים</p>
            ) : (
              pastRequests.map((req) => (
                <GlassCard key={req.id} className="p-4 bg-white/40 border-[rgba(2,1,8,0.06)]" glow="none">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <span className="block text-xs font-black text-[#020108]">{req.name}</span>
                      <span className="block text-[10px] text-[#667085] font-bold">
                        {req.role} • {req.units?.name || 'פלוגה'} • הרשאה {req.permission_level}
                      </span>
                    </div>
                    <StatusBadge status={req.role_approval_status === 'approved' ? 'אושר' : 'נדחה'} />
                  </div>
                </GlassCard>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
