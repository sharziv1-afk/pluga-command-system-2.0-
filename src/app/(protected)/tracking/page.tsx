'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ClipboardCheck,
  Download,
  Loader2,
  Plus,
  Table2,
  UsersRound,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlossyButton } from '@/components/ui/GlossyButton';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { logSupabaseError } from '@/lib/supabase/error';
import type { DbSoldier, DbTrackingItem, DbTrackingRecord, TrackingStatus } from '@/lib/types';

const statusLabels: Record<TrackingStatus, string> = {
  empty: 'ריק',
  passed: 'עבר',
  failed: 'לא עבר',
  makeup: 'השלמה',
};

const statusStyles: Record<TrackingStatus, string> = {
  empty: 'border-slate-200 bg-slate-50 text-slate-600',
  passed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  failed: 'border-red-200 bg-red-50 text-red-700',
  makeup: 'border-amber-200 bg-amber-50 text-amber-700',
};

const initialStatusCounts: Record<TrackingStatus, number> = {
  empty: 0,
  passed: 0,
  failed: 0,
  makeup: 0,
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error(`${label} timed out`));
    }, timeoutMs);

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timeout));
  });
}

export default function TrackingPage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [soldiers, setSoldiers] = useState<DbSoldier[]>([]);
  const [items, setItems] = useState<DbTrackingItem[]>([]);
  const [records, setRecords] = useState<DbTrackingRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadTrackingData() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const {
          data: { user },
          error: userError,
        } = await withTimeout(supabase.auth.getUser(), 10000, 'tracking auth');

        if (!isMounted) return;

        if (userError || !user) {
          router.replace('/login?next=/tracking');
          return;
        }

        const [soldiersResult, itemsResult, recordsResult] = await withTimeout(
          Promise.all([
            supabase
              .from('soldiers')
              .select('*')
              .eq('is_active', true)
              .order('full_name', { ascending: true })
              .returns<DbSoldier[]>(),
            supabase
              .from('tracking_items')
              .select('*')
              .eq('is_active', true)
              .order('sort_order', { ascending: true })
              .order('title', { ascending: true })
              .returns<DbTrackingItem[]>(),
            supabase
              .from('tracking_records')
              .select('*')
              .order('updated_at', { ascending: false })
              .returns<DbTrackingRecord[]>(),
          ]),
          15000,
          'tracking data',
        );

        if (!isMounted) return;

        const firstError = soldiersResult.error ?? itemsResult.error ?? recordsResult.error;
        if (firstError) {
          logSupabaseError('[tracking] failed to load tracking data', firstError, {
            soldiers: Boolean(soldiersResult.error),
            items: Boolean(itemsResult.error),
            records: Boolean(recordsResult.error),
          });
          setErrorMessage('לא ניתן לטעון את נתוני המעקב כרגע.');
        }

        setSoldiers(soldiersResult.data ?? []);
        setItems(itemsResult.data ?? []);
        setRecords(recordsResult.data ?? []);
      } catch (error) {
        if (!isMounted) return;
        logSupabaseError('[tracking] tracking data load timed out', error);
        setErrorMessage('לא ניתן לטעון את נתוני המעקב כרגע.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadTrackingData();

    return () => {
      isMounted = false;
    };
  }, [router, supabase]);

  const statusCounts = useMemo(() => {
    return records.reduce<Record<TrackingStatus, number>>((counts, record) => {
      counts[record.status] += 1;
      return counts;
    }, { ...initialStatusCounts });
  }, [records]);

  const previewItems = items.slice(0, 6);
  const previewSoldiers = soldiers.slice(0, 12);
  const showEmptyState = !isLoading && !errorMessage && (soldiers.length === 0 || items.length === 0);

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <GlossyButton variant="slate" size="sm" disabled title="בשלב הבא">
        <Plus className="h-4 w-4" />
        הוסף חייל
      </GlossyButton>
      <GlossyButton variant="slate" size="sm" disabled title="בשלב הבא">
        <ClipboardCheck className="h-4 w-4" />
        הוסף מופע מעקב
      </GlossyButton>
      <GlossyButton variant="orange" size="sm" disabled title="בשלב הבא">
        <Download className="h-4 w-4" />
        ייצוא CSV
      </GlossyButton>
    </div>
  );

  return (
    <div className="space-y-5" dir="rtl">
      <PageHeader
        title="מעקב פלוגתי"
        subtitle="טבלת מעקב חיילים, כשירויות ומופעים."
        actions={headerActions}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <GlassCard className="min-h-24">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-[#667085]">חיילים פעילים</p>
              <p className="mt-2 text-2xl font-black text-[#020108]">{soldiers.length}</p>
            </div>
            <UsersRound className="h-7 w-7 text-[#FF6B02]" />
          </div>
        </GlassCard>

        <GlassCard className="min-h-24">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-[#667085]">מופעי מעקב</p>
              <p className="mt-2 text-2xl font-black text-[#020108]">{items.length}</p>
            </div>
            <ClipboardCheck className="h-7 w-7 text-[#0F766E]" />
          </div>
        </GlassCard>

        <GlassCard className="min-h-24">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-[#667085]">רשומות תאים</p>
              <p className="mt-2 text-2xl font-black text-[#020108]">{records.length}</p>
            </div>
            <Table2 className="h-7 w-7 text-[#344054]" />
          </div>
        </GlassCard>
      </div>

      {isLoading && (
        <GlassCard className="flex min-h-64 items-center justify-center text-[#667085]">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Loader2 className="h-5 w-5 animate-spin text-[#FF6B02]" />
            טוען נתוני מעקב...
          </div>
        </GlassCard>
      )}

      {!isLoading && errorMessage && (
        <GlassCard className="border-red-500/20 bg-red-500/5">
          <div className="flex items-start gap-3 text-sm font-bold text-red-700">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        </GlassCard>
      )}

      {showEmptyState && (
        <EmptyState
          icon={Table2}
          title="עדיין אין חיילים או מופעי מעקב"
          description="עדיין אין חיילים או מופעי מעקב. בשלב הבא נוסיף יצירה וניהול."
          badgeLabel="Tracking MVP"
        />
      )}

      {!isLoading && !errorMessage && !showEmptyState && (
        <GlassCard className="space-y-5 overflow-hidden">
          <div className="flex flex-col gap-2 border-b border-[rgba(2,1,8,0.08)] pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-black text-[#020108]">תמונת מצב מעקב</h2>
              <p className="mt-1 text-xs font-bold text-[#667085]">קריאה בלבד בשלב הראשון של Tracking.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(statusLabels) as TrackingStatus[]).map((status) => (
                <span
                  key={status}
                  className={`rounded-full border px-3 py-1 text-xs font-black ${statusStyles[status]}`}
                >
                  {statusLabels[status]} · {statusCounts[status]}
                </span>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed border-separate border-spacing-y-2 text-right text-sm">
              <thead className="text-xs font-black text-[#667085]">
                <tr>
                  <th className="w-56 px-3 py-2">חייל</th>
                  {previewItems.map((item) => (
                    <th key={item.id} className="w-40 px-3 py-2">
                      {item.title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewSoldiers.map((soldier) => (
                  <tr key={soldier.id} className="bg-white/64 shadow-[0_8px_18px_rgba(2,1,8,0.04)]">
                    <td className="rounded-r-xl px-3 py-3 font-black text-[#020108]">
                      <div>{soldier.full_name}</div>
                      <div className="mt-1 text-[11px] font-bold text-[#667085]">
                        {soldier.role_label ?? soldier.squad_label ?? 'ללא שיוך נוסף'}
                      </div>
                    </td>
                    {previewItems.map((item, itemIndex) => {
                      const record = records.find(
                        (candidate) => candidate.soldier_id === soldier.id && candidate.tracking_item_id === item.id,
                      );
                      const status = record?.status ?? 'empty';

                      return (
                        <td
                          key={item.id}
                          className={`px-3 py-3 text-xs font-black ${
                            itemIndex === previewItems.length - 1 ? 'rounded-l-xl' : ''
                          }`}
                        >
                          <span className={`inline-flex rounded-full border px-2.5 py-1 ${statusStyles[status]}`}>
                            {statusLabels[status]}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
