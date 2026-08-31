import { BURST_SPREAD_MS, burstDelay, GROWTH, SPROUT_PEAK } from '../sprout';

/**
 * The frames the doodle is actually drawn in.
 *
 * The first is the seed and is at opacity 0 — a pinched, invisible speck that
 * exists to give the curve somewhere to start. It is the one row the shape
 * rules below have nothing to say about, because there is no shape on the
 * screen to say it of.
 */
const DRAWN = GROWTH.filter((frame) => frame.opacity > 0);

describe('the sprout curve', () => {
  /**
   * The rule the whole table is built around, and until now the most
   * load-bearing thing in the burst that was only ever claimed in a comment.
   *
   * A doodle grows by changing shape, never by gaining mass: at every moment it
   * is as much ink as it will be at rest, squashed one way or stretched the
   * other. Let `scaleX` agree with the stretch instead of opposing it and the
   * frames still read as a plausible animation — it is simply a bubble
   * inflating, and the character is gone with nothing in the numbers to say so.
   *
   * A few percent, not a hair: the curve is generated from a spring in
   * `tools/anim-lab.html` where the area is a knob, and it is set a touch over 1
   * so the plant reads as *arriving* rather than as merely unfolding.
   */
  it('changes shape and never mass', () => {
    for (const frame of DRAWN) {
      expect(Math.abs(frame.scaleY * frame.scaleX - 1)).toBeLessThan(0.07);
    }
  });

  /**
   * The same rule stated as motion rather than as area, because this is the
   * half a reader can see. Every step of the curve widens what it shortens and
   * shortens what it widens; two channels swelling together in even one frame
   * is the pop reading as a bubble for that frame.
   */
  it('moves the two channels against each other, step for step', () => {
    for (let i = 1; i < GROWTH.length; i++) {
      const dy = GROWTH[i].scaleY - GROWTH[i - 1].scaleY;
      const dx = GROWTH[i].scaleX - GROWTH[i - 1].scaleX;
      expect(Math.sign(dy)).toBe(-Math.sign(dx));
    }
  });

  /**
   * And so neither channel is ever at its own extreme in the frame the other is
   * at its. The doodle shoots past full height while still pinched narrow, then
   * swings back under it at its widest — the two peaks are in different frames
   * and so are the two troughs.
   */
  it('never reaches both extremes in one frame', () => {
    const peak = (channel: 'scaleY' | 'scaleX', pick: (xs: number[]) => number) =>
      GROWTH.findIndex((frame) => frame[channel] === pick(GROWTH.map((f) => f[channel])));

    const most = (xs: number[]) => Math.max(...xs);
    const least = (xs: number[]) => Math.min(...xs);

    expect(peak('scaleY', most)).not.toBe(peak('scaleX', most));
    expect(peak('scaleY', least)).not.toBe(peak('scaleX', least));
  });

  /**
   * `field.ts` reserves room above the top row for exactly this number, so a
   * louder pop that quietly outgrew the space kept for it is the bug this
   * stops. It is read off the curve rather than written down, and the test is
   * what says the reading is the right one.
   */
  it('tells the field how far past full height it goes', () => {
    for (const frame of GROWTH) expect(frame.scaleY).toBeLessThanOrEqual(SPROUT_PEAK);
    expect(GROWTH.some((frame) => frame.scaleY === SPROUT_PEAK)).toBe(true);
  });
});

describe('where each plant starts', () => {
  it('scatters the whole field inside the window it was given', () => {
    for (let slot = 0; slot < 216; slot++) {
      const delay = burstDelay(slot);
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThan(BURST_SPREAD_MS);
    }
  });

  /**
   * Pinned, and the pinning is the point.
   *
   * These delays are the one thing in the app seeded off `hash32` without a
   * `scramble` first, because they must go on answering the same forever rather
   * than looking random: change the hash, the key, or the spread and every
   * garden already on a phone grows in to a different rhythm. Nobody would
   * report that as a bug and it would still be one, so it is written down here
   * where a change to any of the three has to be agreed to rather than noticed.
   */
  it('gives the same slots the same start times it always has', () => {
    expect(burstDelay(0)).toBe(244);
    expect(burstDelay(1)).toBe(63);
    expect(burstDelay(2)).toBe(332);
    expect(burstDelay(11)).toBe(310);
    expect(burstDelay(107)).toBe(304);
  });
});
