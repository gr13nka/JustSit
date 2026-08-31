import { ReactNode, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing } from 'react-native';

import { ROOT_ORIGIN } from './field';
import { Sprout, useBurst } from './motion';
import { burstDelay } from './sprout';
import {
  SWAY_CYCLE_MS,
  SWAY_HOLD_MS,
  SWAY_LEAD_MS,
  SWAY_LEAD_SHARE,
  swayTrack,
} from './sway';

/**
 * How a plant moves on a phone: the clocks the garden runs on, and the wrappers
 * that read them.
 *
 * This file has a `.web.tsx` twin, on the `webInsets.tsx` precedent, and the
 * two are one interface with two implementations — `Animated` here, CSS
 * keyframes there, because `react-native-web` has no native driver and would
 * re-render every plant on every frame. Metro picks by extension, so no part of
 * the web file reaches a device and no part of this one reaches a browser.
 *
 * **`tsc` does not check the two against each other.** It resolves
 * `./plantMotion` to this file and never opens the other, so a prop-shape drift
 * compiles perfectly clean and shows up only in a browser. `GardenMotion` is
 * deliberately opaque — each side's own business, never destructured by the
 * caller — and `useGardenMotion` and `PlantMotion` take exactly the same
 * arguments on both sides. Keep it that way by hand; nothing else will.
 */

/**
 * Everything a plant needs in order to move, held by the grid and read by each
 * cell. What is inside it is this file's business and nobody else's — the web
 * twin puts entirely different things here.
 */
export type GardenMotion = {
  /** The shared entrance clock, or null on a field that is only being drawn. */
  burst: Animated.Value | null;
  /** The shared wind clock, or null on a field that is not in the wind at all. */
  sway: Animated.Value | null;
};

/**
 * The garden's idle sway: one clock for the whole field, and the whole of the
 * wind's arrival on it.
 *
 * A hundred and eight looping drivers is not a thing to do, so there is one
 * ramp and each `Sway` reads its own window out of it — the same arrangement as
 * the burst, for the same reason.
 *
 * The clock runs from `-SWAY_LEAD_SHARE`, not from 0, and the negative stretch
 * is the wind picking the plants up. Held at 0 they would stand at their own
 * phase-nought lean through the whole entrance, and because the wind is 0.88
 * coherent that is not a scatter of small angles but most of the field tilted
 * the same way — a garden that grows crooked and then begins to blow. At the
 * negative end every plant's table says upright, so they grow straight, stand
 * for the beat, and are then carried into the loop.
 *
 * `active` is asked for rather than assumed because the tab stays mounted when
 * you are on the other one: stopping on unmount, which is enough for `Pulse`,
 * would leave this turning for the life of the app. It is also what puts the
 * loop under the caller's control at the two moments that matter — a field
 * nobody is looking at, and a field that is not on the screen yet. The second
 * is the one with teeth: a loop left running past the last `Sway` reading it is
 * a loop React Native stops and cannot restart. See `useGardenMotion` below.
 */
