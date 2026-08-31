import { arrivalKeyframes, sproutKeyframes, swayKeyframes } from '../keyframes';
import { GROWTH } from '../sprout';
import { swayLeans, swayTrack } from '../sway';

/** Where the loop's knots start in a track — the lead-in is in front of them. */
const LOOP = 1;

/**
 * These are the guard against the platform split drifting.
 *
 * The garden's motion is written down once, in `sprout.ts` and `sway.ts`, and
 * read twice — by `Animated.interpolate` on a phone and by the browser as CSS.
 * Two readings of one table is a copy, and a copy is only a copy while nobody
 * edits it. Nothing in the build says so: `tsc` resolves `./plantMotion` to the
 * native file and never opens the web one, so a browser drawn a different wind
 * would compile perfectly cleanly and would be found, if at all, by someone
 * noticing that the preview looks wrong.
 *
 * So each test below asks the same question in a different place: is the
 * browser being handed the numbers the phone is handed?
 */

/** The numbers back out of a step's transform, which has to be a string. */
const scales = (transform: string) => {
  const parsed = transform.match(/^scaleY\((-?[\d.]+)\) scaleX\((-?[\d.]+)\)$/);
  expect(parsed).not.toBeNull();
  return { scaleY: Number(parsed![1]), scaleX: Number(parsed![2]) };
};

const angles = (transform: string) => {
  const parsed = transform.match(/^skewX\((-?[\d.]+)deg\) rotate\((-?[\d.]+)deg\)$/);
  expect(parsed).not.toBeNull();
  return { skew: parsed![1], spin: parsed![2] };
};

/** A stop's position on the clock, as the fraction it was written from. */
const at = (stop: string) => Number(stop.replace('%', '')) / 100;

describe('the sprout, as keyframes', () => {
  it('puts a stop exactly where the curve has a frame', () => {
    const stops = Object.keys(sproutKeyframes());

    expect(stops.length).toBe(GROWTH.length);
    GROWTH.forEach((frame, i) => expect(at(stops[i])).toBeCloseTo(frame.at, 9));
  });

  /**
   * And what the browser is told the doodle looks like there is what the phone
   * is told. Read back out of the string rather than compared against one built
   * the same way, so this measures the numbers rather than restating the
   * formatting.
   */
  it('draws each stop as the frame it came from', () => {
    const frames = sproutKeyframes();

    Object.keys(frames).forEach((stop, i) => {
      const step = frames[stop];
      expect(step.opacity).toBe(GROWTH[i].opacity);
      expect(scales(step.transform!)).toEqual({
        scaleY: GROWTH[i].scaleY,
        scaleX: GROWTH[i].scaleX,
      });
    });
  });

  /**
   * The whole garden is one CSS rule.
   *
   * Only the delay differs from plant to plant, and a delay is a property on
   * the element rather than a step in the curve — so a hundred and eight plants
   * ask for the same block. `react-native-web` hashes a keyframes object's
   * content into its identifier, which means identical content is already one
   * `@keyframes` rule; handing back the same object is simply the cheapest way
   * to be sure of it. Give a plant its own block and the sheet grows a rule per
   * cell, silently, with the garden still looking right.
   */
  it('hands every plant the same block', () => {
    expect(sproutKeyframes()).toBe(sproutKeyframes());
    expect(JSON.stringify(sproutKeyframes())).toBe(JSON.stringify(sproutKeyframes()));
  });
});

