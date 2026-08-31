/**
 * The garden's idle sway: what a plant does when nothing is happening.
 *
 * Kept free of react, react-native and svg imports — the `ring.ts` and
 * `field.ts` precedent — because the guarantees this module makes are ones you
 * want checked without a renderer standing by. The two that matter are that
 * the loop closes without a seam and that the motion never stops dead, and
 * both are properties of the numbers rather than of the animation.
 *
 * Tuned in `tools/anim-lab.html`'s Sway tab, which is where the next pass
 * should happen rather than here.
 */

import { hash32, scramble } from '../domain/hash';

/*
 * `scramble` — murmur3's finalizer over `hash32` — lives in `domain/hash.ts`,
 * because every seed sliced out of a key whose last character varies needs it
 * and this was not the only place that learned so the hard way. The reasoning
 * is written down there.
 */

/**
 * How long the one shared clock takes to come round — and so how long the
 * garden takes to repeat itself exactly.
 *
 * It used to be five seconds, which is short enough to watch the same gust
 * arrive twice and notice. The wind below is built so that lengthening this is
 * the whole lever: the layers are at rates that share no common factor, so the
 * only moment they all line up again is the end of the turn.
 */
export const SWAY_CYCLE_MS = 40000;

/**
 * How far the tip leans at its furthest.
 *
 * Chosen on a phone, not in the bench, and the difference was most of a factor
 * of two. At 5° a plant's tip travels 3pt, and measured off the device that came
 * to three pixels of movement across a whole row of plants — correct, smooth, and
 * invisible at arm's length. The bench draws its phone 411px wide on a desktop
 * monitor, which is half again the physical width of a 411dp screen and read at
 * desk distance, so an amplitude that looks right there is not.
 *
 * It is a hard bound rather than a target: `field.ts` sizes the cell so a plant
 * at full lean still fits, so `swayLeans` normalises every plant's loop to peak
 * here exactly. Nothing may lean further.
 */
export const SWAY_LEAN_DEG = 13;

/**
 * The wind, as layers.
 *
 * One oscillation and one gust envelope can only ever be a metronome: whatever
 * the shape, it arrives at the same strength at the same interval forever, and
 * over a long look that is what it reads as. Real wind is several things at
 * once, so this is several — a quick one that carries the motion, and slower,
 * weaker ones that push it around.
 *
 * `cycles` is per turn of the clock and the three are **pairwise coprime**,
 * which is the point rather than a detail. Any common factor would bring the
 * layers back into step early and the garden would repeat inside its own turn:
 * 16/10/6 all share a 2 and would repeat twice a turn. 16/11/7 line up only at
 * the end, so the repeat is the full forty seconds.
 *
 * The slower a layer, the broader it is — a long wave moves the whole garden
 * more or less together, a short one ripples through it — which is also what
 * keeps the fastest layer from reading as a stripe crossing the field.
 *
 * There is no separate gust any more. Three layers drifting in and out of phase
 * quieten and swell on their own, and unlike a cosine envelope they do not do
 * it on a schedule.
 */
const WINDS = [
  { cycles: 16, weight: 1.0, wavelength: 36, direction: 12 },
  { cycles: 11, weight: 0.5, wavelength: 52, direction: 20 },
  { cycles: 7, weight: 0.3, wavelength: 82, direction: 4 },
] as const;

/**
 * How many samples one plant's loop is stored as.
 *
 * The table is straight lines between them, so every knot is a corner in the
 * velocity, and what sets the count is the *fastest* layer: at 16 cycles a turn
 * this is ten samples per oscillation. A sine sampled that coarsely and joined
 * with straight lines is off by about 5% of its own amplitude, and that layer
 * is a little over half of the total, so the error lands near a third of a
 * degree — a fifth of a point at the tip, which is under a device pixel.
 *
 * It is also 108 tables built on mount, so this is a cost as well as a fidelity
 * setting: every extra knot is another 216 numbers formatted into another 216
 * strings before the garden can draw.
 */
