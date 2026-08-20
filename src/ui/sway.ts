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

import { hash32 } from '../domain/hash';

/**
 * A final avalanche over `hash32`, because FNV-1a on its own is not scrambled
 * enough to seed a phase with — in either half of the word.
 *
 * Its last act is `h = (h ^ c) * prime`, so two keys whose last character
 * differs by one come out differing by about `prime`. In the TOP bits that is a
 * near-monotone ramp; in the BOTTOM bits it is an arithmetic progression of
 * `prime mod 2^k` — for the low twelve bits, exactly 403/4096 per slot. Neither
 * is random. Taking the low bits was the first attempt at fixing this and it
 * only swapped one ramp for another: consecutive plants came out 35° apart in
 * phase, every time, which is a travelling wave dressed up as a seed and is
 * precisely what the phase is supposed to break up.
 *
 * This is murmur3's finalizer, whose whole job is that one flipped input bit
 * changes half the output bits. `hash32` itself stays frozen — the garden's
 * scatter and the burst's start times depend on it answering the same forever.
 */
function scramble(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * How long the one shared clock takes to come round.
 *
 * Everything below fits a whole number of times into it, which is what lets a
 * hundred and eight plants ride a single `Animated.Value`: each reads its own
 * window out of the same 0..1 ramp, and the ramp can restart at 0 without a
 * jump because every plant's table ends where it began.
 */
export const SWAY_CYCLE_MS = 5000;

/**
 * How far the tip leans at the top of a gust.
 *
 * Chosen on a phone, not in the bench, and the difference was most of a factor
 * of two. At 5° a plant's tip travels 3pt, and measured off the device that came
 * to three pixels of movement across a whole row of plants — correct, smooth, and
 * invisible at arm's length. The bench draws its phone 411px wide on a desktop
 * monitor, which is half again the physical width of a 411dp screen and read at
 * desk distance, so an amplitude that looks right there is not.
 */
export const SWAY_LEAN_DEG = 11;

/**
 * Sways per turn of the clock, and gusts per turn is always one. Both are whole
 * numbers so the loop closes by construction rather than by anyone checking —
 * the same trick that makes the burst's swings decay without being told to.
 */
const SWAY_CYCLES = 2;

/**
 * How many samples one plant's loop is stored as.
 *
 * The table is straight lines between them, so every knot is a corner in the
 * velocity, and the harder `SWAY_SHAPE` is pushed the fewer of them fall across
 * the fast crossing — which is where a corner shows. This is fidelity rather
 * than taste: at this shape the bench measures the worst corner at 0.6°/s,
 * which is generous, and the count was set against that number rather than by
 * eye.
 */
const SWAY_KNOTS = 96;

/**
 * How unevenly the cycle is travelled — fast through upright one way, slow the
 * other, so a gust reads as a push and a drift instead of as a pendulum.
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
 * middle. That dead spot is also where a table of straight lines shows its
 * corners worst, the flattest part of a curve being where they are largest
 * relative to the motion around them.
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
 * How much of the phase comes from where a plant stands rather than from its
 * own seed. 0 is a hundred and eight plants each on their own clock; 1 is one
 * wind crossing the field. Between blends them, and between is what reads as
 * weather rather than as either a chorus line or a crowd.
 */
const SWAY_COHERENCE = 0.68;

/**
 * How many cells apart two crests are.
 *
 * This has to be read against the size of the field, which is the thing that
 * caught us out. Twelve columns and nine rows measure a little over twelve
 * cells along the wind, so at a wavelength of 9 the garden held a whole wave —
 * corner to corner the phase spread 0.94 of a turn. A full wave standing in the
 * field does not read as wind. It reads as a boundary: half the plants leaning
 * one way, half the other, the join marching across and wrapping round once a
 * cycle, which is exactly the "sway one way and teleport back" it was reported
 * as. It was doing that at the old seven-second clock too, once every seven
 * seconds.
 *
 * Well longer than the field, and the garden leans together with a lag from one
 * corner to the other — one wind over one garden, which is the thing being
 * drawn. At 36 the spread is under a quarter turn.
 */
const SWAY_WAVELENGTH = 36;

/** Which way the gust travels, in degrees off horizontal. */
const SWAY_DIRECTION = 12;

/** How far the wind dies away between pulses. At 0 it never stops. */
const SWAY_GUST = 0.34;

/**
 * Where in its loop the plant in one slot is, as a fraction of a turn.
 *
 * The seeded half is scrambled first — see `scramble` above for why neither
 * end of `hash32`'s word will do on its own.
 */
function swayPhase(slot: number, col: number, row: number): number {
  const th = (SWAY_DIRECTION * Math.PI) / 180;
  const along = (col * Math.cos(th) + row * Math.sin(th)) / SWAY_WAVELENGTH;
  const own = scramble(hash32(`sway-${slot}`)) / 4294967296;
  // Negative along the wind, so the crest travels with it rather than against.
  return -SWAY_COHERENCE * along + (1 - SWAY_COHERENCE) * own;
}

/**
 * One plant's whole loop, sampled: a lean in degrees at each of `SWAY_KNOTS`
 * even steps through a turn of the clock, ending exactly where it started.
 */
export function swayLeans(slot: number, col: number, row: number): number[] {
  const phase = swayPhase(slot, col, row);
  const k = 0.65 * SWAY_SHAPE;

  const leans: number[] = [];
  for (let i = 0; i <= SWAY_KNOTS; i++) {
    const p = i / SWAY_KNOTS;
    const gust = 1 - SWAY_GUST + SWAY_GUST * (0.5 - 0.5 * Math.cos(2 * Math.PI * p));
    const a = 2 * Math.PI * (SWAY_CYCLES * p + phase);
    const warped = a + 2 * Math.atan2(k * Math.sin(a), 1 - k * Math.cos(a));
    leans.push(SWAY_LEAN_DEG * gust * Math.sin(warped));
  }
  return leans;
}

/** One plant's loop as an `Animated.interpolate` config, in degrees. */
export type SwayTrack = {
  /** Knot positions on the shared 0..1 clock. */
  at: number[];
  /** The shear, which leaves the root where it is. */
  skew: string[];
  /** The turn about the root, which does not. */
  spin: string[];
};

/**
 * What the renderer needs, so nothing above this line has to know about knots,
 * degrees or how the lean is split.
 *
 * The two channels are signed against each other because a positive shear and
 * a positive rotation lean opposite ways: with the origin at the root, CSS and
 * React Native both put the plant's ink at negative y, so `skewX` carries the
 * tip the other way from `rotate`.
 */
export function swayTrack(slot: number, col: number, row: number): SwayTrack {
  const leans = swayLeans(slot, col, row);
  return {
    at: leans.map((_, i) => i / SWAY_KNOTS),
    skew: leans.map((deg) => `${-deg * SWAY_BEND}deg`),
    spin: leans.map((deg) => `${deg * (1 - SWAY_BEND)}deg`),
  };
}
