import { REMINDER_BODIES, reminderBody } from '../../session/reminderLines';
import { GREETING_LINES, greetingLine, shouldGreet } from '../greeting';

const DAY = 86_400_000;
/** A fixed local noon, so day-boundary arithmetic is never ambiguous. */
const NOON = new Date(2026, 6, 28, 12, 0, 0).getTime();

/** The line for the day `daysOn` after the fixed noon. */
function on(daysOn: number): string {
  return greetingLine(NOON + daysOn * DAY);
}

describe('greetingLine', () => {
  it('gives the same line all day', () => {
    // The screen is built once per open, but a phone picked up before work and
    // again after it is one morning. Both of these sit inside one day whichever
    // hour the app's day is taken to begin at — where that boundary falls is
    // `dayKey`'s question and is tested where it is answered.
    const morning = new Date(2026, 6, 28, 6, 15).getTime();
    const night = new Date(2026, 6, 28, 23, 45).getTime();

    expect(greetingLine(morning)).toBe(greetingLine(NOON));
    expect(greetingLine(night)).toBe(greetingLine(NOON));
  });

  it('does not read the same every morning', () => {
    // Not that any two given days differ — six lines over a fortnight collide
    // often — only that the day is genuinely what is being asked.
    const fortnight = new Set([...Array(14).keys()].map(on));
    expect(fortnight.size).toBeGreaterThan(1);
  });

  it('only ever answers with a line from the table', () => {
    for (let d = 0; d < 400; d++) {
      expect(GREETING_LINES).toContain(on(d));
    }
  });

  it('does not walk the table in order', () => {
    // `hash32`'s last act leaves consecutive keys a fixed distance apart, so
    // slicing it unscrambled would step through the lines like a rota — a
    // rotation that is really a cycle, and visible as one within a week.
    const table: readonly string[] = GREETING_LINES;
    const week = [0, 1, 2, 3, 4, 5, 6].map((d) => table.indexOf(on(d)));
    const steps = new Set(week.slice(1).map((v, i) => v - week[i]));
    expect(steps.size).toBeGreaterThan(1);
  });

  it('repeats a given day forever', () => {
    expect(greetingLine(NOON)).toBe(greetingLine(NOON + 1));
    expect(on(365)).toBe(greetingLine(NOON + 365 * DAY));
  });

  it('does not turn over in step with the reminder', () => {
    // Two rotations of six over the same days. The `greeting-` prefix is what
    // keeps them independent; seeded alike they would pick the same index every
    // morning, and the day's notification and the day's welcome would be one
    // voice saying the same thing in two places.
    const greetings: readonly string[] = GREETING_LINES;
    const reminders: readonly string[] = REMINDER_BODIES;

    const pairs = [...Array(30).keys()].map(
      (d) =>
        `${greetings.indexOf(on(d))}:${reminders.indexOf(
          reminderBody(NOON + d * DAY)
        )}`
    );

    // Locked in step, a month of days would only ever show six pairings.
    expect(new Set(pairs).size).toBeGreaterThan(GREETING_LINES.length);
  });
});

describe('shouldGreet', () => {
  it('greets an install that has never been greeted', () => {
    // Null is never, so this covers both a fresh install and one upgrading from
    // a build with no welcome screen to have shown.
    expect(shouldGreet(null, NOON)).toBe(true);
  });

  it('does not greet twice on one day', () => {
    const morning = new Date(2026, 6, 28, 6, 15).getTime();
    expect(shouldGreet(morning, NOON)).toBe(false);
  });

  it('greets again the next day', () => {
    expect(shouldGreet(NOON, NOON + DAY)).toBe(true);
  });
});

describe('the welcome copy', () => {
  it('never raises its voice', () => {
    for (const line of GREETING_LINES) expect(line).not.toContain('!');
  });

  it('never mentions what you did not do', () => {
    // The reminder bans approval as well, because it speaks to somebody who is
    // not looking at the app and cannot answer it. This screen is read by
    // somebody who has just opened it, and praise here is the deliberate,
    // scoped exception — so only the shaming half of that rule carries over.
    for (const line of GREETING_LINES) {
      expect(line.toLowerCase()).not.toMatch(/missed|forgot|didn't|still|again today/);
    }
  });

  it('keeps them short enough to be read on the way past', () => {
    for (const line of GREETING_LINES) expect(line.length).toBeLessThanOrEqual(60);
  });
});
