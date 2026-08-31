import { COLUMNS } from '../field';
import { SWAY_LEAD_SHARE, SWAY_LEAN_DEG, swayLeans, swayTrack } from '../sway';

/**
 * Where the loop's own knots begin in a track.
 *
 * The first entry is the lead-in — the wind picking a plant up out of upright —
 * so everything walking `swayLeans` beside a track is off by one. Named rather
 * than written as a bare 1, because a silent off-by-one here would compare a
 * plant's first lean against the arrival's nought and pass.
 */
const LOOP = 1;

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
    expect(track.at[LOOP]).toBe(0);
    expect(track.at[track.at.length - 1]).toBe(1);
    for (let i = 1; i < track.at.length; i++) expect(track.at[i]).toBeGreaterThan(track.at[i - 1]);
  });

  /**
   * The lead-in, which is the whole of how the wind arrives.
   *
   * A clock held at 0 stands every plant at its own phase-nought lean, and the
   * wind is coherent enough that most of the field leans the same way — so a
   * garden grew crooked and then began to blow. The fix is a stretch of clock
   * *before* the loop where the answer is upright, so the renderers can drive
   * from there to 0 and pick the plants up.
   *
   * Both halves are asserted because either alone would pass while being
   * useless: a knot that sits before the loop but carries a lean would tilt the
   * garden through the whole entrance, and a nought lean sitting at 0 would
   * simply overwrite the loop's first knot.
   */
  it('holds a plant upright before the loop begins', () => {
    const track = swayTrack(3, 3, 0);

    expect(track.at[0]).toBe(-SWAY_LEAD_SHARE);
    expect(track.at[0]).toBeLessThan(0);
    expect(Number(track.skew[0].replace('deg', ''))).toBe(0);
    expect(Number(track.spin[0].replace('deg', ''))).toBe(0);
  });

  /**
   * And it ramps to exactly where the loop starts, which is what makes the
   * handover seamless rather than nearly so. The renderers each drive the two
   * stretches separately — a phone as one clock crossing 0, a browser as two
   * animations meeting at a delay — so this is the number they have to agree on.
   */
  it('ends the lead-in on the angle the loop begins at', () => {
    const track = swayTrack(3, 3, 0);
    const leans = swayLeans(3, 3, 0);

    expect(track.skew[LOOP]).toBe(`${(-leans[0] * 0.5).toFixed(3)}deg`);
    expect(track.spin[LOOP]).toBe(`${(leans[0] * 0.5).toFixed(3)}deg`);
  });

  /**
   * The track is remembered, which is what makes a field that comes down and
   * goes back up cost nothing to put back. Asserted as identity rather than as
   * equality on purpose: the same numbers built twice would pass an equality
   * test and would be exactly the work the cache exists to skip.
   *
   * It is also the whole of the contract the other way round. Callers share
   * these arrays and none of them owns one, so a track has to be treated as
   * frozen — this is the test that says why.
   */
  it('hands back the same track every time, so a field that returns pays once', () => {
    expect(swayTrack(7, 7, 0)).toBe(swayTrack(7, 7, 0));
  });

  /**
   * And the knots are shared further still: only the leans differ from plant to
   * plant, so every track in every garden points at one array of positions.
   */
  it('shares one set of knot positions, at even steps through the clock', () => {
    const one = swayTrack(1, 1, 0);
    const other = swayTrack(2, 2, 0);

    expect(one.at).toBe(other.at);

    // The loop's own knots, past the lead-in: even steps from 0 to 1, which is
    // what lets one linear clock read every plant's table at the same rate.
    const knots = one.at.length - 1 - LOOP;
    for (let i = 0; i <= knots; i++) expect(one.at[LOOP + i]).toBe(i / knots);
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
    expect(Math.sign(deg(track.skew[LOOP + leaning]))).toBe(
      -Math.sign(deg(track.spin[LOOP + leaning]))
    );
  });
});
