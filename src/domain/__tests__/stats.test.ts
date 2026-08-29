import { Session } from '../../store/types';
import {
  bestStreak,
  currentStreak,
  dayKey,
  daysSat,
  recentDays,
  satToday,
  totalSatMs,
  weekdayIndex,
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

describe('dayKey', () => {
  it('holds one day from four in the morning until four the next', () => {
    const evening = new Date(2026, 6, 27, 22, 0).getTime();
    const lastMinute = new Date(2026, 6, 28, 3, 59).getTime();
    const firstMinute = new Date(2026, 6, 28, 4, 0).getTime();

    // Both sides of the boundary, because either one on its own would also
    // pass against a day that never turned over at all.
    expect(dayKey(lastMinute)).toBe(dayKey(evening));
    expect(dayKey(firstMinute)).not.toBe(dayKey(evening));
  });

  it('names the day a late sitting belongs to, not the date it is written on', () => {
    // Half past one on the 28th is the 27th's evening, and the key says so.
    expect(dayKey(new Date(2026, 6, 28, 1, 30).getTime())).toBe(
      dayKey(new Date(2026, 6, 27, 12, 0).getTime())
    );
  });
});

describe('weekdayIndex', () => {
  it('puts Monday first and Sunday last', () => {
    expect(weekdayIndex(new Date(2026, 6, 27, 12, 0).getTime())).toBe(0); // Mon 27th
    expect(weekdayIndex(NOON)).toBe(1); // Tue 28th
    expect(weekdayIndex(new Date(2026, 7, 2, 12, 0).getTime())).toBe(6); // Sun 2nd
  });

  it('stays in Sunday on a Monday that has only just started', () => {
    // The one hour of the week where the calendar day and the logical day fall
    // in different weeks — and where reading the calendar day would put the
    // week row and the column marking today a whole week apart.
    expect(weekdayIndex(new Date(2026, 6, 27, 2, 0).getTime())).toBe(6);
  });
});

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

  it('treats a sitting either side of midnight as one late night', () => {
    // Half past eleven and half past twelve are one evening to the person who
    // sat them, so the second is a second sitting on the same day rather than
    // a day of its own — the run is one, not two.
    const beforeMidnight = new Date(2026, 6, 27, 23, 30).getTime();
    const afterMidnight = new Date(2026, 6, 28, 0, 30).getTime();
    const s = [
      { ...satOn(0), id: 'a', completedAt: beforeMidnight },
      { ...satOn(0), id: 'b', completedAt: afterMidnight },
    ];
    expect(currentStreak(s, NOON)).toBe(1);
  });

  it('lets a sitting after midnight carry the day that is ending', () => {
    // Sunday, Monday, and then one o'clock on Tuesday morning — which is
    // Monday still, so it is a second sitting on a day already counted and the
    // run stays at two. The alternative reading would hand out a third day for
    // staying up.
    const s = [
      satOn(2), // Sunday 26th, midday
      satOn(1), // Monday 27th, midday
      { ...satOn(0), id: 'late', completedAt: new Date(2026, 6, 28, 1, 0).getTime() },
    ];
    expect(currentStreak(s, new Date(2026, 6, 28, 1, 30).getTime())).toBe(2);
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

  it('turns over at 04:00, not at midnight', () => {
    // Every instant here is built with the local `Date` constructor, so the
    // boundary being asked about is the local one and the zone the suite
    // happens to run in never enters it. A day counted on UTC's clock would
    // put these four somewhere else entirely, and in a different place in
    // every zone.
    const lastNight = new Date(2026, 6, 27, 23, 59, 30).getTime();
    const afterMidnight = new Date(2026, 6, 28, 0, 0, 30).getTime();
    const beforeFour = new Date(2026, 6, 28, 3, 59, 30).getTime();
    const afterFour = new Date(2026, 6, 28, 4, 0, 30).getTime();
    const satLastNight = [{ ...satOn(0), completedAt: lastNight }];

    // Midnight goes past and the sitting is still today's, because the day it
    // was sat in has not ended yet.
    expect(satToday(satLastNight, lastNight)).toBe(true);
    expect(satToday(satLastNight, afterMidnight)).toBe(true);
    expect(satToday(satLastNight, beforeFour)).toBe(true);

    // Four o'clock is where it stops being today's, and where a sitting from
    // the small hours starts being it.
    expect(satToday(satLastNight, afterFour)).toBe(false);
    expect(satToday([{ ...satOn(0), completedAt: afterFour }], afterFour)).toBe(true);
  });
});

/**
 * The changeover days, and why the arithmetic has to be a calendar's.
 *
 * 8 March 2026 is the spring-forward across North America — 02:00 becomes
 * 03:00, so that local day is 23 hours long — and the northern autumn puts a
 * 25-hour one the other way. In a zone that keeps no daylight saving these are
 * four ordinary dates and the tests are quiet rather than wrong, which is why
 * they assert a property that holds in any zone: a run is counted in calendar
 * days and never in fixed lumps of milliseconds. Pinning the 23-hour gap itself
 * would need the suite pinned to a zone, and a test that only means something
 * in one timezone is a test that stops meaning anything on somebody's laptop.
 */
describe('the day boundary across a clock change', () => {
  const changeover = [6, 7, 8, 9].map((date) => ({
    ...satOn(0),
    id: `mar-${date}`,
    completedAt: new Date(2026, 2, date, 22, 0).getTime(),
  }));

  it('counts a run straight through it, however long those days were', () => {
    const evening = new Date(2026, 2, 9, 23, 0).getTime();
    expect(currentStreak(changeover, evening)).toBe(4);
    expect(bestStreak(changeover)).toBe(4);
  });

  it('still gives the small hours after it to the evening before', () => {
    // One in the morning on the 9th, the night the clocks moved under it.
    expect(dayKey(new Date(2026, 2, 9, 1, 0).getTime())).toBe(
      dayKey(new Date(2026, 2, 8, 22, 0).getTime())
    );
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

  it('does not slide a day when the app is opened early on a Monday', () => {
    // Two in the morning on Monday the 27th is Sunday the 26th still, so the
    // week to draw is the one that ends with it, not the one the calendar has
    // already started. Taking the rotation off the calendar date slides the row
    // by a day in the small hours of any morning; on a Monday it slides it
    // clear of the week altogether, drawing Sunday to Saturday under letters
    // reading M to S. Four hours out of a hundred and sixty-eight, wrong in all
    // four of them.
    const earlyMonday = new Date(2026, 6, 27, 2, 0).getTime();
    const week = weekSat([satOn(1), satOn(2)], earlyMonday);
    expect(week).toEqual([
      false, // Mon 20th
      false, // Tue 21st
      false, // Wed 22nd
      false, // Thu 23rd
      false, // Fri 24th
      false, // Sat 25th
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
