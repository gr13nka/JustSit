import { ReactNode, useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useColor } from '../theme/useColor';
import { LOCATOR } from './Plant';
import { ringPath } from './ring';

/**
 * The first dot's ripple: the locator ring letting go of a copy of itself, once
 * every few seconds, on a garden nobody has sat in yet.
 *
 * It is here for the one screen this app cannot explain in words. A field of
 * empty dots is a promise rather than an instruction, and on a first launch
 * there is nothing on the page saying that the one circled dot is the way in —
 * the drawn ring picks it out of the lattice, which is a different job from
 * saying what it is for. A mark travelling outward from that dot says it,
 * because outward from a point is the shape of *here*.
 *
 * This is the **fourth** looping animation in an app whose whole case is that it
 * is quiet, and the other three are each written down as a named exception. What
 * earns this one is not its size: it is that it **retires**. It runs while the
 * garden is empty and never again once a plant is in the ground. It cannot
 * accumulate, it has nothing to congratulate, it keeps no score, and there is no
 * state it can reach in which it is asking for a second sitting — the second
 * sitting is the state in which it does not exist. It is an instruction that
 * deletes itself once it has been obeyed, which is the opposite of what a loop
 * is usually put on a screen to do.
 *
 * The handoff is not timed and nothing here watches for it. `PlantGrid` is told
 * whether the garden is empty and swaps this for `Pulse`; the plant arriving is
 * what changes the answer.
 *
 * One ring, never two, and that is the load-bearing part. Two rings overlapping
 * would keep something on the dot at every instant, and a mark that never rests
 * is a demand. With one, the beat spends its last second with nothing on screen
 * at all — the difference between breathing and blinking, and the reason the
 * table below stops well short of the end of the clock.
 */

/**
 * One whole beat: the ring's life *and* the silence after it, on one clock.
 *
 * The silence is inside this rather than beside it, which is what keeps the two
 * halves impossible to get out of step — the table's last frame is at 0.7, so a
 * little over a second of every beat has nothing drawn in it, whatever this
 * number is changed to.
 */
const RIPPLE_MS = 3600;

/**
 * How wide the echo's line is struck, against the locator's own `RING_WIDTH` of
 * 1.6 on the same canvas.
 *
 * The ring is **scaled**, not redrawn, so its stroke thickens as it grows —
 * which is the wrong way round for a ripple, and is not negotiable: everything
 * in this app animates transform and opacity only, so that every driver is
 * native, and a stroke re-struck at a new radius every frame would be arithmetic
 * running in JavaScript beside a wall clock somebody is sitting to.
 *
 * So opacity is what does the thinning, and the numbers are what make that hold.
 * Ink laid down goes as width times opacity. The locator's is 1.6 × 1 = 1.6. The
 * echo leaves the dot at 1.0 × 0.32 = 0.32, a fifth of it, and every frame after
 * that lays down less than the one before even though the line is getting fatter
 * — 1.44 × 0.22, 1.7 × 0.15, 1.88 × 0.08, and last at 1.98 × 0.03 = 0.06, a
 * twenty-seventh of the locator. The width doubles across the life; the ink
 * falls by five and a half times. By the point the stroke is fatter than the
 * mark it came off, there is nothing left of it to look fat.
 */
const RIPPLE_WIDTH = 1;

/**
 * How far out it travels, as a multiple of the locator's radius — derived, so
 * that the one guarantee it has to keep cannot quietly stop being true.
 *
 * It stops where the dot's own canvas stops. `ART_SHARE` is worked out so that
 * half that canvas plus a full scatter comes to exactly half a cell, so a ripple
 * that ends there ends at the edge of the cell it started in, however the hash
 * threw the dot. It is nowhere near a neighbouring dot, which sits a further
 * half cell away behind its own scatter.
 */
const RIPPLE_SCALE = LOCATOR.reach / LOCATOR.radius;