function useSway(active: boolean) {
  const progress = useRef(new Animated.Value(-SWAY_LEAD_SHARE)).current;

  useEffect(() => {
    if (!active) return;

    /*
     * Wound back to the start of the lead-in first, because `Animated.loop`
     * will not do it for you. Only the JavaScript branch of `start()` honours
     * `resetBeforeIteration`; the native branch hands the whole loop to
     * `_startNativeLoop`, and the native side takes its `fromValue` from
     * wherever the node happens to be sitting — `__getNativeAnimationConfig`
     * sends `frames` and a `toValue` and no start at all. A clock gated on a
     * tab's focus is stopped and started for a living, so without this a sway
     * stopped at 0.63 came back running 0.63 → 1 over the full cycle and
     * repeating that for ever: every plant sweeping the tail third of its own
     * table at a third of the rate, with a jump at each wrap. It is the quiet
     * kind of failure — the garden still moves, so nothing looks broken, and
     * the wind is simply not the wind that was tuned.
     *
     * It happens here, on arrival, rather than beside the loop it belongs to.
     * That is the point: a rewind is the one moment the wind genuinely does
     * jump, and the only place to put it is under the burst, where every plant
     * is still too small to see.
     */
    progress.setValue(-SWAY_LEAD_SHARE);

    let loop: Animated.CompositeAnimation | undefined;

    /*
     * The beat, then the lift. A sequence rather than a `setTimeout` around the
     * timing, so the wait and the ramp are one thing to stop — and the delay is
     * genuinely part of the animation rather than a timer that happens to start
     * one.
     */
    const arrival = Animated.sequence([
      Animated.delay(SWAY_HOLD_MS),
      Animated.timing(progress, {
        toValue: 0,
        duration: SWAY_LEAD_MS,
        // The one eased thing about the wind, and it eases *time* rather than
        // shape: a gust takes a stem quickly and lets it settle. The loop below
        // stays linear, because the shape of the sway is in the table.
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]);

    arrival.start(({ finished }) => {
      /*
       * Only once the ramp has actually landed, which is what makes the loop
       * safe to start without a rewind of its own: the node is sitting at
       * exactly 0, so `_startNativeLoop`'s never-rewound `fromValue` is 0 and
       * every iteration runs 0 → 1. Stopped early — the tab left mid-arrival —
       * `finished` is false and nothing starts, which is the same thing the
       * cleanup below would have done a moment later.
       */
      if (!finished) return;

      loop = Animated.loop(
        Animated.timing(progress, {
          toValue: 1,
          duration: SWAY_CYCLE_MS,
          // Linear on purpose, exactly as the burst's is: the shape of the sway
          // is in the table, and easing the shared clock would bend every
          // plant's phase along with it.
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );

      loop.start();
    });

    return () => {
      arrival.stop();
      loop?.stop();
    };
  }, [progress, active]);

  return progress;
}

/**
 * The garden's clocks, and the rule about where they may live.
 *
 * **This hook must be called from whatever renders the plants.** React Native
 * ties an `Animated.Value`'s *native* node to the views reading it. When the
 * last one unmounts, `AnimatedValue.__detach` stops whatever animation is
 * running on the value and drops the node; the node is rebuilt from the stale
 * JavaScript value the next time anything attaches, and nothing restarts the
 * animation. A clock owned by a screen therefore outlives the field it drives,
 * and the garden replaces its whole field on exactly the transition that also
 * restarts the burst — the bed growing. The burst was started, the old field
 * came down, the animation was stopped underneath it, and every plant was left
 * pinned at the first frame of a sprout, which is opacity 0: a garden of empty
 * dots with the plants gone. It shipped once and cost two wrong fixes to find.
 *
 * `PlantGrid` calls this, so the refs below live in `PlantGrid`'s fiber and are
 * thrown away with it. Hoisting the call up into the garden tab would look like
 * tidying and would re-ship precisely that bug — the field would come down
 * around a clock that stayed.
 *
 * The two questions it is asked are not symmetrical, and that is deliberate.
 * `burst` is a token: bump it and the field grows in again, and `undefined`
 * means this plot is being *looked at* rather than arrived at. `sway` is a
 * fact about the screen — `undefined` for a field that is not in the wind at
 * all, then true or false as somebody looks at it or away. `ready` is whether
 * there is a field to animate yet, since a width arrives on a layout pass.
 */
export function useGardenMotion({
  burst,
  sway,
  ready,
}: {
  burst?: number;
  sway?: boolean;
  ready: boolean;
}): GardenMotion {
  const { progress: burstClock, restart } = useBurst(burst !== undefined);
  const swayClock = useSway(ready && sway === true);

  /**
   * The entrance: played when the field first has something to draw, and again
   * whenever the caller asks. Both are the same event — the garden appearing —
   * and running it from an effect is what guarantees the plants are already
   * attached to the clock when it starts.
   */
  useEffect(() => {
    if (burst === undefined || !ready) return;
    restart();
  }, [burst, ready, restart]);

  /*
   * Whether a field takes part in each motion is settled here, once, on the
   * answers that do not move under it. `sway` goes true and false as the tab
   * gains and loses focus but never back to `undefined`, so a plant's wrappers
   * are the same elements throughout a visit and only the clocks stop — see
   * `PlantMotion` for why that matters more than it sounds.
   */
  return {
    burst: burst === undefined ? null : burstClock,
    sway: sway === undefined ? null : swayClock,
  };
}

/**
 * One plant leaning, read off the shared clock.
 *
 * This sits OUTSIDE `Sprout`, which is not arbitrary. Outside, the composite is
 * `skewX · scaleY`, so a half-grown plant leans half as far in pixels at the
 * same angle. Inside, the lean is applied before the growth and is therefore
 * unscaled — a plant squashed to a fifth of its height swings as wide as a full
 * one, which reads as a glitch rather than as wind.
 *
 * The lean is a shear and a turn, never a scale, so it cannot break the rule
 * `GROWTH` works so hard to keep: a shear's determinant is exactly 1, and a
 * doodle that only shears changes shape and never mass.
 */
function Sway({
  progress,
  slot,
  col,
  row,
  children,
}: {
  /** The shared 0..1 clock from `useSway`. */
  progress: Animated.Value;
  slot: number;
  col: number;
  row: number;
  children: ReactNode;
}) {
  const track = useMemo(() => swayTrack(slot, col, row), [slot, col, row]);

  /*
   * Interpolated once and kept, which is worth more than it looks. React Native
   * keys an `AnimatedProps` on the *identity* of the nodes inside `style`, so
   * interpolating in the middle of the render mints two new ones every time
   * anything above this re-renders — and a new node is detached, re-attached
   * and, on the native driver, built again on the far side of the bridge with
   * this plant's whole three-hundred-and-twenty-two-number config in tow. Held,
   * the garden uploads its wind when the wind changes and not before.
   */
  /*
   * No `extrapolate` is asked for, and none is needed: the clock is driven from
   * exactly the first knot to exactly the last and never outside them, so the
   * default extension has nothing to extend. That is a property of `useSway`
   * above rather than of this table, which is why it is worth saying here —
   * a clock started anywhere else would silently extrapolate the lead-in.
   */
  const lean = useMemo(
    () => ({
      skew: progress.interpolate({ inputRange: track.at, outputRange: track.skew }),
      spin: progress.interpolate({ inputRange: track.at, outputRange: track.spin }),
    }),
    [progress, track]
  );

  return (
    <Animated.View
      style={{
        // The root, as everywhere else a plant is transformed.
        transformOrigin: ROOT_ORIGIN,
        transform: [{ skewX: lean.skew }, { rotate: lean.spin }],
      }}>
      {children}
    </Animated.View>
  );
}

/**
 * One plant, wearing whatever motion the field is in: the wind outside, the
 * growth inside.
 *
 * Both wrappers are rendered on facts that hold for the whole visit rather than
 * on the clocks' state, and that is a performance rule with teeth. A `<Sway>`
 * that came and went with the focus would change the element type at that
 * position, and React does not reconcile across a change of type — it tears the
 * subtree down and builds it again. That is six hundred native views, a hundred
 * and eight sampled loops and two hundred and sixteen interpolation configs,
 * twice per visit, which was most of the pause you felt arriving at the garden.
 * Rendered unconditionally the element is the same throughout, nothing beneath
 * it is touched, and all that stops is the clock.
 *
 * A bed that is only being looked at gets neither wrapper and builds no tables
 * — the grow screen's, which has no wind to be in.
 */
export function PlantMotion({
  motion,
  slot,
  col,
  row,
  children,
}: {
  motion: GardenMotion;
  slot: number;
  /**
   * Where in the bed the plant stands. The wind crosses the bed you are looking
   * at, and a bed six wide has six columns for it to cross — which is also why
   * the bed's width is frozen above one row, since a re-flow would move a plant
   * into a different cell and a different gust.
   */
  col: number;
  row: number;
  children: ReactNode;
}) {
  const grown =
    motion.burst === null ? (
      children
    ) : (
      <Sprout progress={motion.burst} delayMs={burstDelay(slot)}>
        {children}
      </Sprout>
    );

  if (motion.sway === null) return <>{grown}</>;

  return (
    <Sway progress={motion.sway} slot={slot} col={col} row={row}>
      {grown}
    </Sway>
  );
}
