/**
 * The arithmetic of a card being held: what it does under a finger, what it
 * costs to pull it far enough that it leaves, and what leaving looks like on
 * the way out.
 *
 * Kept free of react, react-native and svg imports — the `ring.ts`, `field.ts`,
 * `offerRow.ts` and `sway.ts` precedent — because everything this file decides
 * is a property of the numbers and none of it wants a renderer standing by to
 * be checked. The two that matter are that leaving is one monotone decision
 * rather than two rules that can disagree, and that the range handed to
 * `Animated.interpolate` is strictly increasing whatever the layout underneath
 * happened to measure.
 *
 * It is named for the thing rather than for the mechanism, the way `sway` is:
 * `sway` is what a plant does when nothing is happening, and this is what a
 * card does while it is held. What drives it — a pan responder, a pointer, a
 * mouse in a browser — is the caller's business and appears nowhere below.
 *
 * The physics is ported from the Tactile Design demos' `engine/`, whose whole
 * argument is that a gesture reads as physical when the object is exactly under
 * the finger and everything that *can* lag without lying — the lift, the shade,
 * the settle — is what carries the weight. The springs and the resistance curve
 * are that engine's, verbatim, with their critical-damping annotations intact.
 */

/**
 * A spring, in the terms `Animated.spring` takes them.
 *
 * Critical damping is `2·√(k·m)`. Below it the spring overshoots and rings; at
 * or above it it eases in and stops. The character of every preset below is
 * entirely how far under critical its damping sits — which is why the numbers
 * are annotated with that figure rather than with an adjective.
 */
export type Spring = { stiffness: number; damping: number; mass: number };

export type SpringName = 'SNAP' | 'SETTLE' | 'GLIDE' | 'ENTER' | 'SHUT';

/**
 * The presets, taken whole rather than picked over.
 *
 * A carry spends two of them, and **they have to stay two**. The return home
 * is `SETTLE`: a card coming back to a place you can watch it arrive at, which
 * wants the ring, because the ring is what says the card was thrown rather than
 * placed. The exit is `GLIDE`: a card leaving for good over a whole screen
 * height, where nothing is going to be watched settling and what matters is
 * that the departure is continuous with the throw that started it. The demos'
 * own warning is that unifying such a pair to simplify it brings back the bug
 * the pair was introduced to fix — motion is asymmetric on purpose, and a door
 * thrown open does not come back the way it went.
 *
 * The other three are vocabulary, on `tokens.ts`'s precedent for its unspent
 * radii: kept whole so that a screen wanting a new motion reaches for a named
 * step instead of inventing a stiffness. `ENTER` is a sheet coming toward you
 * with a little weight behind it and then a stop, `SHUT` is the thing that
 * meets a frame, `SNAP` is the one that arrives without any give at all.
 */
export const SPRING = {
  /** 41 critical — arrives flat. */
  SNAP: { stiffness: 420, damping: 40, mass: 1 },
  /** 32 critical — overshoots. */
  SETTLE: { stiffness: 260, damping: 18, mass: 1 },
  /** 28 critical — a hair of give. */
  GLIDE: { stiffness: 200, damping: 26, mass: 1 },
  /** 24 critical — some weight. */
  ENTER: { stiffness: 150, damping: 21, mass: 1 },
  /** 28 critical — no overshoot. */
  SHUT: { stiffness: 140, damping: 30, mass: 1.4 },
} as const satisfies Record<SpringName, Spring>;

/**
 * The same spring for somebody who has asked for less motion.
 *
 * Reduced motion is **no ringing, not no movement**. A card that teleports off
 * the screen is not a calmer thing than a card that leaves; it is an unreadable
 * one, because you lose what moved and where it went. What provokes discomfort
 * is the overshoot and the oscillation, so the spring is stiffened and pushed a
 * little past critical: direction and cause survive, the wobble does not.
 *
 * A transform rather than a second table, so there is no preset that can be
 * added later and silently opt out of it.
 */
export function stiffened(spring: Spring): Spring {
  const mass = spring.mass;
  const stiffness = spring.stiffness * REDUCED_STIFFEN;
  return { stiffness, damping: 2 * Math.sqrt(stiffness * mass) * REDUCED_ZETA, mass };
}