/**
 * The shape of one beat, frame by frame: `at` is how far through the beat this
 * frame sits, `out` is how far the ring has travelled — 0 on the locator, 1 at
 * the edge of the dot's canvas — and `opacity` is what is left of it there.
 *
 * Written as frames rather than two parallel arrays for `GROWTH`'s reason: the
 * whole character is in how the two channels disagree at a moment. The ring is
 * quickest as it leaves and slows the further out it gets, which is what water
 * does and also what keeps the fastest movement nearest the dot it is pointing
 * at; the opacity meanwhile falls off the front of that, so it is finished at
 * 0.98 of the travel rather than at the end of it. Reaching zero exactly at the
 * edge would put the last, faintest, fattest frame at the widest the ring ever
 * gets, which is the one frame worth not drawing.
 *
 * It ends at 0.7 and the clock runs to 1. That remainder is the silence, and it
 * is the point rather than slack left over: `extrapolate: 'clamp'` holds both
 * channels where the last frame left them, so for the last 1080ms of every
 * 3600ms there is no ring on the screen at all.
 */
const RIPPLE = [
  { at: 0, opacity: 0, out: 0 },
  { at: 0.06, opacity: 0.32, out: 0.15 },
  { at: 0.18, opacity: 0.22, out: 0.44 },
  { at: 0.32, opacity: 0.15, out: 0.7 },
  { at: 0.46, opacity: 0.08, out: 0.88 },
  { at: 0.6, opacity: 0.03, out: 0.98 },
  { at: 0.7, opacity: 0, out: 1 },
] as const;

/** The echo's own path — the locator's, struck once and scaled from then on. */
const RIPPLE_PATH = ringPath(LOCATOR.centre, LOCATOR.centre, LOCATOR.radius);

/**
 * A dot with a ring leaving it.
 *
 * Takes the dot's drawn size rather than measuring, because the caller already
 * has it: `field` hands `PlantGrid` a `dot` and both marks are struck on the
 * same canvas at it, which is what keeps the echo concentric with the ring it
 * comes off at any cell size.
 *
 * The echo is drawn *before* its children and so behind them, which is why it
 * appears to be shed rather than to arrive: at rest it is exactly under the
 * locator's own heavier line, and the first thing you see of it is it coming
 * out from behind it.
 */
export function Ripple({ size, children }: { size: number; children: ReactNode }) {
  const color = useColor();
  const wave = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      // The sequence is not decoration and must not be unwrapped. `Animated.loop`
      // handed a bare `timing` takes the `_startNativeLoop` path, which no-ops
      // wherever the native animated module is missing — the web preview would
      // draw the first frame and then stop, and a still screenshot of a frozen
      // loop looks perfectly correct. A sequence reports itself as not natively
      // driven, so the loop restarts it from JavaScript and the beat runs on
      // both targets. `Pulse` breathes in the web preview for exactly this
      // reason; `useSway`, which loops a bare one, is frozen there.
      Animated.sequence([
        Animated.timing(wave, {
          toValue: 1,
          duration: RIPPLE_MS,
          // Linear, as every clock in this app that carries a table is: the
          // shape of the beat is in `RIPPLE` above, and easing the ramp would
          // bend the silence at the end of it along with the ring.
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();
    // A loop left running holds the component alive after the screen is gone —
    // the same reason `Pulse` and the timer's ring both stop on unmount. Like
    // `Pulse` and unlike `Sway` it takes no `active` flag, so it does keep
    // turning behind the other tab: one driver on one dot is a cost worth not
    // adding a prop for, where a hundred and eight of them was not.
    return () => loop.stop();
  }, [wave]);

  const at = RIPPLE.map((frame) => frame.at);

  return (
    <View>
      <Animated.View
        // The dot underneath is the button, and an echo that swallowed a touch
        // would be the tutorial getting in the way of the thing it teaches.
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          styles.echo,
          {
            opacity: wave.interpolate({
              inputRange: at,
              outputRange: RIPPLE.map((frame) => frame.opacity),
              extrapolate: 'clamp',
            }),
            transform: [
              {
                scale: wave.interpolate({
                  inputRange: at,
                  outputRange: RIPPLE.map((frame) => 1 + frame.out * (RIPPLE_SCALE - 1)),
                  extrapolate: 'clamp',
                }),
              },
            ],
          },
        ]}>
        <Svg width={size} height={size} viewBox={LOCATOR.canvas}>
          <Path
            d={RIPPLE_PATH}
            transform={LOCATOR.lean}
            stroke={color.inkSoft}
            strokeWidth={RIPPLE_WIDTH}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </Animated.View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * Laid over the dot rather than beside it, so the two share a centre and the
   * scale pivots on the middle of the ring with no origin having to be named —
   * which is also how it sidesteps the `transformOrigin` string trap `field.ts`
   * documents, since the origin it never writes down cannot be mis-parsed.
   */
  echo: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
