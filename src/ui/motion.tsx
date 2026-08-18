import { ReactNode, useCallback, useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';

/**
 * The app's motion, in one file.
 *
 * Two layers, and they mean different things. An *entrance* marks a first
 * appearance — a screen arriving, a garden being shown — and plays once.
 * A *settle* is feedback for a touch. Nothing here loops; the breathing ring
 * is the only thing in the app that does, and it owns its own loop because the
 * loop is the point rather than a transition.
 *
 * Everything animates transform and opacity only, so every driver here is
 * native and none of it competes with the wall clock a sitting runs on.
 */

/** Overshoot-and-settle, for anything that moves or scales. */
export const BOUNCE = Easing.bezier(0.34, 1.56, 0.64, 1);

/** How long one doodle takes to grow. */
const SPROUT_MS = 200;
/** The window the whole field's delays are scattered across. */
export const BURST_SPREAD_MS = 280;
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
 */
const GROWTH = [
  { at: 0, opacity: 0, scaleY: 0.05, scaleX: 0.7 },
  { at: 0.55, opacity: 1, scaleY: 1.22, scaleX: 0.88 },
  { at: 0.8, opacity: 1, scaleY: 0.96, scaleX: 1.05 },
  { at: 1, opacity: 1, scaleY: 1, scaleX: 1 },
] as const;

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
        // A plant grows from its root, not from its middle.
        transformOrigin: 'bottom',
        opacity: track('opacity'),
        transform: [{ scaleY: track('scaleY') }, { scaleX: track('scaleX') }],
      }}>
      {children}
    </Animated.View>
  );
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