/* ---------------------------------------------------------------------------
   The tuning block.

   Everything from here to the end of the section is provisional and is meant to
   be replaced as a block. Amount is the one thing a browser is dishonest about
   — it draws a 411px phone half again too wide and reads it at desk distance —
   and every number below is an amount: how far, how fast, how much. They are
   settled in the hand on a bench page, the `anim-lab.html` and
   `note-card-mockup.html` precedent, and pasted back here. **If the bench and
   this block ever disagree, the bench is the authority.**

   What is not provisional is the shape of what they feed: the resistance curve,
   the presets, and the fact that leaving is one decision. Those are pinned by
   the test and are not knobs.
--------------------------------------------------------------------------- */

/**
 * How far a finger may travel before a press becomes a carry.
 *
 * The demos' figure, kept rather than re-judged. It is small because the card
 * has nothing else it could mean: there is no scroll inside it to compete with
 * and no long-press. If either ever arrives this has to rise, because a card
 * that starts moving five points into a swipe is a card that cannot be
 * scrolled.
 */
export const GRAB_SLOP = 5;

/**
 * How far the card lifts on contact, before it has been asked to go anywhere.
 *
 * The answer to being touched, and the whole of the difference between a card
 * that is held and a card that is merely being dragged across. It is a fraction
 * rather than a distance because what reads it is `SHADE`, which runs 0 to 1.
 */
export const LIFT_PRESS = 0.35;

/** And how far it lifts once it is actually being carried. */
export const LIFT_CARRY = 1;

/**
 * How much of the running velocity survives each new sample.
 *
 * An exponential moving average rather than the last sample's delta: one
 * jittery frame at the release must not throw the card off the screen, and a
 * real flick still has to arrive intact. Those two pull opposite ways and this
 * is where the trade is set.
 */
export const SMOOTHING = 0.68;

/**
 * How long a finger may rest before its throw is gone.
 *
 * A pointer that stopped before it lifted has no throw in it, whatever the
 * smoothed average still says — the average decays over samples, and a finger
 * that has stopped moving stops producing them. Without this a card put down
 * carefully leaves at the speed it was travelling a third of a second ago.
 */
export const STALE_MS = 90;

/**
 * How much of the finger's speed the spring is handed at the release.
 *
 * Not all of it, because fingers are faster than paper. Release hands the
 * pointer's own velocity to the spring rather than starting a fresh animation
 * from rest — that is what makes a card let go mid-flick keep travelling and
 * arc rather than stop and then start again — and this is the damping on that
 * handoff. The caller multiplies `Animated.spring`'s `velocity` by it.
 */
export const THROW_DAMPING = 0.55;

/**
 * How far ahead of the finger the throw is read, when deciding whether the card
 * is leaving.
 *
 * It is what makes distance and speed one decision instead of two: a flick is
 * simply travel the card has not made yet.
 */
export const PROJECTION_MS = 120;

/**
 * The scale of the resistance when nobody has said what is being resisted.
 *
 * Every caller here has something better to offer — a card knows its own height
 * — so this is the demos' number kept as a default rather than as a value
 * anything relies on.
 */
const RUBBER_DIMENSION = 260;

/** How much of the pull survives at the very start of it, before it falls away. */
const RUBBER_GIVE = 0.55;

/** What share of the card's height has to be travelled before it lets go. */
const THRESHOLD_SHARE = 0.3;

/**
 * And the floor and the ceiling on that share, which are the whole reason this
 * is a function rather than a multiplication.
 *
 * Two very different cards share one rule. The writing card is 3:4 and floated
 * in the middle of the screen; the reading card hugs the thought on it and
 * docks at the foot. A two-line reader is about ninety points tall, and a share
 * taken freely would ask it for eleven points of travel, which is not a gesture
 * — it is a card that comes off in your hand. The ceiling is the same argument
 * from the other end: the tallest card the app can draw must not ask for a
 * quarter of the shortest screen it can be drawn on.
 */
const THRESHOLD_MIN = 56;
const THRESHOLD_MAX = 120;

