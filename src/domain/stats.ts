/**
 * What the app knows about when someone sat.
 *
 * None of this is stored. Every answer here is computed from `sessions` on the
 * way to a screen, the same as the plots, the offers and the streak that
 * decides whether a stage may be proposed — there is no counter kept anywhere
 * that could quietly come to disagree with the sittings themselves. A garden
 * restored from a three-version-old blob therefore reports what actually
 * happened rather than what somebody last remembered to increment.
 */

import { Session } from '../store/types';

/**
 * The hour a day turns over at. Late enough to hold an ordinary late night,
 * early enough that nobody's morning sitting falls into yesterday.
 */
export const DAY_START_HOUR = 4;

/**
 * The calendar day `ts` belongs to, with anything before `DAY_START_HOUR`
 * belonging to the day before.
 *
 * It rolls the date back rather than subtracting four hours of milliseconds,
 * and the reason is the one written out under `bestStreak`: a day here is a
 * local calendar day, and twice a year the gap between two of them is 23 or 25
 * hours. `setDate` steps the calendar and lets the zone say how long the step
 * was; four hours of milliseconds is a fixed distance, and on either side of a
 * changeover it lands an hour out — which is enough to put a sitting at five in
 * the morning into the night before.
 *
 * Every walk in this file steps a `Date` carrying the hour it started from,
 * which is what lets `setDate` step logical days as well as calendar ones: the
 * hour does not change, so which side of `DAY_START_HOUR` it falls on does not
 * either. That holds for a cursor started from `now` and for one started from a
 * sitting alike.
 *
 * Private. `dayKey` and `weekdayIndex` are the two questions the app actually
 * asks of it, and handing out the `Date` would be handing out a third.
 */
function logicalDate(ts: number): Date {
  const d = new Date(ts);
  if (d.getHours() < DAY_START_HOUR) d.setDate(d.getDate() - 1);
  return d;
}

/**
 * Local calendar day, not UTC, and it begins at 04:00 rather than at midnight.
 *
 * Somebody sitting at half past one has sat at the end of their Saturday, not
 * the start of their Sunday, and a streak that broke because they were still up
 * would be the app arguing with them about the clock. So a sitting belongs to
 * the evening it ended, not to the morning it happened to touch.
 *
 * Local rather than UTC for the same reason at the other end: a session at 11pm
 * and one at 5am are different days to the person who sat them, whatever the
 * timezone offset says.
 *
 * Exported because the reminder's wording is chosen by the day too, and "what
 * counts as a day here" is a decision this app should only make once.
 */
