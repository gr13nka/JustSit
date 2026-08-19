import { COLUMNS } from '../field';
import { SWAY_LEAN_DEG, swayLeans, swayTrack } from '../sway';

const PLOT = 108;
const col = (slot: number) => slot % COLUMNS;
const row = (slot: number) => Math.floor(slot / COLUMNS);
const field = () =>
  Array.from({ length: PLOT }, (_, slot) => swayLeans(slot, col(slot), row(slot)));

/** Every plant's lean at one moment, sampled off its stored table. */
const across = (knot: number) => field().map((leans) => leans[knot]);

describe('the sway loop', () => {
  it('ends exactly where it starts, so Animated.loop closes without a seam', () => {
    for (const leans of field()) {
      expect(leans[leans.length - 1]).toBeCloseTo(leans[0], 9);
    }
  });

  it('never leans further than it says it does', () => {
    for (const leans of field()) {
      for (const deg of leans) expect(Math.abs(deg)).toBeLessThanOrEqual(SWAY_LEAN_DEG + 1e-9);
    }
  });

  /**
   * The one that would have caught the twitch, and it is worth stating as the
   * property rather than as the formula.
   *
   * A stem is at its fastest passing through upright and stops only at the two
   * extremes. `sin(a + b·sin a)` gets that exactly backwards as b approaches 1:
   * its speed carries a factor that vanishes at the halfway crossing, so the
   * plant halts dead at upright and starts again, which reads as a pair of
   * jerks either side of the middle. The Möbius warp cannot, at any setting.
   *
   * Measured, the slowest crossing is 0.22 of the busiest step; the old warp at
   * the same amplitude gives 0.0001. A tenth sits between them with room on
   * both sides.
   */
  it('never comes to a standstill at upright', () => {
    for (const leans of field()) {
      const steps = leans.slice(1).map((deg, i) => Math.abs(deg - leans[i]));
      const busiest = Math.max(...steps);
      const crossings = steps.filter((_, i) => leans[i] === 0 || leans[i] * leans[i + 1] < 0);

      expect(crossings.length).toBeGreaterThan(0);
      expect(Math.min(...crossings)).toBeGreaterThan(busiest / 10);
    }
  });
});

describe('the wind', () => {
  /**
   * Coherence is the axis between a field of independent plants and one wind
   * crossing it. At the shipped setting it is mostly wind, so neighbours along
   * a row must agree far more than plants picked at random do — if this ever
   * inverts, the phase has stopped depending on where a plant stands.
   */
  it('makes neighbours agree more than strangers do', () => {
    const now = across(0);
    const neighbours = now
      .slice(1)
      .map((deg, i) => (col(i + 1) === 0 ? null : Math.abs(deg - now[i])))
      .filter((gap): gap is number => gap !== null);
    // Plants a prime number of slots apart, which the wavelength cannot flatter.
    const strangers = now.map((deg, i) => Math.abs(deg - now[(i + 37) % PLOT]));

    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean(neighbours)).toBeLessThan(mean(strangers));
  });

  /**
   * And it is not so coherent that the garden moves as one slab: the seeded
   * half of the phase has to survive. A field leaning in unison would make the
   * whole plot one shape rather than a hundred and eight drawings.
   */
  it('does not lean the whole field as one', () => {
    const now = across(0);
    expect(Math.max(...now) - Math.min(...now)).toBeGreaterThan(SWAY_LEAN_DEG);
  });
});

describe('the track handed to the renderer', () => {
  it('carries a knot position for every lean, in order, across the whole clock', () => {
    const track = swayTrack(0, 0, 0);
    expect(track.at.length).toBe(track.skew.length);
    expect(track.at.length).toBe(track.spin.length);
    expect(track.at[0]).toBe(0);
    expect(track.at[track.at.length - 1]).toBe(1);
    for (let i = 1; i < track.at.length; i++) expect(track.at[i]).toBeGreaterThan(track.at[i - 1]);
  });

  /**
   * The two channels lean the same way. With the origin at the root the plant's
   * ink is at negative y, so a positive shear carries the tip opposite to a
   * positive rotation — and getting that wrong makes them cancel instead of add,
   * which looks like a sway that is simply weaker than the number asks for.
   */
  it('signs the shear against the turn, so they add rather than cancel', () => {
    const deg = (s: string) => Number(s.replace('deg', ''));
    const track = swayTrack(5, 5, 0);
    const leans = swayLeans(5, 5, 0);
    const leaning = leans.findIndex((d) => Math.abs(d) > SWAY_LEAN_DEG / 2);

    expect(leaning).toBeGreaterThanOrEqual(0);
    expect(Math.sign(deg(track.skew[leaning]))).toBe(-Math.sign(deg(track.spin[leaning])));
  });
});
