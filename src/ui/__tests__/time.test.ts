import {
  formatDay,
  formatMonthRange,
  formatRemaining,
  formatRemainingMinutes,
  formatTotal,
  fromHhMm,
  toHhMm,
} from '../time';

describe('formatRemaining', () => {
  it('shows a whole starting duration exactly', () => {
    expect(formatRemaining(10 * 60_000)).toBe('10:00');
    expect(formatRemaining(5 * 60_000)).toBe('5:00');
  });

  it('pads seconds but not minutes', () => {
    expect(formatRemaining(65_000)).toBe('1:05');
  });

  it('rounds up, so the clock never reads 0:00 with time left', () => {
    // At 999ms the sitting is not over. A display stuck on 0:00 for a whole
    // second looks like the app has hung.
    expect(formatRemaining(999)).toBe('0:01');
    expect(formatRemaining(1)).toBe('0:01');
  });

  it('shows 0:00 only when genuinely finished', () => {
    expect(formatRemaining(0)).toBe('0:00');
  });

  it('handles durations past an hour without breaking', () => {
    expect(formatRemaining(3_600_000)).toBe('60:00');
  });
});

describe('formatRemainingMinutes', () => {
  it('shows a whole starting duration exactly', () => {
    expect(formatRemainingMinutes(2 * 60_000)).toBe('2');
    expect(formatRemainingMinutes(24 * 60_000)).toBe('24');
  });

  it('holds the higher number until the minute is genuinely spent', () => {
    // A "2" that becomes a "1" the instant you start would read as a bug, and
    // would also overstate how far along you are.
    expect(formatRemainingMinutes(2 * 60_000 - 1)).toBe('2');
    expect(formatRemainingMinutes(60_001)).toBe('2');
    expect(formatRemainingMinutes(60_000)).toBe('1');
  });

  it('stays on 1 through the whole final minute', () => {
    expect(formatRemainingMinutes(59_999)).toBe('1');
    expect(formatRemainingMinutes(1)).toBe('1');
  });

  it('shows 0 only when genuinely finished', () => {
    expect(formatRemainingMinutes(0)).toBe('0');
  });
});

describe('formatTotal', () => {
  it('omits hours below one', () => {
    expect(formatTotal(45 * 60_000)).toBe('45m');
  });

  it('splits hours and minutes', () => {
    expect(formatTotal((4 * 60 + 20) * 60_000)).toBe('4h 20m');
  });

  it('keeps a zero minute remainder rather than hiding it', () => {
    expect(formatTotal(2 * 3_600_000)).toBe('2h 0m');
  });

  it('rounds down, never flattering the total', () => {
    expect(formatTotal(59_999)).toBe('0m');
  });
});

describe('toHhMm / fromHhMm', () => {
  it('pads both halves', () => {
    const d = new Date(2026, 0, 1, 7, 5);
    expect(toHhMm(d)).toBe('07:05');
  });

  it('round-trips a reminder time', () => {
    expect(toHhMm(fromHhMm('19:45'))).toBe('19:45');
    expect(toHhMm(fromHhMm('00:00'))).toBe('00:00');
  });

  it('zeroes seconds so the reminder does not drift', () => {
    const d = fromHhMm('08:30');
    expect(d.getSeconds()).toBe(0);
    expect(d.getMilliseconds()).toBe(0);
  });
});

describe('formatMonthRange', () => {
  const at = (year: number, month: number, day: number) =>
    new Date(year, month, day).getTime();

  it('names one month when a garden began and ended inside it', () => {
    expect(formatMonthRange(at(2026, 1, 2), at(2026, 1, 26))).toBe('Feb');
  });

  it('spans the months a longer garden ran across', () => {
    expect(formatMonthRange(at(2026, 1, 2), at(2026, 2, 8))).toBe('Feb – Mar');
  });

  it('brings the year in only when the range crosses one', () => {
    // "Dec – Feb" reads backwards on its own, and this is the one line on the
    // shelf that says when a garden was.
    expect(formatMonthRange(at(2025, 11, 2), at(2026, 1, 8))).toBe('Dec 2025 – Feb 2026');
  });

  it('says nothing about how long it took', () => {
    // Deliberate: one sitting can grow two or three plants, so a garden's
    // length in days was never a fact about the garden.
    const short = formatMonthRange(at(2026, 1, 2), at(2026, 1, 3));
    const long = formatMonthRange(at(2026, 1, 1), at(2026, 1, 28));
    expect(short).toBe(long);
  });
});

describe('formatDay', () => {
  const at = (year: number, month: number, day: number) =>
    new Date(year, month, day, 9, 30).getTime();

  it('puts the day before the month', () => {
    expect(formatDay(at(2026, 2, 12))).toBe('12 Mar');
  });

  it('does not pad the day', () => {
    expect(formatDay(at(2026, 2, 5))).toBe('5 Mar');
  });

  it('says nothing about the year', () => {
    // A note is read against the others on the screen, and one old enough for
    // the year to matter is far enough down the page to be obviously old.
    expect(formatDay(at(2019, 0, 1))).toBe('1 Jan');
  });

  it('names months in English whatever the phone is set to', () => {
    // The fonts ship as Latin subsets; a month from the device locale would
    // come back as tofu on a Russian handset, and only on that handset.
    expect(formatDay(at(2026, 11, 24))).toBe('24 Dec');
  });
});