/**
 * How far back the card has to come before it stops being armed.
 *
 * A latch with no hysteresis chatters: a finger holding at the threshold
 * crosses it a dozen times a second, and every crossing is a tick under the
 * thumb. One crossing should be one tick, and this is the gap that makes it so.
 *
 * A share, floored — the same shape as `threshold` itself, and for the same
 * reason. As a share alone the band is 18% of the threshold, which is ample on
 * the 3:4 writing card and thin on a docked reader, whose threshold is pinned
 * at `THRESHOLD_MIN`: 10pt, against a `GRAB_SLOP` of 5. That is a band twice
 * the distance this app already calls "a hand not meaning anything by it",
 * where the tall card gets nearly four times it — so a thumb wavering under two
 * millimetres on the shortest card would tick again, and only on that card.
 * Measured rather than guessed: driving the real `armed` through slow passes
 * across the mark, the writing card holds one tick out to ±18pt of wander and
 * the reader broke up at ±10.
 *
 * The floor is written against `GRAB_SLOP` rather than as a number of its own,
 * because the question both are answering is the same one — how far a hand
 * moves without meaning anything by it.
 */
const ARM_KEEP = 0.82;
const ARM_KEEP_MIN = GRAB_SLOP * 3.5;

/**
 * How much of the veil is left by the time the card has been carried far enough
 * to leave.
 *
 * The veil is what says a small thing is being done on top of something else,
 * so it may not simply track the drag — the screen behind would come back
 * before the card had gone anywhere. It thins a little across the carry, which
 * is the app saying what leaving will look like, and then goes with the card.
 */
const VEIL_HOLD = 0.82;

/** How much stiffer a spring gets when the wobble has to come out of it. */
const REDUCED_STIFFEN = 1.6;

/** And how far past critical it is then pushed, so that it cannot ring at all. */
const REDUCED_ZETA = 1.05;

/* --- the gesture ---------------------------------------------------------- */

/**
 * Resistance past a boundary: the further you pull, the less you get.
 *
 * The edge is *felt* rather than announced. A hard stop tells you where the
 * edge is by refusing, which reads as the app having stopped listening; this
 * goes on answering the whole way and simply answers less, so the edge arrives
 * as a property of the paper rather than as a rule.
 *
 * It is bounded by its own dimension — pull to infinity and the card moves
 * `dimension` and no further — which is what makes the upward pull safe to
 * leave un-clamped anywhere else.
 */
export function rubber(over: number, dimension: number = RUBBER_DIMENSION): number {
  return (over * dimension * RUBBER_GIVE) / (dimension + Math.abs(over) * RUBBER_GIVE);
}

/**
 * How far the card is actually drawn from home, given how far the finger has
 * gone.
 *
 * Down is free and exactly free: a carried card sits under the finger, and a
 * card that lags behind reads as latency however carefully the lag is tuned.
 * Once the object stops being where you put it you stop believing you are
 * holding it, and no amount of weight elsewhere buys that back.
 *
 * Up is resisted, because up is not a direction this gesture has anything to
 * offer in. The card's own height is the dimension, so the resistance is
 * proportional to the thing being resisted and a card can never be pulled
 * further up than it is tall — a small card lifted hard stays a small card
 * lifted a little.
 */
export function drawnTravel(dy: number, height: number): number {
  return dy >= 0 ? dy : rubber(dy, height);
}

/**
 * How far the card has to be carried before it lets go.
 *
 * A share of the card's own height, floored and capped — see `THRESHOLD_MIN`
 * for why the clamp is the point of the function. It is one rule shared by
 * `leaves` and `armed`, which is what stops the mark that says "this is far
 * enough" from being drawn anywhere but where far enough actually is.
 */
export function threshold(height: number): number {
  return Math.min(THRESHOLD_MAX, Math.max(THRESHOLD_MIN, height * THRESHOLD_SHARE));
}

/** The running velocity, one sample on. */
export function smooth(previous: number, sample: number): number {
  return previous * SMOOTHING + sample * (1 - SMOOTHING);
}

/**
 * The throw the release hands on, in **pixels per second**, from a velocity in
 * **pixels per millisecond**.
 *
 * The factor of a thousand is the whole of this function and is exactly the
 * kind of thing that ships wrong: it is invisible, it is plausible in either
 * direction, and a card thrown a thousand times too slowly looks like a card
 * that was not thrown. Both ends were read off the installed source rather than
 * remembered.
 *
 * `PanResponder` writes `gestureState.vy = (nextDY - gestureState.dy) / dt`
 * where `dt` is a difference of touch timestamps in milliseconds
 * (`react-native/Libraries/Interaction/PanResponder.js`). `Animated.spring`
 * integrates on `deltaTime = (now - lastTime) / 1000` and uses `config.velocity`
 * against that clock (`Libraries/Animated/animations/SpringAnimation.js`), so
 * what it wants is pixels per second.
 *
 * A finger that stopped before it lifted has no throw in it, whatever the
 * smoothed average still says, so stillness past `STALE_MS` answers nothing at
 * all rather than a decayed something.
 */
