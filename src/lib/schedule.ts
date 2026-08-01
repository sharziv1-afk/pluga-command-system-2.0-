import type { DbEvent } from '@/lib/types';

type EventTiming = Pick<DbEvent, 'status' | 'starts_at' | 'ends_at'>;

export function getScheduleDisplayStatus(
  event: EventTiming,
  nowMs = Date.now(),
): DbEvent['status'] {
  if (!['scheduled', 'in_progress'].includes(event.status)) return event.status;

  const endMs = new Date(event.ends_at ?? event.starts_at).getTime();
  return Number.isFinite(endMs) && endMs < nowMs ? 'completed' : event.status;
}
