import { DEV_CLOCK_MS, sittingClockMs } from '../devClock';

const TWENTY_MINUTES = 1_200_000;

describe('sittingClockMs', () => {
  it('runs the length the user chose when the mode is off', () => {
    expect(sittingClockMs(TWENTY_MINUTES, false)).toBe(TWENTY_MINUTES);
  });

  it('runs the short clock when the mode is on, whatever was chosen', () => {
    expect(sittingClockMs(TWENTY_MINUTES, true)).toBe(DEV_CLOCK_MS);
    expect(sittingClockMs(60_000, true)).toBe(DEV_CLOCK_MS);
  });
});
