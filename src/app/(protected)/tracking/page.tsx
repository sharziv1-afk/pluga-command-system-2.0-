'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  ClipboardCheck,
  Download,
  Loader2,
  Plus,
  Table2,
  Trash2,
  UserPlus,
  UsersRound,
  X,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlossyButton } from '@/components/ui/GlossyButton';
import { createAuditLog } from '@/lib/audit';
import { useApp } from '@/lib/context/AppContext';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { logSupabaseError } from '@/lib/supabase/error';
import type { DbSoldier, DbTrackingItem, DbTrackingRecord, TrackingStatus } from '@/lib/types';

type DbUnit = {
  id: string;
  name: string;
  code: string | null;
  parent_unit_id: string | null;
  created_at?: string | null;
};

type SoldierFormState = {
  fullName: string;
  personalNumber: string;
  unitId: string;
  squadLabel: string;
  roleLabel: string;
  notes: string;
};

type ItemFormState = {
  title: string;
  category: string;
  subject: string;
  description: string;
  sortOrder: string;
};

type PendingDelete =
  | { type: 'soldier'; soldier: DbSoldier; label: string }
  | { type: 'item'; item: DbTrackingItem; label: string };

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

const statusCycle: TrackingStatus[] = ['empty', 'passed', 'failed', 'makeup'];

const initialStatusCounts: Record<TrackingStatus, number> = {
  empty: 0,
  passed: 0,
  failed: 0,
  makeup: 0,
};

const initialSoldierForm: SoldierFormState = {
  fullName: '',
  personalNumber: '',
  unitId: '',
  squadLabel: '',
  roleLabel: '',
  notes: '',
};

const initialItemForm: ItemFormState = {
  title: '',
  category: 'כשירות',
  subject: '',
  description: '',
  sortOrder: '0',
};

const itemCategories = ['כשירות', 'אימון', 'מטווח', 'רפואה', 'מנהלה', 'אחר'];

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

