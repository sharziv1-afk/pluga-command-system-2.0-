'use client';

import React from 'react';
import type { DbEvent } from '@/lib/types';

export type EventAudience = NonNullable<DbEvent['notify_audience']>;

type AudienceUser = { id: string; name: string | null; email: string; role: string };

// Matches the check constraint and event_audience_user_ids() in migration 039.
export const EVENT_AUDIENCE_OPTIONS: Array<{ value: EventAudience; label: string; hint: string }> = [
  { value: 'none', label: 'ללא התראה', hint: 'המופע מופיע בלו״ז בלבד. אם יש אחראי, הוא עדיין מקבל התראה.' },
  { value: 'responsible', label: 'רק האחראי', hint: 'התראה לאחראי בלבד.' },
  { value: 'unit', label: 'האחראי וסגל המסגרת', hint: 'כל הסגל במסגרת של המופע ובמסגרות שמתחתיה.' },
  { value: 'forum', label: 'פורום מוביל', hint: 'מ״פ, סמ״פ, מ״מ 1–4, מש״ד, רס״פ / לוגיסטיקה, חובש פלוגתי.' },
  { value: 'custom', label: 'אנשים מסוימים', hint: 'בחירה מהרשימה.' },
];

/**
 * "מי מקבל התראה" for an event (notifications stage 2). 'none' is the
 * default: the schedule holds 10–18 company events a day, so a notification
 * goes out only for an event someone chose to announce.
 */
export function EventAudienceField({
  audience,
  onAudienceChange,
  userIds,
  onUserIdsChange,
  users,
  disabled,
  selectClassName,
}: {
  audience: EventAudience;
  onAudienceChange: (value: EventAudience) => void;
  userIds: string[];
  onUserIdsChange: (value: string[]) => void;
  users: AudienceUser[];
  disabled?: boolean;
  selectClassName: string;
}) {
  const hint = EVENT_AUDIENCE_OPTIONS.find(option => option.value === audience)?.hint;

  const toggle = (id: string) => {
    onUserIdsChange(userIds.includes(id) ? userIds.filter(value => value !== id) : [...userIds, id]);
  };

  return (
    <div className="space-y-1 lg:col-span-2">
      <label className="block space-y-1">
        <span className="text-xs font-bold text-[var(--text-muted-accessible)]">מי מקבל התראה</span>
        <select
          value={audience}
          onChange={(event) => onAudienceChange(event.target.value as EventAudience)}
          className={selectClassName}
          disabled={disabled}
        >
          {EVENT_AUDIENCE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      {hint && <p className="text-caption font-semibold text-[var(--text-muted-accessible)]">{hint}</p>}

      {audience === 'custom' && (
        <fieldset className="mt-2 max-h-52 space-y-1 overflow-y-auto rounded-2xl border border-[var(--border-subtle)] p-2" disabled={disabled}>
          <legend className="sr-only">בחירת אנשים</legend>
          {users.map(user => (
            <label key={user.id} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-xl px-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)]">
              <input type="checkbox" checked={userIds.includes(user.id)} onChange={() => toggle(user.id)} className="h-4 w-4" />
              <span>{user.name || user.email}</span>
              <span className="text-[var(--text-muted-accessible)]">· {user.role}</span>
            </label>
          ))}
        </fieldset>
      )}
    </div>
  );
}
