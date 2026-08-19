import { ReactNode, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleProp,
  ViewStyle,
} from 'react-native';

import { ROOT_SHARE } from './field';
import { SWAY_CYCLE_MS, swayTrack } from './sway';

/**
 * The app's motion, in one file.
 *
 * Two layers, and they mean different things. An *entrance* marks a first
 * appearance — a screen arriving, a garden being shown — and plays once.
 * A *settle* is feedback for a touch. Neither repeats. Three things in the app
 * do loop and all three are deliberate: the timer's breathing ring, which owns
 * its own, and `Pulse` and `Sway` below. In each the loop is the point rather
 * than a transition — the first says a sitting is running, the second says the
 * garden carries on here, and the third says the garden is a living thing
 * rather than a chart of one.
 *
 * `Sway` is the one that had to argue hardest for itself, being a whole screen
 * that never stops moving in an app whose case is that it is quiet. What earns
 * it is that it reports nothing and asks for nothing: it does not accumulate,
 * congratulate or keep score, it is the same whether you sat today or not, and
 * it is gone the moment you leave the tab. A garden moves in wind. That is all
 * it says.
 *
 * Everything animates transform and opacity only, so every driver here is
 * native and none of it competes with the wall clock a sitting runs on.
 */

/** Overshoot-and-settle, for anything that moves or scales. */
export const BOUNCE = Easing.bezier(0.34, 1.56, 0.64, 1);

/** How long one doodle takes to grow and stop wobbling. */
const SPROUT_MS = 1000;
/** The window the whole field's delays are scattered across. */
export const BURST_SPREAD_MS = 450;
const BURST_MS = BURST_SPREAD_MS + SPROUT_MS;

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
 * is gone whatever the numbers say.
 *
 * The shoot up is fast and everything after it is the plant wobbling to a stop
 * — an overshoot of nearly two thirds, then a third, then a sixth, each swing
 * about half the one before, which is what a damped spring does and what makes
 * it read as jelly rather than as a bounce. The rise takes an eighth of the
 * window and the six swings share the rest, so the wobble slows as it dies.
 *
 * Tuned in `tools/anim-lab.html`, which is where the next pass should happen
 * too: the settle is the hard part of a curve to judge, and at this size it is
 * invisible in the app until you have already committed it.
 */
const GROWTH = [
  { at: 0, opacity: 0, scaleY: 0.05, scaleX: 0.7 },
  { at: 0.12, opacity: 1, scaleY: 1.63, scaleX: 0.64 },
  { at: 0.27, opacity: 1, scaleY: 0.69, scaleX: 1.53 },
  { at: 0.41, opacity: 1, scaleY: 1.16, scaleX: 0.91 },
  { at: 0.56, opacity: 1, scaleY: 0.92, scaleX: 1.14 },
  { at: 0.71, opacity: 1, scaleY: 1.04, scaleX: 1.01 },
  { at: 0.85, opacity: 1, scaleY: 0.98, scaleX: 1.07 },
  { at: 1, opacity: 1, scaleY: 1, scaleX: 1 },
] as const;

/**
 * The tallest a sprout ever gets, for whoever has to leave room for it. Read
 * off the curve rather than written down twice: a louder pop that quietly
 * outgrew the space reserved for it is exactly the bug this prevents.
 */
export const SPROUT_PEAK = Math.max(...GROWTH.map((frame) => frame.scaleY));

type Channel = 'opacity' | 'scaleY' | 'scaleX';

/**
 * One clock for a whole field of sprouting doodles.
 *
 * A garden is 108 cells, and giving each its own driver would start a hundred
 * animations to play one. Instead a single value runs 0 → 1 across the entire
 * burst and each `Sprout` reads its own window out of it, which is also what
 * makes the scatter cheap enough to replay on every visit.
 *
 * `restart` is what a screen calls when it becomes visible again. An entrance
 * that only fired on mount would fire once ever: the tab stays mounted, so
 * coming back to it is not a mount.
 */
/**
 * The garden's idle sway: one clock for the whole field.
 *
 * A hundred and eight looping drivers is not a thing to do, so there is one
 * linear 0..1 ramp and each `Sway` reads its own window out of it — the same
 * arrangement as the burst, for the same reason. It restarts at 0 without a
 * jump because every plant's table ends exactly where it began.
 *
 * `active` is asked for rather than assumed because the tab stays mounted when
 * you are on the other one: stopping on unmount, which is enough for `Pulse`,
 * would leave this turning for the life of the app.
 */
export function useSway(active: boolean) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return;

    const loop = Animated.loop(
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
    return () => loop.stop();
  }, [progress, active]);

  return progress;
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
 * `GROWTH` above works so hard to keep: a shear's determinant is exactly 1, and
 * a doodle that only shears changes shape and never mass.
 */
export function Sway({
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

  return (
    <Animated.View
      style={{
        // The root, as everywhere else a plant is transformed.
        transformOrigin: `50% ${ROOT_SHARE * 100}%`,
        transform: [
          { skewX: progress.interpolate({ inputRange: track.at, outputRange: track.skew }) },
          { rotate: progress.interpolate({ inputRange: track.at, outputRange: track.spin }) },
        ],
      }}>
      {children}
    </Animated.View>
  );
}

export function useBurst() {
  const progress = useRef(new Animated.Value(1)).current;

  const restart = useCallback(() => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: BURST_MS,
      // Linear on purpose: the shape of a sprout is in the interpolation
      // below, and easing the shared clock would bend every delay with it.
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
  }, [progress]);

  return { progress, restart };
}

