import { hash32, scramble } from './hash';
import { dayKey } from './stats';

/**
 * What the welcome screen says, and whether today is a day for one.
 *
 * It comes up once on the first open of a day: a line, and the run of days
 * standing behind it. Pure, and separate from the screen for the reason the
 * rest of the app keeps its arithmetic away from its rendering — this is the
 * part worth testing, and none of it needs a device to answer.
 *
 * **This is the one place the app congratulates anybody, and it is deliberate.**
 * The standing rule is that nothing here tells you that you did well. The
 * welcome screen is an agreed exception to it, scoped to this module and the
 * screen that reads it, and a later reader tidying praise out of the app should
 * leave this file alone. The rest of the voice is unchanged: no exclamation
 * marks, and not one word about a day you did not sit.
 *
 * **It is also the one thing here that is remembered rather than derived**,
 * which `shouldShowTip` in `progression.ts` argues against in as many words.
 * That argument is right where it stands. A tip comes before a *sitting*, and
 * sittings record themselves, so "has one been shown today" is already answered
 * by data the app keeps — a stored timestamp beside it would be a second answer
 * to the same question, and the two would part company the first time a sitting
 * was recorded without one. Opening the app is not a sitting. It is recorded
 * nowhere and leaves nothing to read it back off, so there is no derivation to
 * prefer: `settings.lastGreetedAt` has to be remembered or the question cannot
 * be asked at all.
 */

/**
 * Whether the welcome screen comes before the garden this time.
 *
 * By the day rather than by an interval, so a phone opened at half past
 * midnight and again at breakfast is one morning and not two. Which hour a day
 * begins at is `dayKey`'s to say and is inherited here rather than restated.
 *
 * `null` is never — the sentinel this codebase already uses for it — so a fresh
 * install is greeted, and so is an install upgrading from a build that had no
 * welcome screen to have shown.
 */
export function shouldGreet(
  lastGreetedAt: number | null,
  now: number = Date.now()
): boolean {
  return lastGreetedAt === null || dayKey(lastGreetedAt) !== dayKey(now);
}

/**
 * Six ways of saying come in.
 *
 * Enough that a year of mornings is not one automated sentence, few enough that
 * each had to earn its place. They differ from the reminder's in what they are
 * allowed to say — this one is read by somebody who has already opened the app,
 * so it may notice that they keep doing so. What none of them does is mention a
 * morning that went the other way.
 */
export const GREETING_LINES = [
  'You are doing well. Consistency is what does it.',
  'Good to see you. The cushion is ready.',
  'Keep going — the quiet minutes are the ones that count.',
  'You keep turning up, and that is the whole practice.',
  'Steady work. A few minutes is plenty.',
  'Come in, sit down, and let the day start after.',
] as const;

/**
 * The line for the day `now` falls in.
 *
 * By the day rather than at random, so the same morning always reads the same
 * however many times the screen is built. Which day gets which line is
 * arbitrary and stable.
 *
 * The seed is prefixed `greeting-` and the reminder's `reminder-`, so two
 * rotations of six over the same days cannot lock in step and read as one
 * voice saying two things.
 *
 * `scramble` before slicing: the seeds differ only in their last characters,
 * and `hash32` alone leaves those bits a ramp rather than a scatter, so
 * consecutive days would walk the table in order. `hash.ts` has the full story.
 */
export function greetingLine(now: number = Date.now()): string {
  const i = scramble(hash32(`greeting-${dayKey(now)}`)) % GREETING_LINES.length;
  return GREETING_LINES[i];
}