export function throwSpeed(vy: number, sinceLastMoveMs: number): number {
  return sinceLastMoveMs > STALE_MS ? 0 : vy * 1000;
}

/**
 * Where the card would be if the throw were allowed to carry on, which is what
 * the leaving decision is actually made against.
 *
 * Distance and speed are one quantity here rather than two rules with an `||`
 * between them. Two rules can disagree — a tweak to either constant can make
 * the pair non-monotone, so that a card thrown *harder* stays — and it does so
 * silently, because both halves go on looking reasonable on their own.
 */
export function projected(travel: number, speed: number): number {
  return travel + (speed * PROJECTION_MS) / 1000;
}

/**
 * Whether the card is going, given where it is and how fast it was travelling.
 *
 * Monotone in both by construction: more travel never turns a leave into a
 * stay, and neither does more speed. And nothing here can be finished by
 * pushing the card away from you — up is negative in both terms, so however
 * hard it is flicked upward it only ever comes out further from leaving. The
 * card is the thing you keep.
 */
export function leaves(travel: number, speed: number, height: number): boolean {
  return projected(travel, speed) >= threshold(height);
}

/**
 * Whether the card has been carried far enough that letting go would send it —
 * the state the screen has to say out loud, by whatever mark it says it with.
 *
 * A latch rather than a comparison: it arms at the threshold and disarms a
 * little short of it, so a finger resting on the line arms once instead of
 * flickering. The previous answer is a parameter rather than state held here,
 * because a module with no react in it has nowhere honest to keep one and the
 * caller is already holding a gesture's worth of it.
 */
export function armed(travel: number, height: number, wasArmed: boolean): boolean {
  const far = threshold(height);
  if (travel >= far) return true;
  const band = Math.max(far * (1 - ARM_KEEP), ARM_KEEP_MIN);
  return wasArmed && travel >= far - band;
}

/* --- the shade ------------------------------------------------------------ */

/**
 * How far inside the card's own edge the shade's box sits, on every side.
 *
 * This is the whole mechanism, and it is worth understanding before any of the
 * numbers below make sense. A box shadow is **clipped to the outside of the box
 * casting it** — CSS says so and React Native follows — so the shadow is a ring
 * around a hole, and moving or growing that box moves the ring rather than
 * spreading it. A shade drawn on the card's own box and pushed down by its rise
 * therefore leaves a clean gap of exactly that rise between the card and its
 * own shadow, and one scaled up past the card leaves a rectangle floating out
 * in the paper. Both look like a second, wrong card rather than like a shadow,
 * and both are invisible in the arithmetic.
 *
 * Set the box *inside* the card instead and the hole is under the card, where
 * the card covers it: what is left is the shadow's own reach — `blur` plus
 * `spread` — coming out from under the edges. The card at rest hides it because
 * the reach is shorter than the inset, and the lift brings it out by growing
 * the box a little and dropping it.
 *
 * The reason this is a *distance* and not a share of the card is that it makes
 * the rest state's invisibility a fact about the shadow rather than about the
 * card. The two cards this sheet draws are 263 × 351 and about 331 × 130, and a
 * share of either is a very different number of points on the other — a scale
 * that hid the tall card left the short one wearing a halo. An inset in points
 * hides both at once, and it goes on hiding a card shorter than either: the
 * box shrinks a point for every point the card loses, so the clearance under it
 * grows rather than shrinks.
 *
 * The value is measured rather than judged. Screenshotting the resting card
 * against a card with no shade at all and comparing the two PNGs byte for byte,
 * a 28-point blur stops reaching past the edge at an inset of 31, at every card
 * shape and at every opacity in the table. This is that with a point in hand.
 */
export const SHADE_INSET = 32;

/**
 * And how soft it is. There is no spread: the reach is the blur alone, which is
 * what keeps `SHADE_INSET`'s guarantee a comparison between two numbers.
 *
 * It cannot be animated — React Native has no interpolatable blur — so the
 * spreading a rising shadow has to do is carried by `scale` instead, and this
 * is the one softness both ends of the lift are drawn at.
 */
export const SHADE_BLUR = 28;

