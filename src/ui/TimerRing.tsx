import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { hairline } from '../theme/tokens';
import { useColor } from '../theme/useColor';
import { Plant } from './Plant';
import { arcLength, ringPath } from './ring';

/**
 * One breath, at a pace worth borrowing: out longer than in. Slow enough that
 * following it settles you rather than giving you a rhythm to keep up with.
 */
const INHALE_MS = 4000;
const EXHALE_MS = 6000;

/**
 * How far inside the ring the elapsed arc runs: close enough to read as part of
 * the same figure, far enough that the two lines never touch.
 */
const ARC_INSET = 8;

/**
 * A thin ink ring with a plant resting at its centre.
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
 * running" — the arc is the concession, and it is why the arc is drawn in the
 * faintest ink rather than in anything that draws the eye. Green is not an
 * option for it either: green means something grew, and elapsed time has not
 * grown anything.
 */
export function TimerRing({
  plant,
  size = 210,
  spent,
}: {
  plant: string;
  size?: number;
  /**
   * How much of the sitting is spent, 0..1 — and, by being given at all, that a
   * sitting is running. Both signs of that are the same fact, so they are the
   * same prop: with a number the ring breathes and closes its arc, without one
   * it holds still and draws neither.
   */
  spent?: number;
}) {
  // A hairline, not the hero pen: at 210pt across, a stroke drawn to the 200-unit
  // hero ratio would shout, and this ring is meant to sit still and be quiet.
  const color = useColor();
  const strokeWidth = hairline;
  const centre = size / 2;
  const fitRadius = (size - strokeWidth) / 2;
  const arcR = fitRadius - ARC_INSET;

  const fraction = spent === undefined ? null : Math.min(1, Math.max(0, spent));
  const running = fraction !== null;

  const breath = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!running) return;

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
  }, [running, breath]);

  // Held at rest when nothing is running, so the start screen looks untouched.
  const ringStyle = running
    ? {
        opacity: breath.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }),
        transform: [
          { scale: breath.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
        ],
      }
    : null;

  const arcTotal = arcLength(arcR);

  return (
    <View style={[styles.frame, { width: size, height: size }]}>
      {fraction !== null && (
        <Svg width={size} height={size} style={styles.layer}>
          <Path
            d={ringPath(centre, arcR)}
            stroke={color.inkFaint}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            // The path already starts at twelve and runs clockwise, so the dash
            // grows from there: one dash as long as the whole ring, pushed back
            // by however much of it has not been spent yet.
            strokeDasharray={arcTotal}
            strokeDashoffset={arcTotal * (1 - fraction)}
          />
        </Svg>
      )}

      <Animated.View style={[styles.layer, ringStyle]}>
        <Svg width={size} height={size}>
          <Path
            d={ringPath(centre, fitRadius)}
            stroke={color.accent}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
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