/**
 * One doodle growing up out of the ground, on the curve in `GROWTH` above.
 *
 * `delayMs` is where in the burst this one starts, and it is the caller's
 * business — a garden seeds it from the slot so the same plot scatters the same
 * way every time rather than re-rolling on each visit.
 */
export function Sprout({
  progress,
  delayMs,
  children,
}: {
  progress: Animated.Value;
  delayMs: number;
  children: ReactNode;
}) {
  // The clock is shared, so this doodle's window is a slice of it. Clamped at
  // both ends: before its turn it sits squat and invisible, after it it is
  // simply grown.
  const frames = GROWTH.map((frame) => (delayMs + frame.at * SPROUT_MS) / BURST_MS);

  const track = (channel: Channel) =>
    progress.interpolate({
      inputRange: frames,
      outputRange: GROWTH.map((frame) => frame[channel]),
      extrapolate: 'clamp',
    });

  return (
    <Animated.View
      style={{
        // A plant grows from its root, so that is what stays nailed to the
        // ground while the rest of it stretches. Not the bottom of the canvas,
        // which is a nib's margin lower — pivoting there lifted every root a
        // couple of points at the peak and set it back down again.
        transformOrigin: `50% ${ROOT_SHARE * 100}%`,
        opacity: track('opacity'),
        transform: [{ scaleY: track('scaleY') }, { scaleX: track('scaleX') }],
      }}>
      {children}
    </Animated.View>
  );
}

/**
 * One breath, at a pace worth borrowing: out longer than in. The timer's ring
 * breathes to the same count, so the app has one breath rather than two that
 * nearly match.
 */
const INHALE_MS = 4000;
const EXHALE_MS = 6000;

/**
 * A mark breathing where it stands — the one place the garden asks for anything.
 *
 * It wraps the dot a sitting would fill next, and it exists because a ring alone
 * is a label: it tells you where the garden carries on, but a still field gives
 * you no reason to look. The breath is what turns that into an invitation.
 *
 * It is the second looping animation in the app and that is a real exception,
 * taken knowingly: this one nudges rather than informs, which is nearer an
 * engagement mechanic than anything else here. What keeps it honest is its
 * size. The swing is small enough that you notice it only once you are already
 * looking at the garden, and nothing about it accumulates, congratulates or
 * keeps score — miss a week and it is doing exactly what it does now.
 *
 * Transform and opacity only, so it stays on the native driver and never
 * competes with the wall clock a sitting runs on. One driver, because only one
 * dot is ever next.
 */
export function Pulse({ children }: { children: ReactNode }) {
  const breath = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 0,
          duration: EXHALE_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 1,
          duration: INHALE_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();
    // Stopping on unmount matters for the same reason the ring's does: a loop
    // left running holds the component alive after the screen is gone.
    return () => loop.stop();
  }, [breath]);

  return (
    <Animated.View
      style={{
        opacity: breath.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }),
        transform: [
          { scale: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) },
        ],
      }}>
      {children}
    </Animated.View>
  );
}

/**
 * Pull down at the top of a list to play its entrance again.
 *
 * Spread the result onto a ScrollView. The gesture is read from the scroll
 * events themselves rather than from a RefreshControl, which is the usual way
 * to get this: that would put a Material spinner on the paper, and a system
 * progress indicator is a promise that something is loading. Nothing is
 * loading. The garden is already there and you asked to watch it grow.
 *
 * The read is indirect because Android reports no overscroll — offset simply
 * stays at 0 while you pull, so there is no negative number to notice. What
 * there is: a drag that *began* at the top and never moved the content can only
 * have been downward, since upward would have scrolled. iOS bounces and reports
 * a negative offset, which fails the same `> 0` test, so one rule covers both.
 */
export function usePullToReplay(onPull: () => void) {
  const fromTop = useRef(false);

  return {
    scrollEventThrottle: 32,
    onScrollBeginDrag: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      fromTop.current = e.nativeEvent.contentOffset.y <= 0;
    },
    onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      // Moved into the list: whatever this drag was, it was not a pull.
      if (e.nativeEvent.contentOffset.y > 0) fromTop.current = false;
    },
    onScrollEndDrag: () => {
      if (!fromTop.current) return;
      fromTop.current = false;
      onPull();
    },
  };
}

/**
 * A card or a button arriving: lifted a little and faded, settling into place.
 * Plays once, on mount — this is an entrance, not a state change.
 */
export function Rise({
  delayMs = 0,
  style,
  children,
}: {
  delayMs?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(enter, {
      toValue: 1,
      duration: 220,
      delay: delayMs,
      easing: BOUNCE,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [enter, delayMs]);

  return (
    <Animated.View
      style={[
        {
          opacity: enter,
          transform: [
            { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
          ],
        },
        style,
      ]}>
      {children}
    </Animated.View>
  );
}

/**
 * A press, felt as one point of travel downward.
 *
 * Ink settling, not a bounce: the app's touch feedback has always been an
 * opacity change with no scale and no shadow, and this adds the one movement
 * the kit specifies for a button and nothing more. Spread onto a Pressable
 * alongside its own `pressed` style.
 */
export function usePressSettle() {
  const settle = useRef(new Animated.Value(0)).current;

  const to = (toValue: number) =>
    Animated.timing(settle, {
      toValue,
      duration: 150,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();

  return {
    onPressIn: () => to(1),
    onPressOut: () => to(0),
    settleStyle: {
      transform: [
        { translateY: settle.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) },
      ],
    },
  };
}
