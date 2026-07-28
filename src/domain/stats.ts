import { Session } from '../store/types';

/**
 * Local calendar day, not UTC. A session at 11pm and one at 1am are different
 * days to the person who sat them, whatever the timezone offset says.
 */
function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * Consecutive days with at least one completed session, counting back from today.
 *
 * Today not having a session yet does not break the streak — it is only broken
 * once a whole day has passed without one. Anything else would put the app in
 * the business of making you anxious before dinner.
 */
export function currentStreak(
  sessions: readonly Session[],
  now: number = Date.now()
): number {
  if (sessions.length === 0) return 0;

  const days = new Set(sessions.map((s) => dayKey(s.completedAt)));
  const cursor = new Date(now);

  if (!days.has(dayKey(cursor.getTime()))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (days.has(dayKey(cursor.getTime()))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

/** Distinct days on which the user sat. A gentler number than total sessions. */
export function daysSat(sessions: readonly Session[]): number {
  return new Set(sessions.map((s) => dayKey(s.completedAt))).size;
}

/** Total time actually sat, in milliseconds. */
export function totalSatMs(sessions: readonly Session[]): number {
  return sessions.reduce((sum, s) => sum + s.durationMs, 0);
}
