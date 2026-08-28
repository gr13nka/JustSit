import { Progress, Session } from '../../store/types';
import {
  DAYS_AT_STAGE_TO_OFFER,
  DAYS_BETWEEN_OFFERS,
  nextTip,
  SESSIONS_TO_OFFER,
  sessionsAtStage,
  shouldOfferAdvance,
  shouldShowTip,
} from '../progression';
import { stageAt } from '../stages';

const DAY = 86_400_000;
const NOW = new Date(2026, 6, 28, 12, 0, 0).getTime();

function progress(patch: Partial<Progress> = {}): Progress {
  return {
    stage: 1,
    stageStartedAt: NOW - 30 * DAY,
    lastOfferedAt: null,
    seenTipIds: [],
    gardens: [3],
    ...patch,
  };
}

function sat(n: number, stage = 1): Session[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `s${stage}-${i}`,
    startedAt: NOW - (n - i) * DAY,
    durationMs: 600_000,
    completedAt: NOW - (n - i) * DAY + 600_000,
    stage,
    plants: [{ key: 'grass', slot: i }],
  }));
}

describe('sessionsAtStage', () => {
  it('counts only sessions sat at that stage', () => {
    const mixed = [...sat(3, 1), ...sat(5, 2)];
    expect(sessionsAtStage(mixed, 1)).toBe(3);
    expect(sessionsAtStage(mixed, 2)).toBe(5);
    expect(sessionsAtStage(mixed, 3)).toBe(0);
  });
});

describe('shouldOfferAdvance', () => {
  it('offers once both the count and the calendar time are met', () => {
    expect(shouldOfferAdvance(progress(), sat(SESSIONS_TO_OFFER), NOW)).toBe(true);
  });

  it('does not offer on session count alone', () => {
    // Twenty sessions, but crammed into a single week.
    const eager = progress({ stageStartedAt: NOW - 7 * DAY });
    expect(shouldOfferAdvance(eager, sat(SESSIONS_TO_OFFER), NOW)).toBe(false);
  });

  it('does not offer on elapsed time alone', () => {
    // Three weeks have passed, but almost nothing was sat.
    expect(shouldOfferAdvance(progress(), sat(3), NOW)).toBe(false);
  });

  it('is exact at the session boundary', () => {
    expect(shouldOfferAdvance(progress(), sat(SESSIONS_TO_OFFER - 1), NOW)).toBe(false);
    expect(shouldOfferAdvance(progress(), sat(SESSIONS_TO_OFFER), NOW)).toBe(true);
  });

  it('is exact at the calendar boundary', () => {
    const justShort = progress({
      stageStartedAt: NOW - (DAYS_AT_STAGE_TO_OFFER - 1) * DAY,
    });
    const justEnough = progress({
      stageStartedAt: NOW - DAYS_AT_STAGE_TO_OFFER * DAY,
    });
    expect(shouldOfferAdvance(justShort, sat(SESSIONS_TO_OFFER), NOW)).toBe(false);
    expect(shouldOfferAdvance(justEnough, sat(SESSIONS_TO_OFFER), NOW)).toBe(true);
  });

  it('stays quiet for a fortnight after being declined', () => {
    const declined = progress({ lastOfferedAt: NOW - 3 * DAY });
    expect(shouldOfferAdvance(declined, sat(SESSIONS_TO_OFFER), NOW)).toBe(false);
  });

  it('asks again once the fortnight has passed', () => {
    const declined = progress({ lastOfferedAt: NOW - DAYS_BETWEEN_OFFERS * DAY });
    expect(shouldOfferAdvance(declined, sat(SESSIONS_TO_OFFER), NOW)).toBe(true);
  });

  it('never offers past the final stage', () => {
    const done = progress({ stage: 10 });
    expect(shouldOfferAdvance(done, sat(SESSIONS_TO_OFFER, 10), NOW)).toBe(false);
  });

  it('never offers before onboarding has started the stage clock', () => {
    const fresh = progress({ stageStartedAt: 0 });
    expect(shouldOfferAdvance(fresh, sat(SESSIONS_TO_OFFER), NOW)).toBe(false);
  });

  it('counts only sessions at the current stage toward the threshold', () => {
    // Plenty of history, but almost none of it at the stage they are on now.
    const moved = progress({ stage: 2 });
    const history = [...sat(SESSIONS_TO_OFFER, 1), ...sat(2, 2)];
    expect(shouldOfferAdvance(moved, history, NOW)).toBe(false);
  });
});

describe('shouldShowTip', () => {
  it('says nothing before the very first sitting, which onboarding has just taught', () => {
    expect(shouldShowTip([], NOW)).toBe(false);
  });

  it('carries one idea into the day’s first sitting', () => {
    // sat() lands its newest sitting yesterday, so nothing has grown today.
    expect(shouldShowTip(sat(3), NOW)).toBe(true);
  });

  it('sends a second sitting on the same day straight to the bell', () => {
    const earlierToday = sat(3).map((s, i, all) =>
      i === all.length - 1 ? { ...s, completedAt: NOW - 2 * 3_600_000 } : s
    );
    expect(shouldShowTip(earlierToday, NOW)).toBe(false);
  });

  it('is the same after a long absence as after a day off', () => {
    const stale = sat(3).map((s) => ({ ...s, completedAt: s.completedAt - 90 * DAY }));
    expect(shouldShowTip(stale, NOW)).toBe(true);
  });
});

describe('nextTip', () => {
  const stage = stageAt(1);

  it('starts at the first tip', () => {
    expect(nextTip(stage, [], 0).id).toBe(stage.tips[0].id);
  });

  it('moves forward in written order as tips are seen', () => {
    expect(nextTip(stage, [stage.tips[0].id], 1).id).toBe(stage.tips[1].id);
    expect(nextTip(stage, stage.tips.slice(0, 5).map((t) => t.id), 5).id).toBe(
      stage.tips[5].id
    );
  });

  it('skips gaps rather than stopping at them', () => {
    // Second tip somehow already seen — take the first genuinely unseen one.
    expect(nextTip(stage, [stage.tips[0].id, stage.tips[1].id], 2).id).toBe(
      stage.tips[2].id
    );
  });

  it('cycles in order once every tip has been seen', () => {
    const all = stage.tips.map((t) => t.id);
    const n = stage.tips.length;
    expect(nextTip(stage, all, n).id).toBe(stage.tips[0].id);
    expect(nextTip(stage, all, n + 1).id).toBe(stage.tips[1].id);
    expect(nextTip(stage, all, n * 2).id).toBe(stage.tips[0].id);
  });

  it('never returns undefined for a negative wrap index', () => {
    const all = stage.tips.map((t) => t.id);
    expect(nextTip(stage, all, -1)).toBeDefined();
  });
});