const SWAY_KNOTS = 160;

/**
 * How unevenly each layer travels its cycle — fast through upright one way,
 * slow the other, so a gust reads as a push and a drift instead of a pendulum.
 *
 * The warp is a Möbius map of the circle, and the reason is its derivative: the
 * Poisson kernel `(1 − k²)/(1 − 2k·cos a + k²)`, which is strictly positive for
 * every `k < 1`. However hard the asymmetry is pushed, the plant never comes to
 * a standstill.
 *
 * The obvious formulation does stop. Written as `sin(a + b·sin a)` the speed
 * carries a factor `(1 + b·cos a)` that is exactly zero at `a = π` when
 * `b = 1`: the plant halts dead at upright, hangs there and starts again, and
 * decelerating in and accelerating out reads as two twitches either side of the
 * middle.
 */
const SWAY_SHAPE = 0.36;

/**
 * How the lean is spent between bending the stem and pivoting the whole plant.
 *
 * 1 is pure shear — the root stays put and the tip travels furthest, which is
 * what a stem in wind does. 0 turns the plant rigidly about its root. They
 * displace the tip equally at these angles, so this is a true blend, and half
 * of each reads better than either alone.
 */
const SWAY_BEND = 0.5;

/**
 * How much of each layer's phase comes from where a plant stands rather than
 * from its own seed. 0 is a hundred and eight plants each on their own clock;
 * 1 is one wind crossing the field. Between blends them, and between is what
 * reads as weather rather than as either a chorus line or a crowd.
 *
 * It wants to be higher with layers than it did with one wind. Each layer
 * carries its own share of the seeded half, so three of them dilute it: at 0.68
 * — which read as wind when there was a single layer — neighbours agreed with
 * each other only 4% more than plants at opposite ends of the garden, which is
 * not a wind at all. At 0.88 the separation is 34% and the field still spreads
 * some 14° across itself, so it is weather rather than a slab.
 */
const SWAY_COHERENCE = 0.88;

/**
 * Where in one layer's cycle the plant in a given slot is, as a fraction of a
 * turn.
 *
 * The seeded half is scrambled first — see `scramble` above for why neither end
 * of `hash32`'s word will do on its own. Each layer seeds off its own key, so
 * the layers are independent rather than three views of one number.
 */
function layerPhase(wind: (typeof WINDS)[number], layer: number, slot: number, col: number, row: number) {
  const th = (wind.direction * Math.PI) / 180;
  const along = (col * Math.cos(th) + row * Math.sin(th)) / wind.wavelength;
  /* One seed per plant, shared by every layer, not one per layer. A plant's
     personal offset is a fact about the plant — its stiffness, where it happens
     to stand — not three unrelated facts. Seeding each layer separately gave
     every plant three independent randoms, and summing three independent
     randoms averages the wind out of the field: neighbours stopped agreeing
     with each other any more than strangers did, which is the coherence the
     spatial term exists to provide. */
  const own = scramble(hash32(`sway-${slot}`)) / 4294967296;
  // Negative along the wind, so the crest travels with it rather than against.
  return -SWAY_COHERENCE * along + (1 - SWAY_COHERENCE) * own;
}

/** One layer's contribution at clock position `p`, in the range ±weight. */
function layerAt(wind: (typeof WINDS)[number], phase: number, p: number): number {
  const k = 0.65 * SWAY_SHAPE;
  const a = 2 * Math.PI * (wind.cycles * p + phase);
  const warped = a + 2 * Math.atan2(k * Math.sin(a), 1 - k * Math.cos(a));
  return wind.weight * Math.sin(warped);
}

/**
 * One plant's whole loop, sampled: a lean in degrees at each of `SWAY_KNOTS`
 * even steps through a turn of the clock, ending exactly where it started.
 *
 * Normalised to peak at `SWAY_LEAN_DEG`. Three layers only rarely crest
 * together, so the raw sum wanders well under its own worst case and scaling by
 * that worst case is what keeps the typical lean worth looking at while
 * guaranteeing the bound `field.ts` sizes the cell against.
 */