describe('the wind, as keyframes', () => {
  const SLOT = 7;
  const COL = 7;
  const ROW = 0;

  it('carries one stop per knot, at even steps through the clock', () => {
    const stops = Object.keys(swayKeyframes(SLOT, COL, ROW));
    const knots = swayLeans(SLOT, COL, ROW).length - 1;

    // Every knot survived: two stops rounding to one name would silently
    // collapse into a single step and cost the loop a corner.
    expect(stops.length).toBe(knots + 1);
    stops.forEach((stop, i) => expect(at(stop)).toBeCloseTo(i / knots, 9));
  });

  /**
   * The seam, from the browser's side. `sway.test.ts` pins that a plant's table
   * ends where it began; this is what says the last stop and the first are
   * therefore the same declaration, which is what lets the animation repeat for
   * ever without a jump at the wrap.
   */
  it('ends the turn exactly where it started it', () => {
    const frames = swayKeyframes(SLOT, COL, ROW);
    expect(frames['100%'].transform).toBe(frames['0%'].transform);
  });

  /**
   * The one that matters: the browser is asked for the same angles
   * `Animated.interpolate` is, split the same way between the shear and the
   * turn and rounded to the same three places. If these two ever part company,
   * the garden leans one way on a phone and another in a browser — and the
   * browser is where this app's layout is judged.
   */
  it('asks for the same lean the phone is given, to the same rounding', () => {
    const frames = swayKeyframes(SLOT, COL, ROW);
    const track = swayTrack(SLOT, COL, ROW);

    Object.keys(frames).forEach((stop, i) => {
      const { skew, spin } = angles(frames[stop].transform!);
      expect(`${skew}deg`).toBe(track.skew[LOOP + i]);
      expect(`${spin}deg`).toBe(track.spin[LOOP + i]);
    });
  });

  /**
   * And a plant's wind is its own, so unlike the sprout these really are a
   * hundred and eight blocks. Worth stating, because the two functions in this
   * file look alike and are opposite in exactly this respect.
   */
  it('gives plants standing elsewhere a different wind', () => {
    const here = JSON.stringify(swayKeyframes(SLOT, COL, ROW));
    const there = JSON.stringify(swayKeyframes(SLOT + 1, COL + 1, ROW));
    expect(here).not.toBe(there);
  });
});

describe('the wind arriving', () => {
  const SLOT = 7;
  const COL = 7;
  const ROW = 0;

  /**
   * It starts from upright, which is the whole of the bug this exists to fix.
   *
   * A plant used to be held at its loop's own first angle through the sprout
   * and the beat after it, and because the wind is coherent that stood most of
   * the field over at a median of nearly eight degrees — a garden that grew
   * crooked and then began to blow.
   */
  it('begins with the plant standing straight', () => {
    const arrival = arrivalKeyframes(SLOT, COL, ROW);
    const { skew, spin } = angles(arrival['0%'].transform!);

    expect(Number(skew)).toBe(0);
    expect(Number(spin)).toBe(0);
  });

  /**
   * The seam, and the one thing here that would look wrong in a browser while
   * every other test passed.
   *
   * A browser wears the ramp and then the loop, swapping one style for the
   * other partway through the second the plant is being picked up, so nothing
   * but this equality stops it jumping at the handover. The phone has the same
   * guarantee for free, because its ramp and its loop are two stretches of one
   * interpolation that share a knot — which is exactly why it is worth
   * asserting on the side that does not.
   */
  it('ends exactly where the loop starts', () => {
    const arrival = arrivalKeyframes(SLOT, COL, ROW);
    const loop = swayKeyframes(SLOT, COL, ROW);

    expect(arrival['100%'].transform).toBe(loop['0%'].transform);
  });

  /**
   * And it is that plant's own loop it hands over to, not some other plant's —
   * a lead-in built from a fixed angle would pass the test above for exactly
   * one plant in the garden.
   */
  it("ramps to the angle this plant's loop begins at", () => {
    const arrival = arrivalKeyframes(SLOT, COL, ROW);
    const track = swayTrack(SLOT, COL, ROW);
    const { skew, spin } = angles(arrival['100%'].transform!);

    expect(`${skew}deg`).toBe(track.skew[LOOP]);
    expect(`${spin}deg`).toBe(track.spin[LOOP]);
    expect(Number(skew)).not.toBe(0);
  });

  it('carries the lead-in in two stops and no more', () => {
    expect(Object.keys(arrivalKeyframes(SLOT, COL, ROW))).toEqual(['0%', '100%']);
  });
});
