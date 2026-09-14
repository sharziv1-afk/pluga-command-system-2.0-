'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarPlus,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Loader2,
  NotebookPen,
  Pencil,
  Plus,
  Table2,
  Trash2,
  Search,
  UserPlus,
  UsersRound,
  X,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { FieldPrivacyHint } from '@/components/ui/FieldPrivacyHint';
import { CommandConfirmDialog, CommandOverlay } from '@/components/ui/CommandDialog';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlossyButton } from '@/components/ui/GlossyButton';
import { createAuditLog } from '@/lib/audit';
import { useApp } from '@/lib/context/AppContext';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { logSupabaseError } from '@/lib/supabase/error';
import { didRowsUpdate } from '@/lib/supabase/assertUpdated';
import type { DbSoldier, DbTrackingItem, DbTrackingRecord, DbTrackingWeek, TrackingStatus } from '@/lib/types';

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
  weekId: string;
  description: string;
  sortOrder: string;
};

type WeekFormState = {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
};

type PendingDelete =
  | { type: 'soldier'; soldier: DbSoldier; label: string }
  | { type: 'item'; item: DbTrackingItem; label: string }
  | { type: 'week'; week: DbTrackingWeek; label: string };

const statusLabels: Record<TrackingStatus, string> = {
  empty: 'ריק',
  passed: 'עבר',
  failed: 'לא עבר',
  makeup: 'השלמה',
};

const statusStyles: Record<TrackingStatus, string> = {
  empty: 'border-[var(--border-strong)] bg-[var(--surface-muted)] text-[var(--text-secondary)]',
  passed: 'border-[var(--color-success)]/25 bg-[var(--color-success)]/10 text-[var(--color-success)]',
  failed: 'border-[var(--color-danger)]/25 bg-[var(--color-danger)]/10 text-[var(--color-danger)]',
  makeup: 'border-[var(--color-warning)]/25 bg-[var(--color-warning)]/10 text-[var(--color-warning)]',
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
  weekId: '',
  description: '',
  sortOrder: '0',
};

const initialWeekForm: WeekFormState = {
  title: '',
  description: '',
  startDate: '',
  endDate: '',
};

const itemCategories = ['כשירות', 'אימון', 'מטווח', 'רפואה', 'מנהלה', 'אחר'];

function formatShortDate(isoDate: string) {
  const [, month, day] = isoDate.split('-');
  return `${day}.${month}`;
}

