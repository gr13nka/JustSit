/**
 * The garden's two motions written as CSS keyframes, for the browser.
 *
 * It exists because `react-native-web` has no native animated driver at all —
 * `TurboModuleRegistry.get()` answers null there, so every `Animated` value
 * falls back to the JavaScript path, and that path dispatches a React update
 * per animated view per frame. A hundred and eight leaning plants and a hundred
 * and eight sprouting ones is a couple of hundred renders a frame, each
 * invalidating an `<svg>` subtree; measured on a full bed it halved the frame
 * rate exactly for as long as the wind was blowing. Keyframes hand the whole
 * thing to the compositor and cost nothing per frame.
 *
 * Nothing here is a second animation. Both functions read the same tables the
 * phone reads — `GROWTH` from `sprout.ts`, `swayLeans` from `sway.ts` — and the
 * correspondences are exact rather than approximate: see `plantMotion.web.tsx`,
 * which writes down which CSS property stands in for which piece of
 * `Animated.interpolate`.
 *
 * Pure, on the `field.ts` precedent, and deliberately named without a `.web`
 * extension: it is web-only by who imports it, which is what lets jest check
 * that the two renderers are still being handed the same numbers.
 *
 * Two mechanical facts about `react-native-web` are built into what follows,
 * and both cost real time to rediscover:
 *
 * A keyframe *step* is compiled by `createDeclarationBlock` → `createReactDOMStyle`
 * and never goes through `preprocess`, which is the pass that turns React
 * Native's `transform: [{scaleY: …}]` array into a CSS string. So a transform
 * inside a step has to be written as a string here. The array form does not
 * fail; it stringifies to `[object Object]` and the rule is silently dropped.
 *
 * And `animationName` is rejected outright by RNW's style validator, which
 * deletes the property and suggests `animationKeyframes` instead — as it does
 * the shorthand `animation`, so only the long-form `animation*` properties may
 * be written. The keyframes object *is* the animation's name: RNW hashes its
 * content into an identifier, so two objects with the same content are one CSS
 * rule.
 *
 * **Both functions here hand back a bare block, and the caller passes it
 * straight to `animationKeyframes`.** The field is really a *list* of
 * animations — RNW's own `ActivityIndicator` writes `animationKeyframes: [{…}]`
 * — but `processKeyframesValue` wraps a non-array itself, so one animation is
 * spelled as one block and there is no array for either side to own. Worth
 * stating rather than leaving to be inferred: whichever side wrapped it, the
 * other would have to know, and a plant wearing a list of one is a wrapper that
 * carries nothing.
 */

import { GROWTH } from './sprout';
import { SWAY_BEND, swayLeans } from './sway';

/** A CSS keyframes block: percentage stops, and what the element looks like at each. */
export type Keyframes = Record<string, { transform?: string; opacity?: number }>;

/**
 * A stop's name.
 *
 * Rounded before printing because a percentage is a float and floats print
 * badly: `0.56 * 100` is `56.00000000000001`, which is valid CSS and an eyesore
 * in the inspector. Four places is far finer than any stop this app writes and
 * still leaves every one of them a whole number or a clean fraction.
 */
function stop(fraction: number): string {
  return `${Number((fraction * 100).toFixed(4))}%`;
}

/**
 * The burst, once for the whole garden.
 *
 * It is the *same* block for every plant, which is the point rather than a
 * happy accident: only the delay differs from slot to slot, and a delay is a
 * property on the element rather than a step in the curve. RNW hashes a
 * keyframes object's content into its identifier, so a hundred and eight plants
 * asking for this get one `@keyframes` rule between them.
 *
 * Built once and handed out. The caller must treat it as frozen — `sway.ts`'s
 * tracks make the same promise for the same reason.
 */
const SPROUT: Keyframes = Object.fromEntries(
  GROWTH.map((frame) => [
    stop(frame.at),
    {
      // The same two channels in the same order the phone applies them. Pure
      // scales commute, so the order is for the reader rather than the maths.
      transform: `scaleY(${frame.scaleY}) scaleX(${frame.scaleX})`,
      opacity: frame.opacity,
    },
  ])
);

export function sproutKeyframes(): Keyframes {
  return SPROUT;
}

/**
 * How a lean is spent between the shear and the turn, which is the one piece of
 * arithmetic both functions below share with `swayTrack`.
 *
 * The two channels are signed against each other because with the origin at the
 * root the plant's ink is at negative y, so `skewX` carries the tip the other
 * way from `rotate` — and the order matters here, unlike the sprout's, since a
 * shear and a rotation do not commute.
 *
 * Rounded to a thousandth of a degree for `swayTrack`'s reason — six
 * ten-thousandths of a point at the tip — and to the same three places, so that
 * a browser and a phone are asked for one wind rather than two that round
 * differently.
 */
function lean(deg: number): string {
  const skew = (-deg * SWAY_BEND).toFixed(3);
  const spin = (deg * (1 - SWAY_BEND)).toFixed(3);

  return `skewX(${skew}deg) rotate(${spin}deg)`;
}

/**
 * The wind picking one plant up: upright, then the angle its loop begins at.
 *
 * A browser cannot loop a sub-range of one animation, so the arrival that a
 * phone expresses as a negative stretch of the same clock has to be its own
 * block here. What keeps that from being a second animation is where it stops:
 * `swayLeans(...)[0]` is read rather than restated, so the ramp ends on exactly
 * the number the loop starts from — which is what lets the element be handed
 * from one block to the other without anything moving.
 *
 * Two stops and no more. The shape of the arrival is an ease, and an ease is a
 * timing function rather than a table — sampling it into knots here would be
 * describing a curve the browser already knows how to draw.
 */
export function arrivalKeyframes(slot: number, col: number, row: number): Keyframes {
  return {
    '0%': { transform: lean(0) },
    '100%': { transform: lean(swayLeans(slot, col, row)[0]) },
  };
}

/**
 * One plant's whole loop of wind, as stops on a turn of the clock.
 *
 * The lean is split between a shear and a turn about the root exactly as
 * `swayTrack` splits it for the phone, from the same `SWAY_BEND` and the same
 * `swayLeans`.
 *
 * The last stop is the first one over again, which is what lets the browser
 * repeat this forever without a seam. That is a property of the numbers rather
 * than of anything here: `sway.test.ts` pins it.
 *
 * This block is the loop alone. The ramp into it is `arrivalKeyframes` above,
 * and the two are kept apart because only one of them repeats — a browser wears
 * them one at a time and swaps once, where the phone runs both off one clock
 * with a knot at a negative position. Why one at a time rather than both at
 * once is a compositing finding and is written down in `plantMotion.web.tsx`.
 */
export function swayKeyframes(slot: number, col: number, row: number): Keyframes {
  const leans = swayLeans(slot, col, row);
  const knots = leans.length - 1;

  return Object.fromEntries(
    leans.map((deg, i) => [stop(i / knots), { transform: lean(deg) }])
  );
}
