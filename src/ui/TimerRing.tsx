import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { color } from '../theme/tokens';
import { Plant } from './Plant';

/**
 * One breath, at a pace worth borrowing: out longer than in. Slow enough that
 * following it settles you rather than giving you a rhythm to keep up with.
 */
const INHALE_MS = 4000;
const EXHALE_MS = 6000;

/**
 * The circle from the mockup: a thin terracotta ring with a plant resting at
 * its centre.
 *
 * While a sitting runs, the ring breathes. That is not decoration — the clock
 * shows whole minutes by default, so without it nothing on screen moves for up
 * to a minute at a time and a running sitting is indistinguishable from a
 * frozen app.
 *
 * Behind it, a hairline arc closes as the time goes. It is deliberately the
 * quietest thing here: legible if you look for it, easy to miss if you don't.
 * This ring was once emphatically not a progress ring, on the grounds that a
 * second, slower way to watch the clock is the opposite of what a sitting is
 * for. That still holds for the *breathing* ring, which says only "this is
 * running" — the arc is the concession, and it is why the arc is a hairline in
 * the structural colour rather than something that draws the eye.
 */
export function TimerRing({
  plant,
  size = 210,
  elapsed,
  breathing = false,
}: {
  plant: string;
  size?: number;
  /** How much of the sitting is spent, 0..1. Omitted before one starts. */
  elapsed?: number;
  /** Whether the ring breathes. True only while a sitting is running. */
  breathing?: boolean;
}) {
  const stroke = 1.5;
  const r = (size - stroke) / 2;
  const trackR = r - 8;
  const circumference = 2 * Math.PI * trackR;

  const breath = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!breathing) return;

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
    // Stopping on unmount matters: the sitting screen is replaced the instant
    // the bell rings, and a loop left running holds the component alive.
    return () => loop.stop();
  }, [breathing, breath]);

  // Held at rest when nothing is running, so the start screen looks untouched.
  const ringStyle = breathing
    ? {
        opacity: breath.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }),
        transform: [
          { scale: breath.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
        ],
      }
    : null;

  const spent = elapsed === undefined ? null : Math.min(1, Math.max(0, elapsed));

  return (
    <View style={[styles.frame, { width: size, height: size }]}>
      {spent !== null && (
        <Svg width={size} height={size} style={styles.layer}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={trackR}
            stroke={color.line}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - spent)}
            // Start the arc at the top and close it clockwise, the way a clock
            // is read, rather than from three o'clock where SVG begins.
            rotation={-90}
            originX={size / 2}
            originY={size / 2}
          />
        </Svg>
      )}

      <Animated.View style={[styles.layer, ringStyle]}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color.terracotta}
            strokeWidth={stroke}
            fill="none"
          />
        </Svg>
      </Animated.View>

      <Plant plant={plant} size={size * 0.28} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  layer: {
    position: 'absolute',
  },
});