function formatWeekRange(week: DbTrackingWeek) {
  if (week.start_date && week.end_date) return `${formatShortDate(week.start_date)}–${formatShortDate(week.end_date)}`;
  if (week.start_date) return `מ־${formatShortDate(week.start_date)}`;
  if (week.end_date) return `עד ${formatShortDate(week.end_date)}`;
  return null;
}

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
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { currentUser } = useApp();

  const [soldiers, setSoldiers] = useState<DbSoldier[]>([]);
  const [items, setItems] = useState<DbTrackingItem[]>([]);
  const [records, setRecords] = useState<DbTrackingRecord[]>([]);
  const [units, setUnits] = useState<DbUnit[]>([]);
  const [weeks, setWeeks] = useState<DbTrackingWeek[]>([]);
  const [selectedWeekId, setSelectedWeekId] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [unitFilter, setUnitFilter] = useState<string>('all');
  const [searchText, setSearchText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSoldierFormOpen, setIsSoldierFormOpen] = useState(false);
  const [isItemFormOpen, setIsItemFormOpen] = useState(false);
  const [isSoldierSubmitting, setIsSoldierSubmitting] = useState(false);
  const [isItemSubmitting, setIsItemSubmitting] = useState(false);
  const [soldierForm, setSoldierForm] = useState<SoldierFormState>(initialSoldierForm);
  const [itemForm, setItemForm] = useState<ItemFormState>(initialItemForm);
  // A set, not a single key: cells save independently, so one in-flight write
  // must not clear the guard on another. With a single key, clicking A then B
  // then A again passed the guard every time (B !== A), and two responses for
  // the same cell could land out of order and leave the screen showing a
  // status the server does not hold.
  const [updatingCells, setUpdatingCells] = useState<ReadonlySet<string>>(() => new Set());
  const releaseCell = (cellKey: string) => setUpdatingCells(current => {
    const next = new Set(current);
    next.delete(cellKey);
    return next;
  });
  const [removingSoldierId, setRemovingSoldierId] = useState<string | null>(null);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  // Notes on a cell require a record to already exist — a status click always
  // creates one first (see handleCycleCellStatus), so this only ever updates,
  // never inserts. Keeps this feature from having to decide what status to
  // assign a record that exists solely to hold a note.
  const [noteDialogTarget, setNoteDialogTarget] = useState<{ soldier: DbSoldier; item: DbTrackingItem; record: DbTrackingRecord } | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [statusDraft, setStatusDraft] = useState<TrackingStatus>('empty');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [editingSoldier, setEditingSoldier] = useState<DbSoldier | null>(null);
  const [editingItem, setEditingItem] = useState<DbTrackingItem | null>(null);
  // null = dialog closed; { week: null } = creating; { week } = editing.
  const [weekDialog, setWeekDialog] = useState<{ week: DbTrackingWeek | null } | null>(null);
  const [weekForm, setWeekForm] = useState<WeekFormState>(initialWeekForm);
  const [isWeekSubmitting, setIsWeekSubmitting] = useState(false);
  const [removingWeekId, setRemovingWeekId] = useState<string | null>(null);
  const soldierFormRef = useRef<HTMLDivElement>(null);
  const itemFormRef = useRef<HTMLDivElement>(null);

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
      const [soldiersResult, itemsResult, recordsResult, unitsResult, weeksResult] = await withTimeout(
        Promise.all([
          supabase
            .from('soldiers')
            .select('id,full_name,personal_number,unit_id,squad_label,role_label,notes,is_active,metadata,created_by,updated_by,created_at,updated_at')
            .eq('is_active', true)
            .order('full_name', { ascending: true })
            .returns<DbSoldier[]>(),
          supabase
            .from('tracking_items')
            .select('id,title,category,subject,week_id,description,sort_order,is_active,metadata,created_by,updated_by,created_at,updated_at')
            .eq('is_active', true)
            .order('sort_order', { ascending: true })
            .order('title', { ascending: true })
            .returns<DbTrackingItem[]>(),
          // Scoped server-side to records whose item is still active, via an
          // inner-join embed rather than a second round-trip. This grid is the
          // one query in the app that grows as a product (soldiers x items),
          // so an unfiltered fetch is the one most likely to hurt later; today
          // it changes nothing, because zero records point at inactive items.
          // The embedded column is discarded — it exists only to drive !inner.
          //
          // No .limit() here on purpose: a truncated tracking grid would show
          // a real record as an empty cell, which reads as "not done" rather
          // than "not loaded". That is worse than slow.
          supabase
            .from('tracking_records')
            .select('id,soldier_id,tracking_item_id,status,note,metadata,created_by,updated_by,created_at,updated_at,tracking_items!inner(is_active)')
            .eq('tracking_items.is_active', true)
            .order('updated_at', { ascending: false })
            .returns<DbTrackingRecord[]>(),
          supabase
            .from('units')
            .select('id,name,code,parent_unit_id,created_at')
            .order('created_at', { ascending: true })
            .returns<DbUnit[]>(),
          supabase
            .from('tracking_weeks')
            .select('id,title,description,start_date,end_date,sort_order,is_active,created_by,created_at,updated_at')
            .eq('is_active', true)
            .order('sort_order', { ascending: true })
            .returns<DbTrackingWeek[]>(),
        ]),
        15000,
        'tracking data',
      );

      const firstError = soldiersResult.error ?? itemsResult.error ?? recordsResult.error ?? unitsResult.error ?? weeksResult.error;
      if (firstError) {
        logSupabaseError('[tracking] failed to load tracking data', firstError, {
          soldiers: Boolean(soldiersResult.error),
          items: Boolean(itemsResult.error),
          records: Boolean(recordsResult.error),
          units: Boolean(unitsResult.error),
          weeks: Boolean(weeksResult.error),
        });
        setErrorMessage('לא ניתן לטעון את נתוני המעקב כרגע.');
      }

      setSoldiers(soldiersResult.data ?? []);
      // Removing a week is a single update on the week row, not a cascade over
      // its items — so an item whose week is no longer active leaves the table
      // here. Skipped when the weeks query itself failed, so a load error can't
      // make every week-bound column silently vanish.
      const activeWeekIds = new Set((weeksResult.data ?? []).map(week => week.id));
      setItems((itemsResult.data ?? []).filter(item => weeksResult.error || !item.week_id || activeWeekIds.has(item.week_id)));
      setRecords(recordsResult.data ?? []);
      setUnits(unitsResult.data ?? []);
      setWeeks(weeksResult.data ?? []);
    } catch (error) {
      logSupabaseError('[tracking] tracking data load timed out', error);
      setErrorMessage('לא ניתן לטעון את נתוני המעקב כרגע.');
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadTrackingData();
  }, [loadTrackingData]);

  const unitNameById = useMemo(() => {
    return new Map(units.map(unit => [unit.id, unit.name]));
  }, [units]);

  // Categories to filter by come from what items actually have, not the fixed
  // preset list offered when creating one — real data can (and already does)
  // use a value outside that preset.
  const availableCategories = useMemo(
    () => [...new Set(items.map(item => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'he')),
    [items],
  );

  const visibleItems = useMemo(() => {
    return items.filter(item => {
      if (selectedWeekId !== 'all' && item.week_id !== selectedWeekId) return false;
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      return true;
    });
  }, [items, selectedWeekId, categoryFilter]);

  // Units actually present among the current soldiers, not every unit that
  // exists — a platoon with nobody tracked here yet would otherwise show up
  // as a selectable filter that always returns zero rows.
  const availableUnits = useMemo(
    () => [...new Set(soldiers.map(soldier => soldier.unit_id).filter(Boolean))]
      .map(id => ({ id, name: unitNameById.get(id) ?? 'יחידה לא ידועה' }))
      .sort((a, b) => a.name.localeCompare(b.name, 'he')),
    [soldiers, unitNameById],
  );

  const visibleSoldiers = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return soldiers.filter(soldier => {
      if (unitFilter !== 'all' && soldier.unit_id !== unitFilter) return false;
      if (!query) return true;
      const unitName = unitNameById.get(soldier.unit_id) ?? '';
      const haystack = [soldier.full_name, unitName, soldier.squad_label, soldier.role_label]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [soldiers, searchText, unitFilter, unitNameById]);

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
      : pendingDelete?.type === 'week'
        ? removingWeekId === pendingDelete.week.id
        : false;

  useEffect(() => {
    if (isSoldierFormOpen) soldierFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [isSoldierFormOpen, editingSoldier]);

  useEffect(() => {
    if (isItemFormOpen) itemFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [isItemFormOpen, editingItem]);

  const closeDeleteModal = useCallback(() => {
    if (isDeleteSubmitting) return;
    setPendingDelete(null);
    setErrorMessage(null);
  }, [isDeleteSubmitting]);

  const closeSoldierForm = () => {
    setSoldierForm(initialSoldierForm);
    setEditingSoldier(null);
    setIsSoldierFormOpen(false);
  };

  const closeItemForm = () => {
    setItemForm(initialItemForm);
    setEditingItem(null);
    setIsItemFormOpen(false);
  };

  const openCreateSoldier = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setEditingSoldier(null);
    setSoldierForm(initialSoldierForm);
    setIsSoldierFormOpen(true);
  };

  const openEditSoldier = (soldier: DbSoldier) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setEditingSoldier(soldier);
    setSoldierForm({
      fullName: soldier.full_name,
      personalNumber: soldier.personal_number ?? '',
      unitId: soldier.unit_id,
      squadLabel: soldier.squad_label ?? '',
      roleLabel: soldier.role_label ?? '',
      notes: soldier.notes ?? '',
    });
    setIsItemFormOpen(false);
    setIsSoldierFormOpen(true);
  };

  const openCreateItem = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setEditingItem(null);
    setItemForm({ ...initialItemForm, weekId: selectedWeekId !== 'all' ? selectedWeekId : '' });
    setIsItemFormOpen(true);
  };

  const openEditItem = (item: DbTrackingItem) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setEditingItem(item);
    setItemForm({
      title: item.title,
      category: item.category,
      subject: item.subject ?? '',
      weekId: item.week_id ?? '',
      description: item.description ?? '',
      sortOrder: String(item.sort_order),
    });
    setIsSoldierFormOpen(false);
    setIsItemFormOpen(true);
  };

  const openWeekDialog = (week: DbTrackingWeek | null) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setWeekForm(week
      ? { title: week.title, description: week.description ?? '', startDate: week.start_date ?? '', endDate: week.end_date ?? '' }
      : initialWeekForm);
    setWeekDialog({ week });
  };

  const closeWeekDialog = () => {
    if (isWeekSubmitting) return;
    setWeekDialog(null);
    setWeekForm(initialWeekForm);
  };

  const requestRemoveWeek = (week: DbTrackingWeek) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setPendingDelete({ type: 'week', week, label: week.title });
  };

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

    if (pendingDelete.type === 'week') {
      await handleRemoveWeek(pendingDelete.week);
      return;
    }

    await handleRemoveItem(pendingDelete.item);
  };


  const handleSubmitSoldier = async (event: React.FormEvent<HTMLFormElement>) => {
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

    const fields = {
      full_name: cleanFullName,
      personal_number: soldierForm.personalNumber.trim() || null,
      unit_id: soldierForm.unitId,
      squad_label: soldierForm.squadLabel.trim() || null,
      role_label: soldierForm.roleLabel.trim() || null,
      notes: soldierForm.notes.trim() || null,
      updated_by: currentUserId,
    };

    if (editingSoldier) {
      const { data: updatedRows, error: updateError } = await supabase
        .from('soldiers')
        .update(fields)
        .eq('id', editingSoldier.id)
        .select('id');

      setIsSoldierSubmitting(false);

      if (updateError) {
        logSupabaseError('[tracking] soldier update failed', updateError);
        setErrorMessage(getRlsAwareErrorMessage(updateError, 'לא הצלחנו לעדכן את פרטי החייל. נסה שוב.'));
        return;
      }
      if (!didRowsUpdate(updatedRows)) {
        setErrorMessage('לא ניתן לעדכן את החייל — אין לך הרשאה לכך.');
        return;
      }

      if (currentUserId && currentUser) {
        void createAuditLog(supabase, {
          userId: currentUserId,
          userName: currentUser.full_name,
          userRole: currentUser.role,
          actionType: 'tracking_soldier_updated',
          entityType: 'tracking_soldier',
          entityId: editingSoldier.id,
          previousValue: {
            full_name: editingSoldier.full_name,
            unit_id: editingSoldier.unit_id,
            squad_label: editingSoldier.squad_label,
            role_label: editingSoldier.role_label,
          },
          newValue: {
            full_name: fields.full_name,
            unit_id: fields.unit_id,
            squad_label: fields.squad_label,
            role_label: fields.role_label,
          },
        });
      }

      closeSoldierForm();
      setSuccessMessage('פרטי החייל עודכנו.');
      await loadTrackingData();
      return;
    }

    const { data: createdSoldier, error: insertError } = await supabase
      .from('soldiers')
      .insert({ ...fields, created_by: currentUserId })
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

    closeSoldierForm();
    setSuccessMessage('החייל נוסף למעקב הפלוגתי.');
    await loadTrackingData();
  };

  const handleSubmitItem = async (event: React.FormEvent<HTMLFormElement>) => {
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

    const fields = {
      title: cleanTitle,
      category: cleanCategory,
      subject: itemForm.subject.trim() || null,
      week_id: itemForm.weekId || null,
      description: itemForm.description.trim() || null,
      sort_order: Number.isFinite(parsedSortOrder) ? parsedSortOrder : 0,
      updated_by: currentUserId,
    };

    if (editingItem) {
      const { data: updatedRows, error: updateError } = await supabase
        .from('tracking_items')
        .update(fields)
        .eq('id', editingItem.id)
        .select('id');

      setIsItemSubmitting(false);

      if (updateError) {
        logSupabaseError('[tracking] tracking item update failed', updateError);
        setErrorMessage(getRlsAwareErrorMessage(updateError, 'לא הצלחנו לעדכן את מופע המעקב. נסה שוב.'));
        return;
      }
      if (!didRowsUpdate(updatedRows)) {
        setErrorMessage('לא ניתן לעדכן את מופע המעקב — אין לך הרשאה לכך.');
        return;
      }

      if (currentUserId && currentUser) {
        void createAuditLog(supabase, {
          userId: currentUserId,
          userName: currentUser.full_name,
          userRole: currentUser.role,
          actionType: 'tracking_item_updated',
          entityType: 'tracking_item',
          entityId: editingItem.id,
          previousValue: {
            title: editingItem.title,
            category: editingItem.category,
            week_id: editingItem.week_id,
            sort_order: editingItem.sort_order,
          },
          newValue: {
            title: fields.title,
            category: fields.category,
            week_id: fields.week_id,
            sort_order: fields.sort_order,
          },
        });
      }

      closeItemForm();
      setSuccessMessage('מופע המעקב עודכן.');
      await loadTrackingData();
      return;
    }

    const { data: createdItem, error: insertError } = await supabase
      .from('tracking_items')
      .insert({ ...fields, created_by: currentUserId })
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

    closeItemForm();
    setSuccessMessage('מופע המעקב נוסף לטבלה.');
    await loadTrackingData();
  };

  const handleSubmitWeek = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!weekDialog || isWeekSubmitting) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanTitle = weekForm.title.trim();
    if (!cleanTitle) {
      setErrorMessage('יש להזין שם לשבוע.');
      return;
    }
    // ISO yyyy-mm-dd strings compare correctly as plain strings.
    if (weekForm.startDate && weekForm.endDate && weekForm.endDate < weekForm.startDate) {
      setErrorMessage('תאריך הסיום לא יכול להיות לפני תאריך ההתחלה.');
      return;
    }

    const fields = {
      title: cleanTitle,
      description: weekForm.description.trim() || null,
      start_date: weekForm.startDate || null,
      end_date: weekForm.endDate || null,
    };
    const editingWeek = weekDialog.week;
    setIsWeekSubmitting(true);

    if (editingWeek) {
      const { data: updatedRows, error: updateError } = await supabase
        .from('tracking_weeks')
        .update(fields)
        .eq('id', editingWeek.id)
        .select('id');

      setIsWeekSubmitting(false);

      if (updateError) {
        logSupabaseError('[tracking] tracking week update failed', updateError);
        setErrorMessage(getRlsAwareErrorMessage(updateError, 'לא הצלחנו לעדכן את השבוע. נסה שוב.'));
        return;
      }
      if (!didRowsUpdate(updatedRows)) {
        setErrorMessage('לא ניתן לעדכן את השבוע — אין לך הרשאה לכך.');
        return;
      }

      if (currentUserId && currentUser) {
        void createAuditLog(supabase, {
          userId: currentUserId,
          userName: currentUser.full_name,
          userRole: currentUser.role,
          actionType: 'tracking_week_updated',
          entityType: 'tracking_week',
          entityId: editingWeek.id,
          previousValue: {
            title: editingWeek.title,
            start_date: editingWeek.start_date,
            end_date: editingWeek.end_date,
          },
          newValue: { title: fields.title, start_date: fields.start_date, end_date: fields.end_date },
        });
      }

      setWeekDialog(null);
      setWeekForm(initialWeekForm);
      setSuccessMessage('השבוע עודכן.');
      await loadTrackingData();
      return;
    }

    const nextSortOrder = weeks.reduce((max, week) => Math.max(max, week.sort_order), 0) + 1;
    const { data: createdWeek, error: insertError } = await supabase
      .from('tracking_weeks')
      .insert({ ...fields, sort_order: nextSortOrder, created_by: currentUserId })
      .select('id')
      .single<Pick<DbTrackingWeek, 'id'>>();

    setIsWeekSubmitting(false);

    if (insertError || !createdWeek) {
      if (insertError) logSupabaseError('[tracking] tracking week create failed', insertError);
      setErrorMessage(getRlsAwareErrorMessage(insertError, 'לא הצלחנו ליצור את השבוע. נסה שוב.'));
      return;
    }

    if (currentUserId && currentUser) {
      void createAuditLog(supabase, {
        userId: currentUserId,
        userName: currentUser.full_name,
        userRole: currentUser.role,
        actionType: 'tracking_week_created',
        entityType: 'tracking_week',
        entityId: createdWeek.id,
        previousValue: null,
        newValue: { title: fields.title, start_date: fields.start_date, end_date: fields.end_date },
      });
    }

    setWeekDialog(null);
    setWeekForm(initialWeekForm);
    setSelectedWeekId(createdWeek.id);
    setSuccessMessage('השבוע נוצר. אפשר להוסיף לו מופעי מעקב.');
    await loadTrackingData();
  };

  const handleRemoveWeek = async (week: DbTrackingWeek) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setRemovingWeekId(week.id);

    const { data: updatedRows, error: updateError } = await supabase
      .from('tracking_weeks')
      .update({ is_active: false })
      .eq('id', week.id)
      .select('id');

    setRemovingWeekId(null);

    if (updateError) {
      logSupabaseError('[tracking] tracking week soft delete failed', updateError);
      setErrorMessage(getRlsAwareErrorMessage(updateError, 'לא הצלחנו להסיר את השבוע. נסה שוב.'));
      return;
    }
    if (!didRowsUpdate(updatedRows)) {
      setErrorMessage('לא ניתן להסיר את השבוע — אין לך הרשאה לכך.');
      return;
    }

    if (currentUserId && currentUser) {
      void createAuditLog(supabase, {
        userId: currentUserId,
        userName: currentUser.full_name,
        userRole: currentUser.role,
        actionType: 'tracking_week_updated',
        entityType: 'tracking_week',
        entityId: week.id,
        previousValue: { title: week.title, is_active: week.is_active },
        newValue: { title: week.title, is_active: false },
      });
    }

    if (selectedWeekId === week.id) setSelectedWeekId('all');
    setPendingDelete(null);
    setSuccessMessage('השבוע הוסר, יחד עם מופעי המעקב שלו.');
    await loadTrackingData();
  };

  const handleRemoveSoldier = async (soldier: DbSoldier) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setRemovingSoldierId(soldier.id);

    const { data: updatedRows, error: updateError } = await supabase
      .from('soldiers')
      .update({
        is_active: false,
        updated_by: currentUserId,
      })
      .eq('id', soldier.id)
      .select('id');

    setRemovingSoldierId(null);

    if (updateError) {
      logSupabaseError('[tracking] soldier soft delete failed', updateError);
      setErrorMessage(getRlsAwareErrorMessage(updateError, 'לא הצלחנו להסיר את החייל מהמעקב. נסה שוב.'));
      return;
    }
    if (!didRowsUpdate(updatedRows)) {
      setErrorMessage('לא ניתן להסיר את החייל — אין לך הרשאה לכך.');
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

    const { data: updatedRows, error: updateError } = await supabase
      .from('tracking_items')
      .update({
        is_active: false,
        updated_by: currentUserId,
      })
      .eq('id', item.id)
      .select('id');

    setRemovingItemId(null);

    if (updateError) {
      logSupabaseError('[tracking] tracking item soft delete failed', updateError);
      setErrorMessage(getRlsAwareErrorMessage(updateError, 'לא הצלחנו להסיר את מופע המעקב. נסה שוב.'));
      return;
    }
    if (!didRowsUpdate(updatedRows)) {
      setErrorMessage('לא ניתן להסיר את מופע המעקב — אין לך הרשאה לכך.');
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
    if (updatingCells.has(cellKey)) return;

    const previousStatus = record?.status ?? 'empty';
    const nextStatus = getNextStatus(previousStatus);
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
    setUpdatingCells(current => new Set(current).add(cellKey));
    setRecords(current => (
      record
        ? current.map(itemRecord => (itemRecord.id === record.id ? optimisticRecord : itemRecord))
        : [optimisticRecord, ...current]
    ));

    let entityId = record?.id ?? null;
    let operationError: unknown = null;
    let savedRecord: DbTrackingRecord | null = null;

    // finally, not a plain call after the awaits: a network-level throw would
    // otherwise leave this cell in updatingCells forever, and unlike the old
    // single-key guard nothing later would overwrite it.
    try {
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

    } finally {
      releaseCell(cellKey);
    }

    if (operationError || !entityId || !savedRecord) {
      // Roll back only this cell. The previous code snapshotted the whole
      // records array before the request and restored it here, so a different
      // cell that saved successfully while this one was in flight got wiped
      // off the screen by this failure — a classic stale closure, and
      // inconsistent with the optimistic update above, which is already
      // functional. Cells are keyed independently, so undoing just this one
      // is both narrower and correct.
      setRecords(current => (
        record
          ? current.map(itemRecord => (itemRecord.id === record.id ? record : itemRecord))
          : current.filter(itemRecord => itemRecord.id !== optimisticRecord.id)
      ));
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

  const openNoteDialog = (soldier: DbSoldier, item: DbTrackingItem, record: DbTrackingRecord) => {
    setNoteDialogTarget({ soldier, item, record });
    setNoteDraft(record.note ?? '');
    setStatusDraft(record.status);
  };

  const closeNoteDialog = () => {
    if (isSavingNote) return;
    setNoteDialogTarget(null);
    setNoteDraft('');
  };

  const handleSaveCellNote = async () => {
    if (!noteDialogTarget || isSavingNote) return;
    const { record } = noteDialogTarget;
    const trimmed = noteDraft.trim();
    const nextNote = trimmed || null;
    const nextStatus = statusDraft;

    if (nextNote === record.note && nextStatus === record.status) {
      closeNoteDialog();
      return;
    }

    setIsSavingNote(true);
    setErrorMessage(null);

    const { data: updatedRecord, error: updateError } = await supabase
      .from('tracking_records')
      .update({ note: nextNote, status: nextStatus, updated_by: currentUserId })
      .eq('id', record.id)
      .select('id,soldier_id,tracking_item_id,status,note,metadata,created_by,updated_by,created_at,updated_at')
      .single<DbTrackingRecord>();

    setIsSavingNote(false);

    if (updateError || !updatedRecord) {
      if (updateError) logSupabaseError('[tracking] tracking record note update failed', updateError);
      setErrorMessage(getRlsAwareErrorMessage(
        updateError,
        'לא הצלחנו לשמור את התא. נסה שוב.',
        'אין לך הרשאה לערוך את התא הזה.',
      ));
      return;
    }

    setRecords(current => current.map(itemRecord => (itemRecord.id === updatedRecord.id ? updatedRecord : itemRecord)));

    if (currentUserId && currentUser) {
      void createAuditLog(supabase, {
        userId: currentUserId,
        userName: currentUser.full_name,
        userRole: currentUser.role,
        actionType: 'tracking_record_updated',
        entityType: 'tracking_record',
        entityId: record.id,
        previousValue: { note: record.note, status: record.status },
        newValue: { note: nextNote, status: nextStatus },
      });
    }

    setNoteDialogTarget(null);
    setNoteDraft('');
    setSuccessMessage('התא עודכן.');
  };

  // Aggregates every note written this week for one soldier into a single
  // read — only meaningful once a specific week is selected, since
  // visibleItems only narrows to one week's items at that point (see its own
  // definition above). With "all weeks" selected there is no single week to
  // summarize, so the column/section is hidden entirely rather than showing
  // a summary spanning the soldier's whole history, which is not what
  // "notes for this week" means.
  const weeklyNotesBySoldier = useMemo(() => {
    const bySoldier = new Map<string, string[]>();
    if (selectedWeekId === 'all') return bySoldier;

    for (const item of visibleItems) {
      for (const soldier of visibleSoldiers) {
        const record = recordByCell.get(`${soldier.id}:${item.id}`);
        if (!record?.note?.trim()) continue;
        const existing = bySoldier.get(soldier.id) ?? [];
        existing.push(`${item.title}: ${record.note.trim()}`);
        bySoldier.set(soldier.id, existing);
      }
    }
    return bySoldier;
  }, [visibleItems, visibleSoldiers, recordByCell, selectedWeekId]);

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <GlossyButton
        variant="slate"
        size="sm"
        onClick={() => (isSoldierFormOpen && !editingSoldier ? closeSoldierForm() : openCreateSoldier())}
        disabled={isLoading}
      >
        <UserPlus className="h-4 w-4" />
        הוסף חייל
      </GlossyButton>
      <GlossyButton
        variant="slate"
        size="sm"
        onClick={() => (isItemFormOpen && !editingItem ? closeItemForm() : openCreateItem())}
        disabled={isLoading}
      >
        <Plus className="h-4 w-4" />
        הוסף מופע מעקב
      </GlossyButton>
      <GlossyButton
        variant="slate"
        size="sm"
        onClick={() => openWeekDialog(null)}
        disabled={isLoading}
      >
        <CalendarPlus className="h-4 w-4" />
        שבוע חדש
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
              <p className="text-xs font-bold text-[var(--text-muted-accessible)]">חיילים פעילים</p>
              <p className="command-kpi mt-2 text-2xl text-[var(--text-primary)]">{soldiers.length}</p>
            </div>
            <UsersRound className="h-7 w-7 text-[var(--brand)]" />
          </div>
        </GlassCard>

        <GlassCard className="min-h-24">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-[var(--text-muted-accessible)]">מופעי מעקב</p>
              <p className="command-kpi mt-2 text-2xl text-[var(--text-primary)]">{items.length}</p>
            </div>
            <ClipboardCheck className="h-7 w-7 text-[var(--color-teal)]" />
          </div>
        </GlassCard>

        <GlassCard className="min-h-24">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-[var(--text-muted-accessible)]">רשומות תאים</p>
              <p className="command-kpi mt-2 text-2xl text-[var(--text-primary)]">{recordByCell.size}</p>
            </div>
            <Table2 className="h-7 w-7 text-[var(--text-secondary)]" />
          </div>
        </GlassCard>
      </div>

      {successMessage && (
        <div className="rounded-2xl border border-[var(--color-success)]/25 bg-[var(--color-success)]/10 px-4 py-3 text-sm font-bold text-[var(--color-success)]">
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="rounded-2xl border border-[var(--color-danger)]/25 bg-[var(--color-danger)]/10 px-4 py-3 text-sm font-bold text-[var(--color-danger)]">
          {errorMessage}
        </div>
      )}

      <CommandOverlay
        open={!!noteDialogTarget}
        onClose={closeNoteDialog}
        title={noteDialogTarget ? `עריכת תא — ${noteDialogTarget.soldier.full_name} · ${noteDialogTarget.item.title}` : 'עריכת תא'}
        dismissible={!isSavingNote}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeNoteDialog}
              disabled={isSavingNote}
              className="min-h-11 rounded-2xl border border-[var(--border-strong)] px-4 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--action)]/30 disabled:opacity-50"
            >
              ביטול
            </button>
            <button
              type="button"
              onClick={() => void handleSaveCellNote()}
              disabled={isSavingNote}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[var(--action)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--action-hover)] disabled:opacity-60"
            >
              {isSavingNote && <Loader2 className="h-4 w-4 animate-spin" />}
              שמירה
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <div role="radiogroup" aria-label="סטטוס" className="grid grid-cols-4 gap-2">
            {statusCycle.map(status => (
              <button
                key={status}
                type="button"
                role="radio"
                aria-checked={statusDraft === status}
                onClick={() => setStatusDraft(status)}
                disabled={isSavingNote}
                className={`min-h-11 rounded-full border px-2 text-xs font-semibold transition disabled:opacity-60 ${statusStyles[status]} ${statusDraft === status ? 'ring-2 ring-[var(--action)] ring-offset-1 ring-offset-[var(--surface)]' : 'opacity-70'}`}
              >
                {statusLabels[status]}
              </button>
            ))}
          </div>
          <textarea
            value={noteDraft}
            onChange={(event) => setNoteDraft(event.target.value)}
            disabled={isSavingNote}
            placeholder="הערה — לדוגמה: תרגל שוב ביום ה׳, החסיר בגלל אימון קודם"
            className="command-input min-h-32 w-full resize-none"
          />
        </div>
      </CommandOverlay>

      <CommandOverlay
        open={!!weekDialog}
        onClose={closeWeekDialog}
        title={weekDialog?.week ? `עריכת שבוע — ${weekDialog.week.title}` : 'שבוע מעקב חדש'}
        dismissible={!isWeekSubmitting}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeWeekDialog}
              disabled={isWeekSubmitting}
              className="min-h-11 rounded-2xl border border-[var(--border-strong)] px-4 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--action)]/30 disabled:opacity-50"
            >
              ביטול
            </button>
            <button
              type="submit"
              form="tracking-week-form"
              disabled={isWeekSubmitting}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[var(--action)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--action-hover)] disabled:opacity-60"
            >
              {isWeekSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {weekDialog?.week ? 'שמירה' : 'יצירת שבוע'}
            </button>
          </div>
        }
      >
        <form id="tracking-week-form" onSubmit={handleSubmitWeek} className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-2 sm:col-span-2">
            <span className="block text-xs font-semibold text-[var(--text-secondary)]">שם השבוע</span>
            <input
              required
              value={weekForm.title}
              onChange={event => setWeekForm(value => ({ ...value, title: event.target.value }))}
              className="command-input"
              placeholder="לדוגמה: שבוע ניווטים"
              disabled={isWeekSubmitting}
            />
          </label>
          <label className="block space-y-2">
            <span className="block text-xs font-semibold text-[var(--text-secondary)]">תאריך התחלה</span>
            <input
              type="date"
              value={weekForm.startDate}
              onChange={event => setWeekForm(value => ({ ...value, startDate: event.target.value }))}
              className="command-input"
              disabled={isWeekSubmitting}
            />
          </label>
          <label className="block space-y-2">
            <span className="block text-xs font-semibold text-[var(--text-secondary)]">תאריך סיום</span>
            <input
              type="date"
              value={weekForm.endDate}
              onChange={event => setWeekForm(value => ({ ...value, endDate: event.target.value }))}
              className="command-input"
              disabled={isWeekSubmitting}
            />
          </label>
          <label className="block space-y-2 sm:col-span-2">
            <span className="block text-xs font-semibold text-[var(--text-secondary)]">תיאור</span>
            <textarea
              value={weekForm.description}
              onChange={event => setWeekForm(value => ({ ...value, description: event.target.value }))}
              className="command-input min-h-20 resize-none"
              placeholder="אופציונלי"
              disabled={isWeekSubmitting}
            />
          </label>
          {errorMessage && (
            <div className="text-caption rounded-2xl border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10 px-3 py-2 font-semibold text-[var(--color-danger)] sm:col-span-2">
              {errorMessage}
            </div>
          )}
        </form>
      </CommandOverlay>

      <CommandConfirmDialog
        open={!!pendingDelete}
        onCancel={closeDeleteModal}
        onConfirm={() => void handleConfirmDelete()}
        title="אישור הסרה"
        description={
          <>
            <p>
              {pendingDelete?.type === 'soldier' ? (
                <>להסיר את החייל <span className="font-semibold text-[var(--text-primary)]">{pendingDelete.label}</span> מהמעקב?</>
              ) : pendingDelete?.type === 'week' ? (
                <>להסיר את השבוע <span className="font-semibold text-[var(--text-primary)]">{pendingDelete.label}</span>? מופעי המעקב של השבוע יוסתרו מהטבלה יחד איתו.</>
              ) : pendingDelete ? (
                <>להסיר את מופע המעקב <span className="font-semibold text-[var(--text-primary)]">{pendingDelete.label}</span> מהטבלה?</>
              ) : null}
            </p>
            <p className="text-caption mt-2 text-[var(--text-muted-accessible)]">
              ההסרה לא מוחקת את הנתונים לצמיתות, אלא מסתירה אותם מהמעקב הפעיל.
            </p>
            {errorMessage && (
              <div className="text-caption mt-3 rounded-2xl border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10 px-3 py-2 font-semibold text-[var(--color-danger)]">
                {errorMessage}
              </div>
            )}
          </>
        }
        confirmLabel="הסר"
        destructive
        loading={isDeleteSubmitting}
      />

      {isSoldierFormOpen && (
        <div ref={soldierFormRef} className="scroll-mt-4">
        <GlassCard glow="orange" className="space-y-4">
          <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-3">
            {editingSoldier ? <Pencil className="h-4 w-4 text-[var(--brand)]" /> : <UserPlus className="h-4 w-4 text-[var(--brand)]" />}
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              {editingSoldier ? `עריכת חייל — ${editingSoldier.full_name}` : 'הוספת חייל למעקב'}
            </h2>
          </div>
          <form onSubmit={handleSubmitSoldier} className="grid gap-4 lg:grid-cols-2">
            <label className="block space-y-2">
              <span className="block text-xs font-semibold text-[var(--text-secondary)]">שם מלא</span>
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
              <span className="block text-xs font-semibold text-[var(--text-secondary)]">מספר אישי</span>
              <input
                value={soldierForm.personalNumber}
                onChange={event => setSoldierForm(value => ({ ...value, personalNumber: event.target.value }))}
                className="command-input"
                placeholder="אופציונלי"
                disabled={isSoldierSubmitting}
              />
            </label>

            <label className="block space-y-2">
              <span className="block text-xs font-semibold text-[var(--text-secondary)]">יחידה</span>
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
              <span className="block text-xs font-semibold text-[var(--text-secondary)]">כיתה / צוות</span>
              <input
                value={soldierForm.squadLabel}
                onChange={event => setSoldierForm(value => ({ ...value, squadLabel: event.target.value }))}
                className="command-input"
                placeholder="אופציונלי"
                disabled={isSoldierSubmitting}
              />
            </label>

            <label className="block space-y-2">
              <span className="block text-xs font-semibold text-[var(--text-secondary)]">תפקיד</span>
              <input
                value={soldierForm.roleLabel}
                onChange={event => setSoldierForm(value => ({ ...value, roleLabel: event.target.value }))}
                className="command-input"
                placeholder="לוחם / חובש / קשר"
                disabled={isSoldierSubmitting}
              />
            </label>

            <label className="block space-y-2 lg:col-span-2">
              <span className="block text-xs font-semibold text-[var(--text-secondary)]">הערות</span>
              <textarea
                value={soldierForm.notes}
                onChange={event => setSoldierForm(value => ({ ...value, notes: event.target.value }))}
                className="command-input min-h-24 resize-none"
                placeholder="אופציונלי"
                disabled={isSoldierSubmitting}
              />
              <FieldPrivacyHint />
            </label>

            <div className="flex flex-col gap-2 lg:col-span-2 sm:flex-row">
              <GlossyButton type="submit" variant="orange" size="lg" disabled={isSoldierSubmitting} className="flex-1">
                {isSoldierSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {editingSoldier ? 'שמור שינויים' : 'שמור חייל'}
              </GlossyButton>
              <GlossyButton
                type="button"
                variant="slate"
                size="lg"
                onClick={closeSoldierForm}
                disabled={isSoldierSubmitting}
                className="flex-1"
              >
                ביטול
              </GlossyButton>
            </div>
          </form>
        </GlassCard>
        </div>
      )}

      {isItemFormOpen && (
        <div ref={itemFormRef} className="scroll-mt-4">
        <GlassCard glow="orange" className="space-y-4">
          <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-3">
            {editingItem ? <Pencil className="h-4 w-4 text-[var(--brand)]" /> : <ClipboardCheck className="h-4 w-4 text-[var(--brand)]" />}
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              {editingItem ? `עריכת מופע — ${editingItem.title}` : 'הוספת מופע מעקב'}
            </h2>
          </div>
          <form onSubmit={handleSubmitItem} className="grid gap-4 lg:grid-cols-2">
            <label className="block space-y-2">
              <span className="block text-xs font-semibold text-[var(--text-secondary)]">שם מופע</span>
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
              <span className="block text-xs font-semibold text-[var(--text-secondary)]">קטגוריה</span>
              <select
                required
                value={itemForm.category}
                onChange={event => setItemForm(value => ({ ...value, category: event.target.value }))}
                className="command-select"
                disabled={isItemSubmitting}
              >
                {/* An existing item may carry a category outside the preset list
                    (real data already does) — keep it selectable when editing. */}
                {[...new Set([...itemCategories, itemForm.category].filter(Boolean))].map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="block text-xs font-semibold text-[var(--text-secondary)]">נושא</span>
              <input
                value={itemForm.subject}
                onChange={event => setItemForm(value => ({ ...value, subject: event.target.value }))}
                className="command-input"
                placeholder="אופציונלי"
                disabled={isItemSubmitting}
              />
            </label>

            <label className="block space-y-2">
              <span className="block text-xs font-semibold text-[var(--text-secondary)]">שבוע מעקב</span>
              <select
                value={itemForm.weekId}
                onChange={event => setItemForm(value => ({ ...value, weekId: event.target.value }))}
                className="command-select"
                disabled={isItemSubmitting}
              >
                <option value="">ללא שיוך לשבוע</option>
                {weeks.map(week => (
                  <option key={week.id} value={week.id}>{week.title}</option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="block text-xs font-semibold text-[var(--text-secondary)]">סדר תצוגה</span>
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
              <span className="block text-xs font-semibold text-[var(--text-secondary)]">תיאור</span>
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
                {editingItem ? 'שמור שינויים' : 'שמור מופע'}
              </GlossyButton>
              <GlossyButton
                type="button"
                variant="slate"
                size="lg"
                onClick={closeItemForm}
                disabled={isItemSubmitting}
                className="flex-1"
              >
                ביטול
              </GlossyButton>
            </div>
          </form>
        </GlassCard>
        </div>
      )}

      {isLoading && (
        <GlassCard className="flex min-h-64 items-center justify-center text-[var(--text-muted-accessible)]">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--color-action-on-surface)]" />
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
              onAction={openCreateSoldier}
              badgeLabel="Roster"
            />
          )}

          {items.length === 0 && (
            <EmptyState
              icon={ClipboardCheck}
              title="עדיין אין מופעי מעקב"
              description="הוסף כשירות, אימון, מטווח או קטגוריה אחרת כדי לפתוח עמודות בטבלה."
              actionText="הוסף מופע"
              onAction={openCreateItem}
              badgeLabel="Tracking Items"
            />
          )}
        </div>
      )}

      {!isLoading && !showEmptyState && (
        <GlassCard className="space-y-5 overflow-hidden">
          <div className="flex flex-col gap-2 border-b border-[var(--border-subtle)] pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">טבלת מעקב</h2>
              <p className="mt-1 text-xs font-bold text-[var(--text-muted-accessible)]">שורות לפי חיילים, עמודות לפי מופעי מעקב.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(statusLabels) as TrackingStatus[]).map((status) => (
                <span
                  key={status}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles[status]}`}
                >
                  {statusLabels[status]} - {statusCounts[status]}
                </span>
              ))}
            </div>
          </div>

          {weeks.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedWeekId('all')}
                className={`touch-target min-h-9 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${selectedWeekId === 'all' ? 'border-[var(--action)] bg-[var(--action)] text-white shadow-[0_6px_16px_rgba(255,107,2,0.22)]' : 'border-[var(--border-subtle)] bg-[var(--tactical-glass)] text-[var(--text-muted-accessible)] hover:border-[var(--action)]/30'}`}
              >
                כל השבועות
              </button>
              {weeks.map(week => (
                <button
                  key={week.id}
                  type="button"
                  onClick={() => setSelectedWeekId(week.id)}
                  title={week.description ?? undefined}
                  className={`touch-target min-h-9 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${selectedWeekId === week.id ? 'border-[var(--action)] bg-[var(--action)] text-white shadow-[0_6px_16px_rgba(255,107,2,0.22)]' : 'border-[var(--border-subtle)] bg-[var(--tactical-glass)] text-[var(--text-muted-accessible)] hover:border-[var(--action)]/30'}`}
                >
                  {week.title}
                </button>
              ))}
            </div>
          )}

          {selectedWeekId !== 'all' && (() => {
            const week = weeks.find(w => w.id === selectedWeekId);
            if (!week) return null;
            const range = formatWeekRange(week);
            return (
              <div className="flex items-start justify-between gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3.5 py-2.5">
                <div className="min-w-0 text-xs font-semibold leading-relaxed text-[var(--text-muted-accessible)]">
                  <div className="font-semibold text-[var(--text-primary)]">
                    {week.title}{range ? ` · ${range}` : ''}
                  </div>
                  {week.description && <p className="mt-0.5">{week.description}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    title="עריכת שבוע"
                    onClick={() => openWeekDialog(week)}
                    className="touch-target inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--tactical-glass)] text-[var(--text-secondary)] transition hover:border-[var(--action)]/30"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span className="sr-only">עריכת שבוע</span>
                  </button>
                  <button
                    type="button"
                    title="הסרת שבוע"
                    onClick={() => requestRemoveWeek(week)}
                    disabled={removingWeekId === week.id}
                    className="touch-target inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-danger)]/25 bg-[var(--color-danger)]/10 text-[var(--color-danger)] transition disabled:cursor-wait disabled:opacity-60"
                  >
                    {removingWeekId === week.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    <span className="sr-only">הסרת שבוע</span>
                  </button>
                </div>
              </div>
            );
          })()}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--command-subtle)]" />
              <input
                type="text"
                value={searchText}
                onChange={event => setSearchText(event.target.value)}
                placeholder="חיפוש חייל, מחלקה או כיתה…"
                aria-label="חיפוש חייל, מחלקה או כיתה"
                className="command-input pr-10"
              />
            </div>
            {availableUnits.length > 0 && (
              <select
                value={unitFilter}
                onChange={event => setUnitFilter(event.target.value)}
                aria-label="סינון לפי מחלקה"
                className="command-select min-h-11 w-full sm:w-52"
              >
                <option value="all">כל המחלקות</option>
                {availableUnits.map(unit => (
                  <option key={unit.id} value={unit.id}>{unit.name}</option>
                ))}
              </select>
            )}
            {availableCategories.length > 0 && (
              <select
                value={categoryFilter}
                onChange={event => setCategoryFilter(event.target.value)}
                aria-label="סינון לפי קטגוריה"
                className="command-select min-h-11 w-full sm:w-52"
              >
                <option value="all">כל הקטגוריות</option>
                {availableCategories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            )}
          </div>

          {(visibleItems.length === 0 || visibleSoldiers.length === 0) ? (
            <EmptyState
              icon={Search}
              title="אין תוצאות לסינון הנוכחי"
              description="נסה לשנות את השבוע, הקטגוריה או מילת החיפוש."
            />
          ) : (
          <>
          {/* Mobile has no column headers to hang item actions on, so item
              edit/remove lives in this collapsed list instead. */}
          <details className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--tactical-glass)] px-4 py-3 md:hidden">
            <summary className="cursor-pointer text-xs font-semibold text-[var(--text-primary)]">
              ניהול מופעי מעקב ({visibleItems.length})
            </summary>
            <div className="mt-2 divide-y divide-[var(--border-subtle)]">
              {visibleItems.map(item => (
                <div key={item.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold text-[var(--text-primary)]">{item.title}</div>
                    <div className="text-caption font-bold text-[var(--command-subtle)]">{item.category}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      title="עריכת מופע"
                      onClick={() => openEditItem(item)}
                      className="touch-target inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--tactical-glass)] text-[var(--text-secondary)]"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span className="sr-only">עריכה</span>
                    </button>
                    <button
                      type="button"
                      title="הסר מופע מעקב מהטבלה"
                      onClick={() => requestRemoveItem(item)}
                      disabled={removingItemId === item.id}
                      className="touch-target inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-danger)]/25 bg-[var(--color-danger)]/10 text-[var(--color-danger)] disabled:cursor-wait disabled:opacity-60"
                    >
                      {removingItemId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      <span className="sr-only">הסר</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </details>

          {/* Mobile: a table with one column per item forces horizontal
              scrolling that's unusable on a phone — stack each soldier as a
              card with their items listed vertically instead. */}
          <div className="space-y-3 md:hidden">
            {visibleSoldiers.map((soldier) => (
              <div key={soldier.id} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--tactical-glass)] p-4 shadow-[0_8px_18px_rgba(2,1,8,0.04)]">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-[var(--text-primary)]">{soldier.full_name}</div>
                    <div className="mt-1 text-caption font-bold text-[var(--text-muted-accessible)]">
                      {unitNameById.get(soldier.unit_id) ?? 'יחידה לא ידועה'}
                    </div>
                    <div className="mt-0.5 text-caption font-bold text-[var(--command-subtle)]">
                      {soldier.role_label ?? soldier.squad_label ?? 'ללא שיוך נוסף'}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    title="עריכת פרטי חייל"
                    onClick={() => openEditSoldier(soldier)}
                    className="touch-target inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--tactical-glass)] text-[var(--text-secondary)]"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span className="sr-only">עריכה</span>
                  </button>
                  <button
                    type="button"
                    title="הסר חייל מהמעקב"
                    onClick={() => requestRemoveSoldier(soldier)}
                    disabled={removingSoldierId === soldier.id}
                    className="touch-target inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--color-danger)]/25 bg-[var(--color-danger)]/10 text-[var(--color-danger)] transition hover:border-[var(--color-danger)]/25 hover:bg-[var(--color-danger)]/10 disabled:cursor-wait disabled:opacity-60"
                  >
                    {removingSoldierId === soldier.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    <span className="sr-only">הסר</span>
                  </button>
                  </div>
                </div>

                <div className="mt-3 divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)]">
                  {visibleItems.map((item) => {
                    const record = recordByCell.get(`${soldier.id}:${item.id}`);
                    const status = record?.status ?? 'empty';
                    const cellKey = `${soldier.id}:${item.id}`;
                    const isCellUpdating = updatingCells.has(cellKey);

                    return (
                      <div key={item.id} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-semibold text-[var(--text-primary)]">{item.title}</div>
                          <div className="text-caption font-bold text-[var(--command-subtle)]">{item.category}</div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button
                            type="button"
                            title="לחיצה מחליפה סטטוס"
                            onClick={() => void handleCycleCellStatus(soldier, item, record)}
                            disabled={isCellUpdating}
                            className={`inline-flex min-h-11 min-w-20 items-center justify-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition hover:shadow-sm disabled:cursor-wait disabled:opacity-70 ${statusStyles[status]}`}
                          >
                            {isCellUpdating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            {statusLabels[status]}
                          </button>
                          <button
                            type="button"
                            title={record ? 'עריכת תא — סטטוס והערה' : 'סמן סטטוס לפני עריכת התא'}
                            onClick={() => record && openNoteDialog(soldier, item, record)}
                            disabled={!record}
                            className={`touch-target inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-40 ${
                              record?.note
                                ? 'border-[var(--brand)]/30 bg-[var(--brand)]/10 text-[var(--color-action-on-surface)]'
                                : 'border-[var(--border-strong)] bg-[var(--tactical-glass)] text-[var(--text-muted-accessible)]'
                            }`}
                          >
                            <NotebookPen className="h-4 w-4" />
                            <span className="sr-only">הערה</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {weeklyNotesBySoldier.has(soldier.id) && (
                  <div className="mt-3 rounded-xl border border-[var(--brand)]/20 bg-[var(--brand)]/5 p-3">
                    <div className="mb-1 flex items-center gap-1.5 text-caption font-bold text-[var(--color-action-on-surface)]">
                      <NotebookPen className="h-3.5 w-3.5" />
                      הערות השבוע
                    </div>
                    <ul className="space-y-1 text-xs font-semibold text-[var(--text-secondary)]">
                      {weeklyNotesBySoldier.get(soldier.id)?.map((line, index) => (
                        <li key={index}>{line}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="hidden max-w-full overflow-x-auto pb-2 md:block">
            <table
              className="border-separate border-spacing-y-2 text-right text-sm"
              style={{ minWidth: `${Math.max(760, 280 + visibleItems.length * 176)}px` }}
            >
              <thead className="text-xs font-semibold text-[var(--text-muted-accessible)]">
                <tr>
                  <th className="sticky right-0 z-20 w-64 bg-[var(--tactical-strong-glass)] px-3 py-2 backdrop-blur-xl">חייל</th>
                  {visibleItems.map((item) => (
                    <th key={item.id} className="w-44 px-3 py-2 align-bottom">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold text-[var(--text-primary)]">{item.title}</div>
                          <div className="mt-1 text-caption font-bold text-[var(--command-subtle)]">{item.category}</div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          title="עריכת מופע"
                          onClick={() => openEditItem(item)}
                          className="touch-target inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--tactical-glass)] text-[var(--text-secondary)] transition hover:border-[var(--action)]/30"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span className="sr-only">עריכה</span>
                        </button>
                        <button
                          type="button"
                          title="הסר מופע מעקב מהטבלה"
                          onClick={() => requestRemoveItem(item)}
                          disabled={removingItemId === item.id}
                          className="touch-target inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--color-danger)]/25 bg-[var(--color-danger)]/10 text-[var(--color-danger)] transition hover:border-[var(--color-danger)]/25 hover:bg-[var(--color-danger)]/10 disabled:cursor-wait disabled:opacity-60"
                        >
                          {removingItemId === item.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          <span className="sr-only">הסר</span>
                        </button>
                        </div>
                      </div>
                    </th>
                  ))}
                  {selectedWeekId !== 'all' && (
                    <th className="w-56 rounded-l-xl px-3 py-2 align-bottom">
                      <div className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
                        <NotebookPen className="h-3.5 w-3.5" />
                        הערות השבוע
                      </div>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {visibleSoldiers.map((soldier) => (
                  <tr key={soldier.id} className="bg-[var(--tactical-glass)] shadow-[0_8px_18px_rgba(2,1,8,0.04)]">
                    <td className="sticky right-0 z-10 rounded-r-xl bg-[var(--tactical-strong-glass)] px-3 py-3 font-semibold text-[var(--text-primary)] backdrop-blur-xl">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div>{soldier.full_name}</div>
                          <div className="mt-1 text-caption font-bold text-[var(--text-muted-accessible)]">
                            {unitNameById.get(soldier.unit_id) ?? 'יחידה לא ידועה'}
                          </div>
                          <div className="mt-1 text-caption font-bold text-[var(--command-subtle)]">
                            {soldier.role_label ?? soldier.squad_label ?? 'ללא שיוך נוסף'}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          title="עריכת פרטי חייל"
                          onClick={() => openEditSoldier(soldier)}
                          className="touch-target inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--tactical-glass)] text-[var(--text-secondary)] transition hover:border-[var(--action)]/30"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span className="sr-only">עריכה</span>
                        </button>
                        <button
                          type="button"
                          title="הסר חייל מהמעקב"
                          onClick={() => requestRemoveSoldier(soldier)}
                          disabled={removingSoldierId === soldier.id}
                          className="touch-target inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--color-danger)]/25 bg-[var(--color-danger)]/10 text-[var(--color-danger)] transition hover:border-[var(--color-danger)]/25 hover:bg-[var(--color-danger)]/10 disabled:cursor-wait disabled:opacity-60"
                        >
                          {removingSoldierId === soldier.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          <span className="sr-only">הסר</span>
                        </button>
                        </div>
                      </div>
                    </td>
                    {visibleItems.map((item, itemIndex) => {
                      const record = recordByCell.get(`${soldier.id}:${item.id}`);
                      const status = record?.status ?? 'empty';
                      const cellKey = `${soldier.id}:${item.id}`;
                      const isCellUpdating = updatingCells.has(cellKey);

                      // The notes column, when shown, is the true last column now —
                      // only round this cell's corner when there is no notes
                      // column to take that place.
                      const isLastColumn = itemIndex === visibleItems.length - 1 && selectedWeekId === 'all';

                      return (
                        <td
                          key={item.id}
                          className={`px-3 py-3 text-xs font-semibold ${isLastColumn ? 'rounded-l-xl' : ''}`}
                        >
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              title="לחיצה מחליפה סטטוס"
                              onClick={() => void handleCycleCellStatus(soldier, item, record)}
                              disabled={isCellUpdating}
                              className={`inline-flex min-h-11 min-w-20 items-center justify-center gap-1.5 rounded-full border px-3 py-1 transition hover:shadow-sm disabled:cursor-wait disabled:opacity-70 ${statusStyles[status]}`}
                            >
                              {isCellUpdating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                              {statusLabels[status]}
                            </button>
                            <button
                              type="button"
                              title={record ? 'עריכת תא — סטטוס והערה' : 'סמן סטטוס לפני עריכת התא'}
                              onClick={() => record && openNoteDialog(soldier, item, record)}
                              disabled={!record}
                              className={`touch-target inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-40 ${
                                record?.note
                                  ? 'border-[var(--brand)]/30 bg-[var(--brand)]/10 text-[var(--color-action-on-surface)]'
                                  : 'border-[var(--border-strong)] bg-[var(--tactical-glass)] text-[var(--text-muted-accessible)]'
                              }`}
                            >
                              <NotebookPen className="h-3.5 w-3.5" />
                              <span className="sr-only">הערה</span>
                            </button>
                          </div>
                        </td>
                      );
                    })}
                    {selectedWeekId !== 'all' && (
                      <td className="rounded-l-xl px-3 py-3 align-top text-xs font-semibold text-[var(--text-secondary)]">
                        {weeklyNotesBySoldier.has(soldier.id) ? (
                          <ul className="space-y-1">
                            {weeklyNotesBySoldier.get(soldier.id)?.map((line, index) => (
                              <li key={index}>{line}</li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-[var(--command-subtle)]">אין הערות השבוע</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
          )}
        </GlassCard>
      )}
    </div>
  );
}