export function swayLeans(slot: number, col: number, row: number): number[] {
  const phases = WINDS.map((wind, i) => layerPhase(wind, i, slot, col, row));

  const raw: number[] = [];
  for (let i = 0; i <= SWAY_KNOTS; i++) {
    const p = i / SWAY_KNOTS;
    let sum = 0;
    for (let w = 0; w < WINDS.length; w++) sum += layerAt(WINDS[w], phases[w], p);
    raw.push(sum);
  }

  const peak = Math.max(...raw.map(Math.abs));
  const scale = peak > 0 ? SWAY_LEAN_DEG / peak : 0;
  return raw.map((v) => v * scale);
}

/**
 * One plant's loop as an `Animated.interpolate` config, in degrees.
 *
 * Every array in it is **shared and must be treated as frozen** — see the cache
 * below. Two plants holding the same knot positions and one plant holding the
 * same track twice are both normal here, so a caller that wrote into one would
 * be rewriting somebody else's wind.
 */
export type SwayTrack = {
  /** Knot positions on the shared 0..1 clock. */
  at: number[];
  /** The shear, which leaves the root where it is. */
  skew: string[];
  /** The turn about the root, which does not. */
  spin: string[];
};

/**
 * Where the knots fall, which is the same answer for every plant in every
 * garden: `SWAY_KNOTS` even steps from 0 to 1.
 *
 * Only the leans differ from plant to plant, so a hundred and eight private
 * copies of one hundred and sixty-one numbers were a hundred and seven copies
 * of a fact. There is one, and every track points at it.
 */
const KNOTS_AT = Array.from({ length: SWAY_KNOTS + 1 }, (_, i) => i / SWAY_KNOTS);

/**
 * Every track asked for so far, by the plant and where it stands.
 *
 * A cache is honest here because there is nothing to invalidate: `swayTrack` is
 * a pure function of its three arguments, so a remembered answer and a freshly
 * built one are the same numbers, and remembering it costs the module none of
 * its independence — this is still a file that imports no react and can be
 * checked without a renderer standing by.
 *
 * What it buys is the case this module cannot see from here: a field that comes
 * down and goes back up. `PlantGrid` no longer takes its plants apart when the
 * tab loses focus, but the bed growing and the full-bed wrapper flipping still
 * replace the whole grid, and each of those used to re-sample a hundred and
 * eight loops from nothing — 161 knots across three warped layers, then 34,776
 * numbers formatted into strings — to arrive at the numbers already in hand.
 * Belt and braces beside the structural fix rather than a substitute for it.
 */
const TRACKS = new Map<string, SwayTrack>();

/**
 * What the renderer needs, so nothing above this line has to know about knots,
 * degrees or how the lean is split.
 *
 * The two channels are signed against each other because a positive shear and
 * a positive rotation lean opposite ways: with the origin at the root, CSS and
 * React Native both put the plant's ink at negative y, so `skewX` carries the
 * tip the other way from `rotate`.
 *
 * The track handed back is the same object every time it is asked for, and the
 * caller does not own it.
 */
export function swayTrack(slot: number, col: number, row: number): SwayTrack {
  const key = `${slot}:${col}:${row}`;
  const known = TRACKS.get(key);
  if (known) return known;

  const leans = swayLeans(slot, col, row);
  const track: SwayTrack = {
    at: KNOTS_AT,
    /* Rounded, because the full double prints twenty-odd characters of which
       about five carry meaning: a thousandth of a degree is six ten-thousandths
       of a point at the tip. 216 of these are built per plant and 108 plants
       per garden, so the formatting is a real share of the mount. */
    skew: leans.map((deg) => `${(-deg * SWAY_BEND).toFixed(3)}deg`),
    spin: leans.map((deg) => `${(deg * (1 - SWAY_BEND)).toFixed(3)}deg`),
  };

  TRACKS.set(key, track);
  return track;
}