function isUuid(value: string | null | undefined) {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

function getNextStatus(status: TrackingStatus) {
  const currentIndex = statusCycle.indexOf(status);
  return statusCycle[(currentIndex + 1) % statusCycle.length];
}

function getRlsAwareErrorMessage(
  error: unknown,
  fallback: string,
  permissionMessage = 'אין לך הרשאה לבצע פעולה זו.',
) {
  const supabaseError = error as { code?: string; details?: string; hint?: string; message?: string } | null | undefined;
  const errorText = [
    supabaseError?.code,
    supabaseError?.message,
    supabaseError?.details,
    supabaseError?.hint,
  ].filter(Boolean).join(' ').toLowerCase();

  if (
    supabaseError?.code === '42501'
    || errorText.includes('row-level security')
    || errorText.includes('permission')
    || errorText.includes('policy')
    || errorText.includes('not authorized')
  ) {
    return permissionMessage;
  }

  return fallback;
}

function getUnitSortRank(unit: DbUnit) {
  const ranks: Record<string, number> = {
    company: 0,
    platoon_1: 1,
    platoon_2: 2,
    platoon_3: 3,
    platoon_4: 4,
  };

  return ranks[unit.code ?? ''] ?? 20;
}

function getUnitLabel(unit: DbUnit) {
  return unit.code ? `${unit.name} (${unit.code})` : unit.name;
}

export default function TrackingPage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { currentUser } = useApp();

  const [soldiers, setSoldiers] = useState<DbSoldier[]>([]);
  const [items, setItems] = useState<DbTrackingItem[]>([]);
  const [records, setRecords] = useState<DbTrackingRecord[]>([]);
  const [units, setUnits] = useState<DbUnit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSoldierFormOpen, setIsSoldierFormOpen] = useState(false);
  const [isItemFormOpen, setIsItemFormOpen] = useState(false);
  const [isSoldierSubmitting, setIsSoldierSubmitting] = useState(false);
  const [isItemSubmitting, setIsItemSubmitting] = useState(false);
  const [soldierForm, setSoldierForm] = useState<SoldierFormState>(initialSoldierForm);
  const [itemForm, setItemForm] = useState<ItemFormState>(initialItemForm);
  const [updatingCellKey, setUpdatingCellKey] = useState<string | null>(null);
  const [removingSoldierId, setRemovingSoldierId] = useState<string | null>(null);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const sortedUnits = useMemo(() => {
    return [...units].sort((first, second) => {
      const rankDiff = getUnitSortRank(first) - getUnitSortRank(second);
      if (rankDiff !== 0) return rankDiff;
      return first.name.localeCompare(second.name, 'he');
    });
  }, [units]);

  const loadTrackingData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const {
        data: { user },
        error: userError,
      } = await withTimeout(supabase.auth.getUser(), 10000, 'tracking auth');

      if (userError || !user) {
        router.replace('/login?next=/tracking');
        return;
      }

      const [soldiersResult, itemsResult, recordsResult, unitsResult] = await withTimeout(
        Promise.all([
          supabase
            .from('soldiers')
            .select('id,full_name,personal_number,unit_id,squad_label,role_label,notes,is_active,metadata,created_by,updated_by,created_at,updated_at')
            .eq('is_active', true)
            .order('full_name', { ascending: true })
            .returns<DbSoldier[]>(),
          supabase
            .from('tracking_items')
            .select('id,title,category,subject,description,sort_order,is_active,metadata,created_by,updated_by,created_at,updated_at')
            .eq('is_active', true)
            .order('sort_order', { ascending: true })
            .order('title', { ascending: true })
            .returns<DbTrackingItem[]>(),
          supabase
            .from('tracking_records')
            .select('id,soldier_id,tracking_item_id,status,note,metadata,created_by,updated_by,created_at,updated_at')
            .order('updated_at', { ascending: false })
            .returns<DbTrackingRecord[]>(),
          supabase
            .from('units')
            .select('id,name,code,parent_unit_id,created_at')
            .order('created_at', { ascending: true })
            .returns<DbUnit[]>(),
        ]),
        15000,
        'tracking data',
      );

      const firstError = soldiersResult.error ?? itemsResult.error ?? recordsResult.error ?? unitsResult.error;
      if (firstError) {
        logSupabaseError('[tracking] failed to load tracking data', firstError, {
          soldiers: Boolean(soldiersResult.error),
          items: Boolean(itemsResult.error),
          records: Boolean(recordsResult.error),
          units: Boolean(unitsResult.error),
        });
        setErrorMessage('לא ניתן לטעון את נתוני המעקב כרגע.');
      }

      setSoldiers(soldiersResult.data ?? []);
      setItems(itemsResult.data ?? []);
      setRecords(recordsResult.data ?? []);
      setUnits(unitsResult.data ?? []);
    } catch (error) {
      logSupabaseError('[tracking] tracking data load timed out', error);
      setErrorMessage('לא ניתן לטעון את נתוני המעקב כרגע.');
    } finally {
      setIsLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    void loadTrackingData();
  }, [loadTrackingData]);

  const unitNameById = useMemo(() => {
    return new Map(units.map(unit => [unit.id, unit.name]));
  }, [units]);

  const recordByCell = useMemo(() => {
    const soldierIds = new Set(soldiers.map(soldier => soldier.id));
    const itemIds = new Set(items.map(item => item.id));

    return new Map(
      records
        .filter(record => soldierIds.has(record.soldier_id) && itemIds.has(record.tracking_item_id))
        .map(record => [`${record.soldier_id}:${record.tracking_item_id}`, record]),
    );
  }, [items, records, soldiers]);

  const statusCounts = useMemo(() => {
    const counts = { ...initialStatusCounts };
    const totalCells = soldiers.length * items.length;

    recordByCell.forEach((record) => {
      counts[record.status] += 1;
    });

    counts.empty += Math.max(0, totalCells - recordByCell.size);
    return counts;
  }, [items.length, recordByCell, soldiers.length]);

  const currentUserId = isUuid(currentUser?.id) ? currentUser?.id ?? null : null;
  const showEmptyState = !isLoading && (soldiers.length === 0 || items.length === 0);
  const isDeleteSubmitting = pendingDelete?.type === 'soldier'
    ? removingSoldierId === pendingDelete.soldier.id
    : pendingDelete?.type === 'item'
      ? removingItemId === pendingDelete.item.id
      : false;

  const closeDeleteModal = useCallback(() => {
    if (isDeleteSubmitting) return;
    setPendingDelete(null);
    setErrorMessage(null);
  }, [isDeleteSubmitting]);

  const resetSoldierForm = () => setSoldierForm(initialSoldierForm);
  const resetItemForm = () => setItemForm(initialItemForm);

  const requestRemoveSoldier = (soldier: DbSoldier) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setPendingDelete({ type: 'soldier', soldier, label: soldier.full_name });
  };

  const requestRemoveItem = (item: DbTrackingItem) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setPendingDelete({ type: 'item', item, label: item.title });
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;

    if (pendingDelete.type === 'soldier') {
      await handleRemoveSoldier(pendingDelete.soldier);
      return;
    }

    await handleRemoveItem(pendingDelete.item);
  };

  useEffect(() => {
    if (!pendingDelete) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeDeleteModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeDeleteModal, pendingDelete]);

  const handleCreateSoldier = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanFullName = soldierForm.fullName.trim();
    if (!cleanFullName) {
      setErrorMessage('יש להזין שם חייל.');
      return;
    }

    if (!soldierForm.unitId) {
      setErrorMessage('יש לבחור יחידה לחייל.');
      return;
    }

    setIsSoldierSubmitting(true);

    const payload = {
      full_name: cleanFullName,
      personal_number: soldierForm.personalNumber.trim() || null,
      unit_id: soldierForm.unitId,
      squad_label: soldierForm.squadLabel.trim() || null,
      role_label: soldierForm.roleLabel.trim() || null,
      notes: soldierForm.notes.trim() || null,
      created_by: currentUserId,
      updated_by: currentUserId,
    };

    const { data: createdSoldier, error: insertError } = await supabase
      .from('soldiers')
      .insert(payload)
      .select('id,full_name,unit_id')
      .single<Pick<DbSoldier, 'id' | 'full_name' | 'unit_id'>>();

    setIsSoldierSubmitting(false);

    if (insertError || !createdSoldier) {
      if (insertError) logSupabaseError('[tracking] soldier create failed', insertError);
      setErrorMessage(getRlsAwareErrorMessage(insertError, 'לא הצלחנו להוסיף את החייל. בדוק את השדות ונסה שוב.'));
      return;
    }

    if (currentUserId && currentUser) {
      void createAuditLog(supabase, {
        userId: currentUserId,
        userName: currentUser.full_name,
        userRole: currentUser.role,
        actionType: 'tracking_soldier_created',
        entityType: 'tracking_soldier',
        entityId: createdSoldier.id,
        previousValue: null,
        newValue: {
          full_name: createdSoldier.full_name,
          unit_id: createdSoldier.unit_id,
        },
      });
    }

    resetSoldierForm();
    setIsSoldierFormOpen(false);
    setSuccessMessage('החייל נוסף למעקב הפלוגתי.');
    await loadTrackingData();
  };

  const handleCreateItem = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanTitle = itemForm.title.trim();
    const cleanCategory = itemForm.category.trim();
    if (!cleanTitle) {
      setErrorMessage('יש להזין שם מופע מעקב.');
      return;
    }

    if (!cleanCategory) {
      setErrorMessage('יש לבחור קטגוריה למופע.');
      return;
    }

    const parsedSortOrder = Number.parseInt(itemForm.sortOrder, 10);
    setIsItemSubmitting(true);

    const payload = {
      title: cleanTitle,
      category: cleanCategory,
      subject: itemForm.subject.trim() || null,
      description: itemForm.description.trim() || null,
      sort_order: Number.isFinite(parsedSortOrder) ? parsedSortOrder : 0,
      created_by: currentUserId,
      updated_by: currentUserId,
    };

    const { data: createdItem, error: insertError } = await supabase
      .from('tracking_items')
      .insert(payload)
      .select('id,title,category,sort_order')
      .single<Pick<DbTrackingItem, 'id' | 'title' | 'category' | 'sort_order'>>();

    setIsItemSubmitting(false);

    if (insertError || !createdItem) {
      if (insertError) logSupabaseError('[tracking] tracking item create failed', insertError);
      setErrorMessage(getRlsAwareErrorMessage(insertError, 'לא הצלחנו להוסיף את מופע המעקב. בדוק את השדות ונסה שוב.'));
      return;
    }

    if (currentUserId && currentUser) {
      void createAuditLog(supabase, {
        userId: currentUserId,
        userName: currentUser.full_name,
        userRole: currentUser.role,
        actionType: 'tracking_item_created',
        entityType: 'tracking_item',
        entityId: createdItem.id,
        previousValue: null,
        newValue: {
          title: createdItem.title,
          category: createdItem.category,
          sort_order: createdItem.sort_order,
        },
      });
    }

    resetItemForm();
    setIsItemFormOpen(false);
    setSuccessMessage('מופע המעקב נוסף לטבלה.');
    await loadTrackingData();
  };

  const handleRemoveSoldier = async (soldier: DbSoldier) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setRemovingSoldierId(soldier.id);

    const { error: updateError } = await supabase
      .from('soldiers')
      .update({
        is_active: false,
        updated_by: currentUserId,
      })
      .eq('id', soldier.id);

    setRemovingSoldierId(null);

    if (updateError) {
      logSupabaseError('[tracking] soldier soft delete failed', updateError);
      setErrorMessage(getRlsAwareErrorMessage(updateError, 'לא הצלחנו להסיר את החייל מהמעקב. נסה שוב.'));
      return;
    }

    if (currentUserId && currentUser) {
      void createAuditLog(supabase, {
        userId: currentUserId,
        userName: currentUser.full_name,
        userRole: currentUser.role,
        actionType: 'tracking_soldier_updated',
        entityType: 'tracking_soldier',
        entityId: soldier.id,
        previousValue: {
          full_name: soldier.full_name,
          is_active: soldier.is_active,
        },
        newValue: {
          full_name: soldier.full_name,
          is_active: false,
        },
      });
    }

    setPendingDelete(null);
    setSuccessMessage('החייל הוסר מהמעקב.');
    await loadTrackingData();
  };

  const handleRemoveItem = async (item: DbTrackingItem) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setRemovingItemId(item.id);

    const { error: updateError } = await supabase
      .from('tracking_items')
      .update({
        is_active: false,
        updated_by: currentUserId,
      })
      .eq('id', item.id);

    setRemovingItemId(null);

    if (updateError) {
      logSupabaseError('[tracking] tracking item soft delete failed', updateError);
      setErrorMessage(getRlsAwareErrorMessage(updateError, 'לא הצלחנו להסיר את מופע המעקב. נסה שוב.'));
      return;
    }

    if (currentUserId && currentUser) {
      void createAuditLog(supabase, {
        userId: currentUserId,
        userName: currentUser.full_name,
        userRole: currentUser.role,
        actionType: 'tracking_item_updated',
        entityType: 'tracking_item',
        entityId: item.id,
        previousValue: {
          title: item.title,
          is_active: item.is_active,
        },
        newValue: {
          title: item.title,
          is_active: false,
        },
      });
    }

    setPendingDelete(null);
    setSuccessMessage('מופע המעקב הוסר מהטבלה.');
    await loadTrackingData();
  };

  const handleCycleCellStatus = async (
    soldier: DbSoldier,
    item: DbTrackingItem,
    record: DbTrackingRecord | undefined,
  ) => {
    const cellKey = `${soldier.id}:${item.id}`;
    if (updatingCellKey === cellKey) return;

    const previousStatus = record?.status ?? 'empty';
    const nextStatus = getNextStatus(previousStatus);
    const previousRecords = records;
    const nowIso = new Date().toISOString();
    const optimisticRecord: DbTrackingRecord = record
      ? {
          ...record,
          status: nextStatus,
          updated_by: currentUserId,
          updated_at: nowIso,
        }
      : {
          id: `pending-${cellKey}`,
          soldier_id: soldier.id,
          tracking_item_id: item.id,
          status: nextStatus,
          note: null,
          metadata: {},
          created_by: currentUserId,
          updated_by: currentUserId,
          created_at: nowIso,
          updated_at: nowIso,
        };

    setErrorMessage(null);
    setSuccessMessage(null);
    setUpdatingCellKey(cellKey);
    setRecords(current => (
      record
        ? current.map(itemRecord => (itemRecord.id === record.id ? optimisticRecord : itemRecord))
        : [optimisticRecord, ...current]
    ));

    let entityId = record?.id ?? null;
    let operationError: unknown = null;
    let savedRecord: DbTrackingRecord | null = null;

    if (record) {
      const { data: updatedRecord, error: updateError } = await supabase
        .from('tracking_records')
        .update({
          status: nextStatus,
          updated_by: currentUserId,
        })
        .eq('id', record.id)
        .select('id,soldier_id,tracking_item_id,status,note,metadata,created_by,updated_by,created_at,updated_at')
        .single<DbTrackingRecord>();

      savedRecord = updatedRecord ?? null;
      operationError = updateError;
    } else {
      const { data: createdRecord, error: insertError } = await supabase
        .from('tracking_records')
        .insert({
          soldier_id: soldier.id,
          tracking_item_id: item.id,
          status: 'passed',
          note: null,
          created_by: currentUserId,
          updated_by: currentUserId,
        })
        .select('id,soldier_id,tracking_item_id,status,note,metadata,created_by,updated_by,created_at,updated_at')
        .single<DbTrackingRecord>();

      entityId = createdRecord?.id ?? null;
      savedRecord = createdRecord ?? null;
      operationError = insertError;
    }

    setUpdatingCellKey(null);

    if (operationError || !entityId || !savedRecord) {
      setRecords(previousRecords);
      if (operationError) logSupabaseError('[tracking] tracking record update failed', operationError);
      setErrorMessage(getRlsAwareErrorMessage(
        operationError,
        'לא הצלחנו לעדכן את התא. נסה שוב.',
        'אין לך הרשאה לעדכן את התא הזה.',
      ));
      return;
    }

    setRecords(current => (
      record
        ? current.map(itemRecord => (itemRecord.id === savedRecord.id || itemRecord.id === record.id ? savedRecord : itemRecord))
        : current.map(itemRecord => (itemRecord.id === optimisticRecord.id ? savedRecord : itemRecord))
    ));

    if (currentUserId && currentUser) {
      void createAuditLog(supabase, {
        userId: currentUserId,
        userName: currentUser.full_name,
        userRole: currentUser.role,
        actionType: 'tracking_record_updated',
        entityType: 'tracking_record',
        entityId,
        previousValue: {
          soldier_id: soldier.id,
          tracking_item_id: item.id,
          status: previousStatus,
        },
        newValue: {
          soldier_id: soldier.id,
          tracking_item_id: item.id,
          status: nextStatus,
        },
      });
    }

    setSuccessMessage(`סטטוס התא עודכן: ${statusLabels[nextStatus]}.`);
  };

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <GlossyButton
        variant="slate"
        size="sm"
        onClick={() => setIsSoldierFormOpen(value => !value)}
        disabled={isLoading}
      >
        <UserPlus className="h-4 w-4" />
        הוסף חייל
      </GlossyButton>
      <GlossyButton
        variant="slate"
        size="sm"
        onClick={() => setIsItemFormOpen(value => !value)}
        disabled={isLoading}
      >
        <Plus className="h-4 w-4" />
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
              <p className="mt-2 text-2xl font-black text-[#020108]">{recordByCell.size}</p>
            </div>
            <Table2 className="h-7 w-7 text-[#344054]" />
          </div>
        </GlassCard>
      </div>

      {successMessage && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-700">
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-700">
          {errorMessage}
        </div>
      )}

      {pendingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#020108]/30 px-4 py-6 backdrop-blur-sm"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeDeleteModal();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="tracking-delete-title"
            aria-describedby="tracking-delete-description"
            className="w-full max-w-md rounded-3xl border border-white/70 bg-white/92 p-5 text-right shadow-[0_24px_80px_rgba(2,1,8,0.22)] backdrop-blur-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-red-200 bg-red-50 text-red-600">
                  <Trash2 className="h-5 w-5" />
                </span>
                <div>
                  <h2 id="tracking-delete-title" className="text-base font-black text-[#020108]">
                    אישור הסרה
                  </h2>
                  <p className="mt-1 text-xs font-bold text-[#667085]">פעולת soft delete במעקב הפעיל</p>
                </div>
              </div>
              <button
                type="button"
                title="סגור"
                onClick={closeDeleteModal}
                disabled={isDeleteSubmitting}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[rgba(2,1,8,0.10)] bg-white/80 text-[#344054] transition hover:bg-[#FF6B02]/10 disabled:cursor-wait disabled:opacity-50"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">סגור</span>
              </button>
            </div>

            <div id="tracking-delete-description" className="mt-5 space-y-3 text-sm font-bold text-[#344054]">
              <p>
                {pendingDelete.type === 'soldier' ? (
                  <>
                    להסיר את החייל <span className="font-black text-[#020108]">{pendingDelete.label}</span> מהמעקב?
                  </>
                ) : (
                  <>
                    להסיר את מופע המעקב <span className="font-black text-[#020108]">{pendingDelete.label}</span> מהטבלה?
                  </>
                )}
              </p>
              <p className="text-xs leading-6 text-[#667085]">
                ההסרה לא מוחקת את הנתונים לצמיתות, אלא מסתירה אותם מהמעקב הפעיל.
              </p>
            </div>

            {errorMessage && (
              <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-700">
                {errorMessage}
              </div>
            )}

            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <GlossyButton
                type="button"
                variant="slate"
                size="lg"
                onClick={closeDeleteModal}
                disabled={isDeleteSubmitting}
                className="flex-1"
              >
                ביטול
              </GlossyButton>
              <button
                type="button"
                onClick={() => void handleConfirmDelete()}
                disabled={isDeleteSubmitting}
                className="relative flex min-h-11 flex-1 items-center justify-center gap-2 overflow-hidden rounded-2xl border border-red-300 bg-red-600 px-5 text-sm font-bold text-white shadow-[0_14px_28px_rgba(220,38,38,0.20)] transition hover:bg-red-700 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
              >
                <span className="pointer-events-none absolute inset-x-0 top-0 h-[42%] bg-gradient-to-b from-white/25 to-transparent" />
                <span className="relative z-10 flex items-center gap-1.5">
                  {isDeleteSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  הסר
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {isSoldierFormOpen && (
        <GlassCard glow="orange" className="space-y-4">
          <div className="flex items-center gap-2 border-b border-[rgba(2,1,8,0.08)] pb-3">
            <UserPlus className="h-4 w-4 text-[#FF6B02]" />
            <h2 className="text-sm font-black text-[#020108]">הוספת חייל למעקב</h2>
          </div>
          <form onSubmit={handleCreateSoldier} className="grid gap-4 lg:grid-cols-2">
            <label className="block space-y-2">
              <span className="block text-xs font-black text-[#344054]">שם מלא</span>
              <input
                required
                value={soldierForm.fullName}
                onChange={event => setSoldierForm(value => ({ ...value, fullName: event.target.value }))}
                className="command-input"
                placeholder="לדוגמה: ישראל ישראלי"
                disabled={isSoldierSubmitting}
              />
            </label>

            <label className="block space-y-2">
              <span className="block text-xs font-black text-[#344054]">מספר אישי</span>
              <input
                value={soldierForm.personalNumber}
                onChange={event => setSoldierForm(value => ({ ...value, personalNumber: event.target.value }))}
                className="command-input"
                placeholder="אופציונלי"
                disabled={isSoldierSubmitting}
              />
            </label>

            <label className="block space-y-2">
              <span className="block text-xs font-black text-[#344054]">יחידה</span>
              <select
                required
                value={soldierForm.unitId}
                onChange={event => setSoldierForm(value => ({ ...value, unitId: event.target.value }))}
                className="command-select"
                disabled={isSoldierSubmitting}
              >
                <option value="">בחר יחידה</option>
                {sortedUnits.map(unit => (
                  <option key={unit.id} value={unit.id}>{getUnitLabel(unit)}</option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="block text-xs font-black text-[#344054]">כיתה / צוות</span>
              <input
                value={soldierForm.squadLabel}
                onChange={event => setSoldierForm(value => ({ ...value, squadLabel: event.target.value }))}
                className="command-input"
                placeholder="אופציונלי"
                disabled={isSoldierSubmitting}
              />
            </label>

            <label className="block space-y-2">
              <span className="block text-xs font-black text-[#344054]">תפקיד</span>
              <input
                value={soldierForm.roleLabel}
                onChange={event => setSoldierForm(value => ({ ...value, roleLabel: event.target.value }))}
                className="command-input"
                placeholder="לוחם / חובש / קשר"
                disabled={isSoldierSubmitting}
              />
            </label>

            <label className="block space-y-2 lg:col-span-2">
              <span className="block text-xs font-black text-[#344054]">הערות</span>
              <textarea
                value={soldierForm.notes}
                onChange={event => setSoldierForm(value => ({ ...value, notes: event.target.value }))}
                className="command-input min-h-24 resize-none"
                placeholder="אופציונלי"
                disabled={isSoldierSubmitting}
              />
            </label>

            <div className="flex flex-col gap-2 lg:col-span-2 sm:flex-row">
              <GlossyButton type="submit" variant="orange" size="lg" disabled={isSoldierSubmitting} className="flex-1">
                {isSoldierSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                שמור חייל
              </GlossyButton>
              <GlossyButton
                type="button"
                variant="slate"
                size="lg"
                onClick={() => { resetSoldierForm(); setIsSoldierFormOpen(false); }}
                disabled={isSoldierSubmitting}
                className="flex-1"
              >
                ביטול
              </GlossyButton>
            </div>
          </form>
        </GlassCard>
      )}

      {isItemFormOpen && (
        <GlassCard glow="orange" className="space-y-4">
          <div className="flex items-center gap-2 border-b border-[rgba(2,1,8,0.08)] pb-3">
            <ClipboardCheck className="h-4 w-4 text-[#FF6B02]" />
            <h2 className="text-sm font-black text-[#020108]">הוספת מופע מעקב</h2>
          </div>
          <form onSubmit={handleCreateItem} className="grid gap-4 lg:grid-cols-2">
            <label className="block space-y-2">
              <span className="block text-xs font-black text-[#344054]">שם מופע</span>
              <input
                required
                value={itemForm.title}
                onChange={event => setItemForm(value => ({ ...value, title: event.target.value }))}
                className="command-input"
                placeholder="לדוגמה: בוחן מסלול"
                disabled={isItemSubmitting}
              />
            </label>

            <label className="block space-y-2">
              <span className="block text-xs font-black text-[#344054]">קטגוריה</span>
              <select
                required
                value={itemForm.category}
                onChange={event => setItemForm(value => ({ ...value, category: event.target.value }))}
                className="command-select"
                disabled={isItemSubmitting}
              >
                {itemCategories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="block text-xs font-black text-[#344054]">נושא</span>
              <input
                value={itemForm.subject}
                onChange={event => setItemForm(value => ({ ...value, subject: event.target.value }))}
                className="command-input"
                placeholder="אופציונלי"
                disabled={isItemSubmitting}
              />
            </label>

            <label className="block space-y-2">
              <span className="block text-xs font-black text-[#344054]">סדר תצוגה</span>
              <input
                type="number"
                value={itemForm.sortOrder}
                onChange={event => setItemForm(value => ({ ...value, sortOrder: event.target.value }))}
                className="command-input"
                min={0}
                disabled={isItemSubmitting}
              />
            </label>

            <label className="block space-y-2 lg:col-span-2">
              <span className="block text-xs font-black text-[#344054]">תיאור</span>
              <textarea
                value={itemForm.description}
                onChange={event => setItemForm(value => ({ ...value, description: event.target.value }))}
                className="command-input min-h-24 resize-none"
                placeholder="אופציונלי"
                disabled={isItemSubmitting}
              />
            </label>

            <div className="flex flex-col gap-2 lg:col-span-2 sm:flex-row">
              <GlossyButton type="submit" variant="orange" size="lg" disabled={isItemSubmitting} className="flex-1">
                {isItemSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                שמור מופע
              </GlossyButton>
              <GlossyButton
                type="button"
                variant="slate"
                size="lg"
                onClick={() => { resetItemForm(); setIsItemFormOpen(false); }}
                disabled={isItemSubmitting}
                className="flex-1"
              >
                ביטול
              </GlossyButton>
            </div>
          </form>
        </GlassCard>
      )}

      {isLoading && (
        <GlassCard className="flex min-h-64 items-center justify-center text-[#667085]">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Loader2 className="h-5 w-5 animate-spin text-[#FF6B02]" />
            טוען נתוני מעקב...
          </div>
        </GlassCard>
      )}

      {showEmptyState && (
        <div className="grid gap-4 lg:grid-cols-2">
          {soldiers.length === 0 && (
            <EmptyState
              icon={UsersRound}
              title="עדיין אין חיילים במעקב"
              description="הוסף חייל ראשון כדי להתחיל לבנות את טבלת המעקב הפלוגתית."
              actionText="הוסף חייל"
              onAction={() => setIsSoldierFormOpen(true)}
              badgeLabel="Roster"
            />
          )}

          {items.length === 0 && (
            <EmptyState
              icon={ClipboardCheck}
              title="עדיין אין מופעי מעקב"
              description="הוסף כשירות, אימון, מטווח או קטגוריה אחרת כדי לפתוח עמודות בטבלה."
              actionText="הוסף מופע"
              onAction={() => setIsItemFormOpen(true)}
              badgeLabel="Tracking Items"
            />
          )}
        </div>
      )}

      {!isLoading && !showEmptyState && (
        <GlassCard className="space-y-5 overflow-hidden">
          <div className="flex flex-col gap-2 border-b border-[rgba(2,1,8,0.08)] pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-black text-[#020108]">טבלת מעקב</h2>
              <p className="mt-1 text-xs font-bold text-[#667085]">שורות לפי חיילים, עמודות לפי מופעי מעקב.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(statusLabels) as TrackingStatus[]).map((status) => (
                <span
                  key={status}
                  className={`rounded-full border px-3 py-1 text-xs font-black ${statusStyles[status]}`}
                >
                  {statusLabels[status]} - {statusCounts[status]}
                </span>
              ))}
            </div>
          </div>

          <div className="max-w-full overflow-x-auto pb-2">
            <table
              className="border-separate border-spacing-y-2 text-right text-sm"
              style={{ minWidth: `${Math.max(760, 280 + items.length * 176)}px` }}
            >
              <thead className="text-xs font-black text-[#667085]">
                <tr>
                  <th className="sticky right-0 z-20 w-64 bg-white/95 px-3 py-2 backdrop-blur-xl">חייל</th>
                  {items.map((item) => (
                    <th key={item.id} className="w-44 px-3 py-2 align-bottom">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-black text-[#020108]">{item.title}</div>
                          <div className="mt-1 text-[11px] font-bold text-[#98A2B3]">{item.category}</div>
                        </div>
                        <button
                          type="button"
                          title="הסר מופע מעקב מהטבלה"
                          onClick={() => requestRemoveItem(item)}
                          disabled={removingItemId === item.id}
                          className="touch-target inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-600 transition hover:border-red-300 hover:bg-red-100 disabled:cursor-wait disabled:opacity-60"
                        >
                          {removingItemId === item.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          <span className="sr-only">הסר</span>
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {soldiers.map((soldier) => (
                  <tr key={soldier.id} className="bg-white/64 shadow-[0_8px_18px_rgba(2,1,8,0.04)]">
                    <td className="sticky right-0 z-10 rounded-r-xl bg-white/95 px-3 py-3 font-black text-[#020108] backdrop-blur-xl">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div>{soldier.full_name}</div>
                          <div className="mt-1 text-[11px] font-bold text-[#667085]">
                            {unitNameById.get(soldier.unit_id) ?? 'יחידה לא ידועה'}
                          </div>
                          <div className="mt-1 text-[11px] font-bold text-[#98A2B3]">
                            {soldier.role_label ?? soldier.squad_label ?? 'ללא שיוך נוסף'}
                          </div>
                        </div>
                        <button
                          type="button"
                          title="הסר חייל מהמעקב"
                          onClick={() => requestRemoveSoldier(soldier)}
                          disabled={removingSoldierId === soldier.id}
                          className="touch-target inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-600 transition hover:border-red-300 hover:bg-red-100 disabled:cursor-wait disabled:opacity-60"
                        >
                          {removingSoldierId === soldier.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          <span className="sr-only">הסר</span>
                        </button>
                      </div>
                    </td>
                    {items.map((item, itemIndex) => {
                      const record = recordByCell.get(`${soldier.id}:${item.id}`);
                      const status = record?.status ?? 'empty';
                      const cellKey = `${soldier.id}:${item.id}`;
                      const isCellUpdating = updatingCellKey === cellKey;

                      return (
                        <td
                          key={item.id}
                          className={`px-3 py-3 text-xs font-black ${itemIndex === items.length - 1 ? 'rounded-l-xl' : ''}`}
                        >
                          <button
                            type="button"
                            title="לחיצה מחליפה סטטוס"
                            onClick={() => void handleCycleCellStatus(soldier, item, record)}
                            disabled={isCellUpdating}
                            className={`inline-flex min-h-8 min-w-20 items-center justify-center gap-1.5 rounded-full border px-3 py-1 transition hover:shadow-sm disabled:cursor-wait disabled:opacity-70 ${statusStyles[status]}`}
                          >
                            {isCellUpdating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            {statusLabels[status]}
                          </button>
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