export function dayKey(ts: number): string {
  const d = logicalDate(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * Which column of a Monday-first week `ts` falls in. Monday is 0, Sunday 6.
 *
 * The week starts on Monday, and `Date.getDay()` does not: it calls Sunday 0,
 * so subtracting it lands on the Sunday *before* every day of the week except
 * Sunday itself, where it lands on the day it was given. Used raw it would draw
 * a row that starts a day early for six days out of seven and a week early on
 * the seventh — which is the sort of wrong that looks right until somebody
 * opens the app on a Sunday. `(getDay() + 6) % 7` is the rotation that fixes
 * it: Monday comes out 0 and Sunday 6, which is where the last column of a
 * Monday-first row belongs.
 *
 * It asks the *logical* day, which matters for one hour of the week and matters
 * by a whole week when it does: at two in the morning on a Monday the calendar
 * has started a week the sitter has not, and the row to draw is the one that
 * ends with the Sunday they are still in.
 *
 * Exported because the days screen asks the same question of the same instant —
 * `weekSat` to find its Monday, the screen to say which column is today. Two
 * copies of one rotation would agree by luck rather than by construction.
 */
export function weekdayIndex(ts: number): number {
  return (logicalDate(ts).getDay() + 6) % 7;
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

/**
 * The longest run of consecutive days there has ever been.
 *
 * This is what lets a screen show a run at all. A current streak is a number
 * that spends most of its life going down, and a large figure reading 0 the
 * morning after a missed day is the app telling you that you failed — which is
 * the one thing it does not do. Kept beside it, the best turns a broken run
 * into a run that *ended*: the days are still there, the app still knows about
 * them, and nothing on the screen has gone to zero and stayed there. So this
 * exists for the sake of that rule rather than as one more statistic.
 *
 * It walks back a calendar day at a time from the newest sitting rather than
 * differencing timestamps, which is the walk `currentStreak` makes and for the
 * same reason: a day here is a local calendar day, and twice a year the gap
 * between two of them is 23 or 25 hours. When today's run happens to be the
 * longest the two must therefore agree, and a test pins that — they arrive at
 * the number from opposite ends of the history, so they could drift apart
 * without either one looking wrong on its own.
 */
export function bestStreak(sessions: readonly Session[]): number {
  if (sessions.length === 0) return 0;

  const days = new Set(sessions.map((s) => dayKey(s.completedAt)));

  let newest = sessions[0].completedAt;
  let oldest = sessions[0].completedAt;
  for (const s of sessions) {
    if (s.completedAt > newest) newest = s.completedAt;
    if (s.completedAt < oldest) oldest = s.completedAt;
  }

  const first = dayKey(oldest);
  const cursor = new Date(newest);

  let best = 0;
  let run = 0;
  for (;;) {
    const key = dayKey(cursor.getTime());
    run = days.has(key) ? run + 1 : 0;
    if (run > best) best = run;
    // The oldest sitting's own day is the far end of the history; there is
    // nothing behind it to extend a run, so the walk stops rather than
    // wandering back through empty years.
    if (key === first) return best;
    cursor.setDate(cursor.getDate() - 1);
  }
}

/**
 * Whether a sitting has already been completed today.
 *
 * Deliberately not `currentStreak(sessions) > 0`, which is a different and much
 * softer question: a streak stays alive all day on yesterday's strength, so it
 * is true from the moment you wake up. This asks only what the garden asks —
 * has anything grown today — and it is the whole basis of the two marks that
 * answer it, so it must not be true before it is earned.
 */
export function satToday(
  sessions: readonly Session[],
  now: number = Date.now()
): boolean {
  const today = dayKey(now);
  return sessions.some((s) => dayKey(s.completedAt) === today);
}

/**
 * The seven days of the local week containing `now`, Monday first.
 *
 * How far back Monday is, is `weekdayIndex`'s question — see it for why the
 * rotation is there and why it is asked of the logical day.
 *
 * Days later in the week than today come back `false`, the same value a missed
 * day gets. That is deliberate. The difference between "not yet" and "not done"
 * is a matter of drawing, and the screen already knows which day is today;
 * answering it here would mean a third state that every caller has to carry.
 */
export function weekSat(
  sessions: readonly Session[],
  now: number = Date.now()
): boolean[] {
  const days = new Set(sessions.map((s) => dayKey(s.completedAt)));

  const cursor = new Date(now);
  cursor.setDate(cursor.getDate() - weekdayIndex(now));

  const week: boolean[] = [];
  for (let i = 0; i < 7; i += 1) {
    week.push(days.has(dayKey(cursor.getTime())));
    cursor.setDate(cursor.getDate() + 1);
  }
  return week;
}

/**
 * The last `count` days, oldest first, the final entry being today.
 *
 * The sibling of `weekSat` rather than a generalisation of it, and both are
 * wanted because they say different things. A week is a thing with names — the
 * row has weekday letters under it and it begins on Monday whatever today is,
 * so its edges are the calendar's and not yours. A window has no names and no
 * edges: it is a month of texture that always ends where you are standing.
 * Writing either in terms of the other gives something that reads as neither.
 */
export function recentDays(
  sessions: readonly Session[],
  count: number,
  now: number = Date.now()
): boolean[] {
  const days = new Set(sessions.map((s) => dayKey(s.completedAt)));

  const cursor = new Date(now);
  cursor.setDate(cursor.getDate() - (count - 1));

  const window: boolean[] = [];
  for (let i = 0; i < count; i += 1) {
    window.push(days.has(dayKey(cursor.getTime())));
    cursor.setDate(cursor.getDate() + 1);
  }
  return window;
}

/** Distinct days on which the user sat. A gentler number than total sessions. */
export function daysSat(sessions: readonly Session[]): number {
  return new Set(sessions.map((s) => dayKey(s.completedAt))).size;
}

/** Total time actually sat, in milliseconds. */
export function totalSatMs(sessions: readonly Session[]): number {
  return sessions.reduce((sum, s) => sum + s.durationMs, 0);
}
