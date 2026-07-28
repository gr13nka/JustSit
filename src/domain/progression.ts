import { Progress, Session } from '../store/types';
import { FINAL_STAGE, Stage, Tip } from './stages';

/**
 * Wallace's criterion for moving on is what your mind is doing, not how many
 * times you have sat. These thresholds don't decide anything — they only decide
 * when it is reasonable to *ask*. The user's answer decides.
 */
export const SESSIONS_TO_OFFER = 20;
export const DAYS_AT_STAGE_TO_OFFER = 21;
/** Declining should be respected, not nagged around. */
export const DAYS_BETWEEN_OFFERS = 14;

const DAY = 86_400_000;

function daysSince(ts: number, now: number): number {
  return (now - ts) / DAY;
}

export function sessionsAtStage(
  sessions: readonly Session[],
  stage: number
): number {
  return sessions.filter((s) => s.stage === stage).length;
}

/**
 * Whether to show the stage-readiness card after this session.
 *
 * Requires both a count and a stretch of calendar time: twenty sessions in one
 * frantic fortnight is not the same as twenty across three weeks, and the whole
 * design premise is that this happens slowly.
 */
export function shouldOfferAdvance(
  progress: Progress,
  sessions: readonly Session[],
  now: number = Date.now()
): boolean {
  if (progress.stage >= FINAL_STAGE) return false;
  // 0 means onboarding never finished, so the stage clock has not started.
  if (progress.stageStartedAt === 0) return false;

  if (sessionsAtStage(sessions, progress.stage) < SESSIONS_TO_OFFER) return false;
  if (daysSince(progress.stageStartedAt, now) < DAYS_AT_STAGE_TO_OFFER) return false;

  if (
    progress.lastOfferedAt !== null &&
    daysSince(progress.lastOfferedAt, now) < DAYS_BETWEEN_OFFERS
  ) {
    return false;
  }

  return true;
}

/**
 * The tip for the next sitting: the first one not yet seen, in the order it was
 * written. Teaching should move forward rather than shuffle.
 *
 * Once a stage's tips are exhausted — which happens, since a stage can last
 * months — they cycle in the same order rather than stopping. `wrapIndex` is
 * normally the number of sessions completed at this stage, so the cycling
 * advances by one per sitting instead of repeating the same tip forever.
 */
export function nextTip(
  stage: Stage,
  seenTipIds: readonly string[],
  wrapIndex: number
): Tip {
  const unseen = stage.tips.filter((t) => !seenTipIds.includes(t.id));
  if (unseen.length > 0) return unseen[0];

  const i = ((wrapIndex % stage.tips.length) + stage.tips.length) % stage.tips.length;
  return stage.tips[i];
}
