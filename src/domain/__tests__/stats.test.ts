import { Session } from '../../store/types';
import { currentStreak, daysSat, totalSatMs } from '../stats';

const DAY = 86_400_000;
/** A fixed local noon, so day-boundary arithmetic is never ambiguous. */
const NOON = new Date(2026, 6, 28, 12, 0, 0).getTime();

function satOn(daysAgo: number, durationMs = 600_000): Session {
  const at = NOON - daysAgo * DAY;
  return {
    id: `s${daysAgo}`,
    startedAt: at - durationMs,
    durationMs,
    completedAt: at,
    stage: 1,
    plant: 'grass',
    // Irrelevant here — these are questions about when someone sat, not where
    // the plant went — but it has to be something.
    slot: daysAgo,
  };
}

describe('currentStreak', () => {
  it('is zero with an empty garden', () => {
    expect(currentStreak([], NOON)).toBe(0);
  });

  it('counts today alone as one', () => {
    expect(currentStreak([satOn(0)], NOON)).toBe(1);
  });

  it('counts consecutive days back from today', () => {
    expect(currentStreak([satOn(0), satOn(1), satOn(2)], NOON)).toBe(3);
  });

  it('does not break just because today has no session yet', () => {
    // Sat yesterday and the day before; it is only 12:00 today. The streak is
    // alive until a whole day passes, not anxious from breakfast onwards.
    expect(currentStreak([satOn(1), satOn(2)], NOON)).toBe(2);
  });

  it('breaks once a full day has been missed', () => {
    expect(currentStreak([satOn(2), satOn(3)], NOON)).toBe(0);
  });

  it('stops at the gap rather than counting older runs', () => {
    expect(currentStreak([satOn(0), satOn(1), satOn(5), satOn(6)], NOON)).toBe(2);
  });

  it('counts two sessions in one day as one day', () => {
    const twice = [satOn(0), { ...satOn(0), id: 'again' }];
    expect(currentStreak(twice, NOON)).toBe(1);
  });

  it('treats late-night and early-morning as different days', () => {
    const lateLastNight = new Date(2026, 6, 27, 23, 30).getTime();
    const earlyToday = new Date(2026, 6, 28, 0, 30).getTime();
    const s = [
      { ...satOn(0), id: 'a', completedAt: lateLastNight },
      { ...satOn(0), id: 'b', completedAt: earlyToday },
    ];
    expect(currentStreak(s, NOON)).toBe(2);
  });
});

describe('daysSat', () => {
  it('collapses multiple sessions on one day', () => {
    expect(daysSat([satOn(0), { ...satOn(0), id: 'again' }, satOn(3)])).toBe(2);
  });
});

describe('totalSatMs', () => {
  it('sums the chosen durations', () => {
    expect(totalSatMs([satOn(0, 300_000), satOn(1, 600_000)])).toBe(900_000);
  });
});
