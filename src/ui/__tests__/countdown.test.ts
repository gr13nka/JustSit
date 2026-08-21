import { countdown } from '../countdown';

const ARMED = 1_700_000_000_000;

describe('countdown', () => {
  it('starts at the full wait, so the first frame reads the delay', () => {
    expect(countdown('Yes', ARMED, ARMED, 3)).toEqual({
      secondsLeft: 3,
      live: false,
      label: 'Yes · 3',
    });
  });

  it('counts down a second at a time', () => {
    const at = (ms: number) => countdown('Yes', ARMED, ARMED + ms, 3).label;

    expect(at(1000)).toBe('Yes · 2');
    expect(at(2000)).toBe('Yes · 1');
    expect(at(3000)).toBe('Yes');
  });

  it('never reads zero, because a count of nothing that still refuses looks broken', () => {
    // The last millisecond of the wait. Rounded down this would say "0" while
    // the button was still disabled.
    const last = countdown('Yes', ARMED, ARMED + 2999, 3);

    expect(last.secondsLeft).toBe(1);
    expect(last.live).toBe(false);
  });

  it('goes live exactly at the end of the wait, and not a tick before', () => {
    expect(countdown('Yes', ARMED, ARMED + 2999, 3).live).toBe(false);
    expect(countdown('Yes', ARMED, ARMED + 3000, 3).live).toBe(true);
  });

  it('drops the count once it is live, so the word stands on its own', () => {
    expect(countdown('Yes', ARMED, ARMED + 5000, 3).label).toBe('Yes');
  });

  it('stays live however long the question is left standing', () => {
    // A tick that overshot, or a screen that came back after a minute away.
    expect(countdown('Yes', ARMED, ARMED + 60_000, 3)).toEqual({
      secondsLeft: 0,
      live: true,
      label: 'Yes',
    });
  });

  it('reads a wait of no seconds as live at once', () => {
    expect(countdown('Yes', ARMED, ARMED, 0).live).toBe(true);
  });
});
