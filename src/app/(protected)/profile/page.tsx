'use client';

import React from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useApp } from '@/lib/context/AppContext';
import { User, Mail, ShieldAlert, Award, Calendar, FileText } from 'lucide-react';

export default function ProfilePage() {
  const { currentUser, isLoading } = useApp();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="פרופיל אישי" subtitle="טוען פרטי משתמש..." />
        <div className="max-w-2xl">
          <GlassCard className="p-8 animate-pulse space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-3xl bg-[#EEF1F5]" />
              <div className="space-y-2 flex-1">
                <div className="h-4 w-32 rounded bg-[#EEF1F5]" />
                <div className="h-3 w-48 rounded bg-[#EEF1F5]" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-14 rounded-2xl bg-[#EEF1F5]/60" />
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="space-y-6">
        <PageHeader title="פרופיל אישי" subtitle="ניהול ופרטי משתמש אישיים" />
        <GlassCard className="py-12 flex flex-col items-center justify-center text-center text-slate-500">
          <ShieldAlert className="w-12 h-12 mb-3 text-red-500" />
          <span className="text-sm font-black text-slate-350">לא נמצא פרופיל משתמש מחובר</span>
          <p className="text-xs text-slate-500 mt-1">אנא התחבר מחדש למערכת.</p>
        </GlassCard>
      </div>
    );
  }

  const formattedDate = currentUser.created_at
    ? new Date(currentUser.created_at).toLocaleDateString('he-IL', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'לא ידוע';

  // Determine permission description
  let permissionLabel = 'הרשאה בסיסית';
  const role = currentUser.role as string;
  if (role === 'מ״פ' || role === 'מ"פ') permissionLabel = 'הרשאה פלוגתית עליונה (מפקד פלוגה)';
  else if (role === 'סמ״פ' || role === 'סמ"פ') permissionLabel = 'הרשאה פלוגתית גבוהה (סגן מפקד)';
  else if (role === 'ע. מ״פ' || role === 'ע. מ"פ') permissionLabel = 'הרשאת פיקוד ומנהלה (עוזר מ״פ)';
  else if (role === 'רס״פ / לוגיסטיקה' || role === 'רס"פ') permissionLabel = 'הרשאת ניהול לוגיסטיקה';
  else if (role.startsWith('מ״מ') || role.startsWith('מ"מ')) permissionLabel = 'הרשאת ניהול מחלקה';
  else if (role.startsWith('מ״כ') || role.startsWith('מ"כ')) permissionLabel = 'הרשאה כיתתית';

  return (
    <div className="space-y-6 text-right">
      {/* Page Header */}
      <PageHeader
        title="פרופיל אישי"
        subtitle="פרטי החשבון הצבאי שלך, רמת ההרשאה שנקבעה על ידי המפקד והמסגרת שאליה אתה משויך."
      />

      <div className="max-w-2xl">
        <GlassCard glow="orange" className="p-6 md:p-8">
          {/* Header Profile Info */}
          <div className="mb-8 flex flex-col sm:flex-row items-center gap-4 border-b border-[rgba(2,1,8,0.08)] pb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-[#FF6B02]/20 bg-[#FF6B02]/10 text-[#FF6B02] shadow-[0_14px_30px_rgba(255,107,2,0.14)]">
              <User className="h-8 w-8" />
            </div>
            <div className="text-center sm:text-right space-y-1">
              <h2 className="text-xl font-black text-[#020108]">{currentUser.full_name}</h2>
              <p className="text-xs font-bold text-[#667085]">
                {currentUser.role} · {currentUser.assigned_frame}
              </p>
            </div>
            <div className="sm:mr-auto mt-3 sm:mt-0">
              <StatusBadge status={currentUser.status} />
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-[rgba(2,1,8,0.06)] bg-white/40 p-4">
              <span className="flex items-center gap-1.5 text-[11px] font-black text-[#98A2B3] mb-1">
                <Mail className="h-3.5 w-3.5" />
                דואר אלקטרוני
              </span>
              <span className="block text-sm font-semibold text-[#020108] font-mono select-all">
                {currentUser.email}
              </span>
            </div>

            <div className="rounded-2xl border border-[rgba(2,1,8,0.06)] bg-white/40 p-4">
              <span className="flex items-center gap-1.5 text-[11px] font-black text-[#98A2B3] mb-1">
                <Award className="h-3.5 w-3.5" />
                תפקיד צבאי במערכת
              </span>
              <span className="block text-sm font-semibold text-[#020108]">
                {currentUser.role}
              </span>
            </div>

            <div className="rounded-2xl border border-[rgba(2,1,8,0.06)] bg-white/40 p-4">
              <span className="flex items-center gap-1.5 text-[11px] font-black text-[#98A2B3] mb-1">
                <FileText className="h-3.5 w-3.5" />
                יחידה / מסגרת פעילות
              </span>
              <span className="block text-sm font-semibold text-[#020108]">
                {currentUser.assigned_frame}
              </span>
            </div>

            <div className="rounded-2xl border border-[rgba(2,1,8,0.06)] bg-white/40 p-4">
              <span className="flex items-center gap-1.5 text-[11px] font-black text-[#98A2B3] mb-1">
                <ShieldAlert className="h-3.5 w-3.5" />
                רמת הרשאה צבאית
              </span>
              <span className="block text-sm font-semibold text-[#020108]">
                {permissionLabel}
              </span>
            </div>

            <div className="rounded-2xl border border-[rgba(2,1,8,0.06)] bg-white/40 p-4">
              <span className="flex items-center gap-1.5 text-[11px] font-black text-[#98A2B3] mb-1">
                <Calendar className="h-3.5 w-3.5" />
                תאריך הצטרפות למערכת
              </span>
              <span className="block text-sm font-semibold text-[#020108]">
                {formattedDate}
              </span>
            </div>

            <div className="rounded-2xl border border-[rgba(2,1,8,0.06)] bg-white/40 p-4">
              <span className="flex items-center gap-1.5 text-[11px] font-black text-[#98A2B3] mb-1">
                <ShieldAlert className="h-3.5 w-3.5" />
                סטטוס פרופיל פיקודי
              </span>
              <span className="block text-sm font-semibold text-[#020108]">
                מאושר ופעיל במפקדה
              </span>
            </div>
          </div>

          {/* Bottom Alert */}
          <div className="mt-8 rounded-2xl border border-[#FF6B02]/14 bg-[#FF6B02]/8 p-4 text-xs font-semibold leading-relaxed text-[#9A4600]">
            שינוי תפקיד, דרגה או מסגרת יכולים להתבצע אך ורק על ידי מפקד הפלוגה (המ״פ) או סגנו דרך פאנל הניהול של המערכת.
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
