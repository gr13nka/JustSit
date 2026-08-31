/**
 * The garden's entrance: the shape of one doodle growing, and where in the
 * burst each slot's plant starts.
 *
 * Kept free of react, react-native and svg imports — the `field.ts` and
 * `sway.ts` precedent — and here the reason is sharper than checking the
 * numbers without a renderer. This table is read by *two* renderers now.
 * `Sprout` in `motion.tsx` hands it to `Animated.interpolate` on a phone;
 * `keyframes.ts` hands the same rows to the browser as CSS. A curve that lived
 * inside either one would be a curve the other had to copy, and a copy of an
 * animation is a second animation however carefully it is transcribed.
 *
 * It is `sway.ts`'s missing sibling. The pair is the whole of the garden's
 * motion said once: one pure module per thing that moves, with the arithmetic
 * out where both renderers can read it and neither owns it.
 *
 * Tuned in `tools/anim-lab.html`, which is where the next pass should happen
 * too: the settle is the hard part of a curve to judge, and at this size it is
 * invisible in the app until you have already committed it.
 */

import { hash32 } from '../domain/hash';

/** How long one doodle takes to grow and stop wobbling. */
export const SPROUT_MS = 1000;
/** The window the whole field's delays are scattered across. */
export const BURST_SPREAD_MS = 450;
/** The whole entrance, from the first plant starting to the last one settling. */
export const BURST_MS = BURST_SPREAD_MS + SPROUT_MS;

/** One row of the curve: how far through the growth, and what it looks like there. */
export type Frame = {
  at: number;
  opacity: number;
  scaleY: number;
  scaleX: number;
};

/**
 * The shape of one sprout, frame by frame: `at` is how far through the growth
 * this frame sits, and the rest is what the doodle looks like there.
 *
 * Written as frames rather than three parallel arrays because the character is
 * in how the channels disagree at a given moment, and that is unreadable when
 * they are spelled out separately.
 *
 * It is squash and stretch, which is why `scaleX` and `scaleY` are never at
 * their extremes together: the doodle shoots past full height while still
 * pinched narrow, then swings back under it as it widens, then settles. A pop
 * where both go fat at once reads as a bubble rather than as something growing.
 *
 * What keeps that true however loud it gets is the *area*: every row below
 * multiplies out to within a few percent of 1, so the doodle only ever changes
 * shape, never mass. Widen `scaleX` to agree with the stretch and the character
 * is gone whatever the numbers say. `sprout.test.ts` holds both properties,
 * which for a long time were only claimed here.
 *
 * The shoot up is fast and everything after it is the plant wobbling to a stop
 * — an overshoot of nearly two thirds, then a third, then a sixth, each swing
 * about half the one before, which is what a damped spring does and what makes
 * it read as jelly rather than as a bounce. The rise takes an eighth of the
 * window and the six swings share the rest, so the wobble slows as it dies.
 */
export const GROWTH: readonly Frame[] = [
  { at: 0, opacity: 0, scaleY: 0.05, scaleX: 0.7 },
  { at: 0.12, opacity: 1, scaleY: 1.63, scaleX: 0.64 },
  { at: 0.27, opacity: 1, scaleY: 0.69, scaleX: 1.53 },
  { at: 0.41, opacity: 1, scaleY: 1.16, scaleX: 0.91 },
  { at: 0.56, opacity: 1, scaleY: 0.92, scaleX: 1.14 },
  { at: 0.71, opacity: 1, scaleY: 1.04, scaleX: 1.01 },
  { at: 0.85, opacity: 1, scaleY: 0.98, scaleX: 1.07 },
  { at: 1, opacity: 1, scaleY: 1, scaleX: 1 },
];

/**
 * The tallest a sprout ever gets, for whoever has to leave room for it. Read
 * off the curve rather than written down twice: a louder pop that quietly
 * outgrew the space reserved for it is exactly the bug this prevents.
 */
export const SPROUT_PEAK = Math.max(...GROWTH.map((frame) => frame.scaleY));

/** The three things a sprout animates, named so a renderer can walk them. */
export type Channel = 'opacity' | 'scaleY' | 'scaleX';

/**
 * Where in the burst one slot's plant starts growing.
 *
 * Seeded rather than random, for the same reason the dot's offset is: this
 * garden should scatter the same way every time it is shown. A field that
 * re-rolled its timings on every visit would be a different drawing each time,
 * and nothing in this app is generated at runtime.
 *
 * The seed string is frozen along with `hash32` itself, and it is the one place
 * in the app that slices bits off a key without scrambling them first. That is
 * deliberate: `scramble` exists for seeds that must look random, and these must
 * merely keep answering the same forever — every garden already on a phone
 * would re-scatter its start times the day either of them changed. `hash32`'s
 * ramp in the top bits is harmless when the modulus is a spread of milliseconds
 * nobody can name.
 */
export function burstDelay(slot: number): number {
  return hash32(`burst-${slot}`) % BURST_SPREAD_MS;
}
