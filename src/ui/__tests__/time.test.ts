import {
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
