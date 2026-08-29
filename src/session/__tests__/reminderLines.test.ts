import { REMINDER_BODIES, REMINDER_TITLE, reminderBody } from '../reminderLines';

const DAY = 86_400_000;
/** A fixed local noon, so day-boundary arithmetic is never ambiguous. */
const NOON = new Date(2026, 6, 28, 12, 0, 0).getTime();

/** The line for the day `daysOn` after the fixed noon. */
function on(daysOn: number): string {
  return reminderBody(NOON + daysOn * DAY);
}

describe('reminderBody', () => {
  it('gives the same line all day', () => {
    // The reminder is rescheduled on every return to the foreground. Opening
    // the app three times before breakfast must not queue three sentences.
    const morning = new Date(2026, 6, 28, 6, 15).getTime();
    const night = new Date(2026, 6, 28, 23, 45).getTime();

    expect(reminderBody(morning)).toBe(reminderBody(NOON));
    expect(reminderBody(night)).toBe(reminderBody(NOON));
  });

  it('turns over at 04:00, with the small hours still on the day before', () => {
    const afterMidnight = new Date(2026, 6, 29, 0, 0, 30).getTime();
    const beforeFour = new Date(2026, 6, 29, 3, 59, 30).getTime();
    const afterFour = new Date(2026, 6, 29, 4, 0, 30).getTime();

    // Not that they must differ — six lines and two days will collide often
    // enough — only that the day is what is being asked, and that it is the
    // app's day rather than the clock's. Rescheduling at one in the morning
    // must not queue tomorrow's line for tonight.
    expect(reminderBody(afterMidnight)).toBe(reminderBody(NOON));
    expect(reminderBody(beforeFour)).toBe(reminderBody(NOON));
    expect(reminderBody(afterFour)).toBe(on(1));
  });

  it('only ever answers with a line from the table', () => {
    for (let d = 0; d < 400; d++) {
      expect(REMINDER_BODIES).toContain(on(d));
    }
  });

  it('reaches every line from wherever it is picked up', () => {
    // Days are drawn independently, so no short window is guaranteed to hold
    // all six — measured across eight hundred starting days the slowest took
    // 38, and a season is the round number safely past that. What this rules
    // out is a line the arithmetic can never reach at all.
    for (const start of [0, 97, 366, 589]) {
      const seen = new Set<string>();
      for (let d = 0; d < 90; d++) seen.add(on(start + d));
      expect(seen.size).toBe(REMINDER_BODIES.length);
    }
  });

  it('does not favour one line over a year', () => {
    const table: readonly string[] = REMINDER_BODIES;
    const counts = table.map(() => 0);
    for (let d = 0; d < 365; d++) counts[table.indexOf(on(d))] += 1;

    // An even share is 61. Loose bounds on purpose: this is asking whether the
    // hash scatters at all, not that it is a shuffled deck, which it is not.
    for (const n of counts) expect(n).toBeGreaterThan(30);
    for (const n of counts) expect(n).toBeLessThan(110);
  });

  it('does not walk the table in order', () => {
    // `hash32`'s last act leaves consecutive keys a fixed distance apart, so
    // slicing it unscrambled would step through the lines like a rota — a
    // rotation that is really a cycle, and visible as one within a week.
    const table: readonly string[] = REMINDER_BODIES;
    const week = [0, 1, 2, 3, 4, 5, 6].map((d) => table.indexOf(on(d)));
    const steps = new Set(week.slice(1).map((v, i) => v - week[i]));
    expect(steps.size).toBeGreaterThan(1);
  });

  it('repeats a given day forever, so a reminder is never re-picked', () => {
    expect(reminderBody(NOON)).toBe(reminderBody(NOON + 1));
    expect(on(365)).toBe(reminderBody(NOON + 365 * DAY));
  });
});

describe('the reminder copy', () => {
  const lines = [REMINDER_TITLE, ...REMINDER_BODIES];

  it('never raises its voice', () => {
    for (const line of lines) expect(line).not.toContain('!');
  });

  it('never mentions what you did not do', () => {
    // The app has no failure state, and a notification is the one place it
    // speaks to someone who is not looking at it. Guilt would go unanswered.
    for (const line of lines) {
      expect(line.toLowerCase()).not.toMatch(
        /streak|missed|forgot|haven't|didn't|don't forget|still|again today/
      );
    }
  });

  it('keeps them short enough for a lock screen', () => {
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(60);
  });
});
