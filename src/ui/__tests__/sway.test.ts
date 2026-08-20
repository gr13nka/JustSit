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
   * The one that would have caught the original twitch, restated.
   *
   * A stem is at its fastest passing through upright and stops only at the two
   * extremes. `sin(a + b·sin a)` gets that exactly backwards as b approaches 1:
   * its speed carries a factor that vanishes at the halfway crossing, so the
   * plant halts dead at upright and starts again. The Möbius warp each layer is
   * built on cannot do that at any setting.
   *
   * It is asserted as a *sustained* stillness rather than a single slow sample,
   * because the sum of three layers is allowed to crawl through upright when
   * they happen to cancel — that is the wind dropping, and it is wanted. What is
   * never allowed is stopping: a genuine stall shows as a flat run at the same
   * phase every turn. The worst run here is two knots, a third of a second.
   */
  it('never comes to a sustained standstill', () => {
    for (const leans of field()) {
      let run = 0;
      for (let i = 1; i < leans.length; i++) {
        run = Math.abs(leans[i] - leans[i - 1]) < 0.02 ? run + 1 : 0;
        expect(run).toBeLessThan(6);
      }
    }
  });

  /**
   * The point of the layers, and the thing a single oscillation could not do.
   *
   * The rates are pairwise coprime, so the only moment all three line up again
   * is the end of the turn. If someone gives two of them a common factor — 16
   * and 10 both carry a 2 — the garden starts repeating inside its own turn,
   * and it does so silently: every other property here still passes.
   */
  it('does not repeat inside its own turn', () => {
    for (const leans of field()) {
      const knots = leans.length - 1;
      for (const divisor of [2, 3, 4, 5, 8]) {
        const shift = Math.round(knots / divisor);
        let worst = 0;
        for (let i = 0; i < knots; i++) {
          worst = Math.max(worst, Math.abs(leans[i] - leans[(i + shift) % knots]));
        }
        expect(worst).toBeGreaterThan(SWAY_LEAN_DEG / 4);
      }
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
