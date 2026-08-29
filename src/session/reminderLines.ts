import { hash32, scramble } from '../domain/hash';
import { dayKey } from '../domain/stats';

/**
 * What the daily reminder says, and which line it says today.
 *
 * Pure on purpose, and separate from `notifications.ts` for the reason the
 * whole app keeps its arithmetic away from its native modules: this is the
 * part worth testing, and it must not sit in a file that requires
 * `expo-notifications`.
 *
 * The voice is the app's — an invitation with nothing behind it. Nothing here
 * counts, congratulates, or notices that you did not come. A reminder that
 * mentioned a streak would be the app arguing against itself.
 */

/**
 * Fixed, while the body rotates.
 *
 * It is the line actually read on a locked phone, and it is already a question
 * rather than an instruction. Varying it too would make the same reminder look
 * like a different app each morning, which is a cost with nothing bought.
 */
export const REMINDER_TITLE = 'A few minutes?';

/**
 * Six ways of saying the same small thing.
 *
 * Enough that a reminder set for a year is not one automated sentence arriving
 * every day, few enough that they all had to earn their place. Every one of
 * them is true whether you sat yesterday or last month.
 */
export const REMINDER_BODIES = [
  'Your cushion is where you left it.',
  'A quiet few minutes, whenever suits.',
  'The breath is there whenever you turn to it.',
  'Somewhere to put your attention for a while.',
  'Sit for a few minutes, or sit for longer.',
  'The garden keeps its own time.',
] as const;

/**
 * The line for the day `now` falls in.
 *
 * By the day rather than at random, so that rescheduling — which happens on
 * every return to the foreground — cannot change its mind between one morning
 * and the same morning. Which day gets which line is arbitrary and stable.
 *
 * The day is `dayKey`'s, so the rotation turns over at 04:00 with everything
 * else: an app opened at one in the morning reschedules the line for the
 * evening that is ending, not for the day the clock has just started.
 *
 * `scramble` before slicing: the seeds differ only in their last characters,
 * and `hash32` alone leaves those bits a ramp rather than a scatter, so
 * consecutive days would walk the table in order. `hash.ts` has the full story.
 */
export function reminderBody(now: number = Date.now()): string {
  const i = scramble(hash32(`reminder-${dayKey(now)}`)) % REMINDER_BODIES.length;
  return REMINDER_BODIES[i];
}