/** One row of the lift: how far up the card is, and what is cast below it. */
export type Shade = {
  at: number;
  /** How dark the shade is drawn. */
  opacity: number;
  /** How much wider than the card it spreads. */
  scale: number;
  /** How far below the card it falls, in points, which is how far the card has risen. */
  rise: number;
};

/**
 * What is cast under a card as it is picked up, frame by frame.
 *
 * Frames rather than three parallel arrays, on `GROWTH`'s precedent: the
 * character is in how the channels disagree at a given moment, and that is
 * unreadable when they are spelled out separately. The disagreement here is
 * that the fall leads and the spread and the lightening follow — a shade
 * escapes from under a card as soon as the card is off the page, and that first
 * separation is most of what says it has been picked up, while the spreading
 * goes on for the rest of the lift.
 *
 * **The one thing this table must never get backwards is that a shade which
 * rises gets lighter and wider, not darker.** It spreads over more of the
 * surface and less of it is occluded from the fill. Getting that inverted is
 * the commonest way a lifted object reads as a sticker stuck on the picture
 * rather than as a thing standing above it, and it is invisible in a still
 * screenshot, which is why the test holds it rather than this paragraph.
 *
 * Two channels of the original are gone. **Blur cannot be animated in React
 * Native** at all, so what a widening blur would have said is carried by
 * `scale` and `rise` between them — see `SHADE_INSET` for why those two are
 * spending an inset rather than growing past the card. And the sideways offset
 * is gone because this card is carried straight down: a shade that slid
 * sideways would be a light source, and the app has never had one.
 *
 * `opacity` is the shade's whole ink, because the shadow itself is drawn in
 * `shadow` at full strength and this is what dims it. That is not tidiness: two
 * shadow layers of different alphas would want a colour mixed at the point of
 * use, and `themes.ts` is the only place in this app allowed to know what a
 * colour is made of.
 *
 * Five rows rather than the two the bench models, and the reason is the
 * disagreement. Two rows are a straight line in every channel at once, which is
 * a lift with no character; the frame table exists so the fall can lead and the
 * spread and the lightening follow it, and by the first row the drop has done
 * over a quarter of its travel against a sixth for the other two.
 *
 * The rest row reads as no shadow at all, and it does so by *geometry* rather
 * than by being faint: at `at: 0` the box has neither grown nor dropped, so its
 * reach stops short of the card's edge and the card covers all of it. That is
 * why the opacity is free to be at its darkest there, which is what the
 * invariant above wants, and why the rest state stays invisible at any ink
 * somebody later chooses.
 */
export const SHADE: readonly Shade[] = [
  { at: 0, opacity: 0.6, scale: 1, rise: 0 },
  { at: 0.18, opacity: 0.575, scale: 1.006, rise: 3.9 },
  { at: 0.45, opacity: 0.53, scale: 1.02, rise: 8.1 },
  { at: 0.75, opacity: 0.485, scale: 1.037, rise: 11.4 },
  { at: 1, opacity: 0.44, scale: 1.05, rise: 14 },
];

/* --- the veil ------------------------------------------------------------- */

/**
 * The veil's own track against how far the card has been carried: full where
 * the card sits, thinned by the time it is far enough to go, and gone by the
 * time it is.
 *
 * Handed back as an `Animated.interpolate` config rather than as a function,
 * because that is what keeps the whole thing on the native driver — a veil
 * computed in JavaScript is a React render per frame of a gesture, under the
 * thumb doing the gesturing.
 *
 * `exit` is measured layout — the screen's own height — and a stop that lands
 * on or before the one in front of it is what this function exists to prevent.
 * `interpolate` does not complain about a non-increasing input range; it
 * misbehaves quietly, which is the sort of thing that is right on one phone and
 * wrong on another. A screen asked for its height before it has been laid out
 * answers zero, and that is not a hypothetical.
 *
 * The caller passes `extrapolate: 'clamp'`, the way `Sprout` does. The default
 * is `extend` at both ends, and extending the left end would take the veil
 * *past* full while the card was being pulled upward.
 */
export function veilStops(
  veil: number,
  threshold: number,
  exit: number
): { inputRange: number[]; outputRange: number[] } {
  const held = Math.max(threshold, 1);
  const gone = Math.max(exit, held + 1);
  return {
    inputRange: [0, held, gone],
    outputRange: [veil, veil * VEIL_HOLD, 0],
  };
}
