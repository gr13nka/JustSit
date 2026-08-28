import { Session } from '../../store/types';
import {
  bestStreak,
  currentStreak,
  daysSat,
  recentDays,
  satToday,
  totalSatMs,
  weekSat,
} from '../stats';

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
    // Irrelevant here — these are questions about when someone sat, not what
    // grew — but it has to be something.
    plants: [{ key: 'grass', slot: daysAgo }],
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

describe('bestStreak', () => {
  it('is zero with an empty garden', () => {
    expect(bestStreak([])).toBe(0);
  });

  it('counts a single sitting as one', () => {
    expect(bestStreak([satOn(0)])).toBe(1);
  });

  it('keeps the longest past run after the current one breaks', () => {
    // Sat once today, and three days in a row a week ago. The current run is 1
    // and the best is 3 — which is the whole reason this exists: the week that
    // happened is not undone by the week that did not.
    const s = [satOn(0), satOn(6), satOn(7), satOn(8)];
    expect(currentStreak(s, NOON)).toBe(1);
    expect(bestStreak(s)).toBe(3);
  });

  it('is nothing more than the current streak when today holds the record', () => {
    // The two walk the days from opposite ends of the history, so agreeing on
    // this case is a property worth pinning rather than an obvious one.
    const s = [satOn(0), satOn(1), satOn(2), satOn(6), satOn(7)];
    expect(currentStreak(s, NOON)).toBe(3);
    expect(bestStreak(s)).toBe(3);
  });

  it('counts two sittings in one day as one day', () => {
    const twice = [satOn(0), { ...satOn(0), id: 'again' }, satOn(1)];
    expect(bestStreak(twice)).toBe(2);
  });

  it('does not care what order the sittings arrive in', () => {
    expect(bestStreak([satOn(7), satOn(0), satOn(6), satOn(8)])).toBe(3);
  });
});

describe('satToday', () => {
  it('is false with an empty garden', () => {
    expect(satToday([], NOON)).toBe(false);
  });

  it('is true once today has a completed sitting', () => {
    expect(satToday([satOn(0)], NOON)).toBe(true);
  });

  it('is false on a day not yet sat, however long the streak', () => {
    // The distinction from `currentStreak`, which is 2 here and stays 2 all
    // day. Green means something grew, and today nothing has.
    expect(satToday([satOn(1), satOn(2)], NOON)).toBe(false);
    expect(currentStreak([satOn(1), satOn(2)], NOON)).toBe(2);
  });

  it('finds a sitting from today among older ones in any order', () => {
    expect(satToday([satOn(4), satOn(0), satOn(2)], NOON)).toBe(true);
  });

  it('turns over at local midnight, not at UTC midnight', () => {
    const justBefore = new Date(2026, 6, 27, 23, 59, 30).getTime();
    const justAfter = new Date(2026, 6, 28, 0, 0, 30).getTime();
    const lateLastNight = [{ ...satOn(0), completedAt: justBefore }];

    // 30 seconds either side of the same local midnight: still yesterday's
    // sitting from today, and today's from the moment the day ticks over.
    expect(satToday(lateLastNight, justBefore)).toBe(true);
    expect(satToday(lateLastNight, justAfter)).toBe(false);
    expect(satToday([{ ...satOn(0), completedAt: justAfter }], justAfter)).toBe(true);
  });
});

describe('weekSat', () => {
  // NOON is Tuesday 28 July 2026, so the week it falls in runs Monday the 27th
  // to Sunday the 2nd of August.
  it('is seven days long and starts on Monday', () => {
    // satOn(2) is Sunday the 26th, which belongs to the week before and must
    // not appear in this one.
    const week = weekSat([satOn(0), satOn(1), satOn(2)], NOON);
    expect(week).toHaveLength(7);
    expect(week).toEqual([
      true, // Mon 27th
      true, // Tue 28th, today
      false, // Wed 29th
      false, // Thu 30th
      false, // Fri 31st
      false, // Sat 1st
      false, // Sun 2nd
    ]);
  });

  it('puts Sunday last rather than first when today is a Sunday', () => {
    // Where the naive `getDay()` bites: Sunday is 0, so an unrotated offset
    // would start the week on this very day and run it forward into August.
    const sunday = NOON - 2 * DAY; // Sunday 26 July 2026
    const week = weekSat([satOn(1), satOn(2), satOn(3)], sunday);
    expect(week).toEqual([
      false, // Mon 20th
      false, // Tue 21st
      false, // Wed 22nd
      false, // Thu 23rd
      false, // Fri 24th
      true, // Sat 25th
      true, // Sun 26th, today
    ]);
  });

  it('marks the rest of the week false rather than knowing it is still to come', () => {
    const week = weekSat([satOn(0), satOn(1)], NOON);
    expect(week.slice(2)).toEqual([false, false, false, false, false]);
  });

  it('is all false with an empty garden', () => {
    expect(weekSat([], NOON)).toEqual([false, false, false, false, false, false, false]);
  });
});

describe('recentDays', () => {
  it('is as long as it was asked for and ends on today', () => {
    const days = recentDays([satOn(0), satOn(27)], 28, NOON);
    expect(days).toHaveLength(28);
    expect(days[27]).toBe(true);
    expect(days[0]).toBe(true);
    expect(days.slice(1, 27)).toEqual(new Array(26).fill(false));
  });

  it('reads oldest first', () => {
    const days = recentDays([satOn(1)], 28, NOON);
    expect(days[26]).toBe(true);
    expect(days[27]).toBe(false);
  });

  it('agrees with satToday about the last day', () => {
    const sat = [satOn(0), satOn(3)];
    const notYet = [satOn(1), satOn(2)];
    expect(recentDays(sat, 28, NOON)[27]).toBe(satToday(sat, NOON));
    expect(recentDays(notYet, 28, NOON)[27]).toBe(satToday(notYet, NOON));
  });

  it('is all false with an empty garden', () => {
    expect(recentDays([], 28, NOON)).toEqual(new Array(28).fill(false));
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
