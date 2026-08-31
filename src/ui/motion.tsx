import { ReactNode, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleProp,
  ViewStyle,
} from 'react-native';

import { ROOT_ORIGIN } from './field';
import { BURST_MS, Channel, GROWTH, SPROUT_MS } from './sprout';

/**
 * The app's motion, in one file.
 *
 * What belongs here is **vocabulary the app speaks more than once**. Two layers,
 * and they mean different things. An *entrance* marks a first appearance — a
 * screen arriving, a garden being shown — and plays once. A *settle* is feedback
 * for a touch. Neither repeats. Four things in the app do loop and all four are
 * deliberate: the sitting's breath, `Pulse` below, the garden's lean, and
 * `Ripple`. In each the loop is the point rather than a transition — the first
 * says a sitting is running, the second says the garden carries on here, the
 * third says the garden is a living thing rather than a chart of one, and the
 * fourth says which dot to touch on a garden nobody has touched yet.
 *
 * That fourth is the only one that ever stops for good, and that is what buys
 * it: it runs on an empty garden and never again once a plant is in the ground.
 * An instruction that deletes itself once obeyed is the opposite of the thing a
 * loop is usually put on a screen to do.
 *
 * Two of those four are not in this file, for one reason. `Ripple` belongs to a
 * single dot on a single screen, and the lean belongs to the garden — the app
 * speaks each of them exactly once, so putting either here would be offering
 * every other screen a wind to blow through it. The lean now also has to be
 * said twice over in two languages, one per platform, which is `plantMotion.tsx`
 * and its `.web.tsx` twin. `Sprout` and `useBurst` stay, because an entrance
 * that plays once is a word: the garden, the days screen and the welcome screen
 * all use them.
 *
 * Everything animates transform and opacity only, so every driver here is
 * native and none of it competes with the wall clock a sitting runs on.
 */

/** Overshoot-and-settle, for anything that moves or scales. */
export const BOUNCE = Easing.bezier(0.34, 1.56, 0.64, 1);

/**
 * The burst's own arithmetic lives in `sprout.ts`, which is pure and is read by
 * both renderers. These two are passed straight through because their callers —
 * `field.ts` reserving room, `GrowingBed` and `app/streak.tsx` timing an
 * arrival — are asking this file about the app's motion and have no business
 * knowing which module happens to hold the table.
 */
export { BURST_SPREAD_MS, SPROUT_PEAK } from './sprout';

/**
 * One clock for a whole field of sprouting doodles.
 *
 * A garden is 108 cells, and giving each its own driver would start a hundred
 * animations to play one. Instead a single value runs 0 → 1 across the entire
 * burst and each `Sprout` reads its own window out of it, which is also what
 * makes the scatter cheap enough to replay on every visit.
 *
 * `restart` is what the field calls when it appears, and again whenever it is
 * asked to play. An entrance that only fired on mount would fire once ever on
 * the garden: the tab stays mounted, so coming back to it is not a mount.
 *
 * `waiting` is whether the field this drives is going to be asked to play. A
 * clock that will be starts at the beginning rather than at the end, so the
 * first frame drawn is the first frame of the entrance; one that will not sits
 * at 1, because a drawing nobody is animating has to be simply there.
 *
 * The value belongs to whatever owns the views reading it, and that is not
 * negotiable: React Native stops a running animation and drops the native node
 * the moment the last view detaches, and rebuilds it from a stale value
 * afterwards with nothing driving it. `useGardenMotion` in `plantMotion.tsx`
 * carries the full account, and it is the rule this hook is easiest to break.
 */
export function useBurst(waiting: boolean = false) {
  const progress = useRef(new Animated.Value(waiting ? 0 : 1)).current;

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
 * One doodle growing up out of the ground, on `sprout.ts`'s curve.
 *
 * The curve is kept out of this file because a browser needs the same rows as
 * CSS keyframes, and a table transcribed into two places is two animations. See
 * `keyframes.ts` for the other reading of it.
 *
 * `delayMs` is where in the burst this one starts, and it is the caller's
 * business — a garden seeds it from the slot with `burstDelay` so the same plot
 * scatters the same way every time rather than re-rolling on each visit.
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
  const frames = useMemo(
    () => GROWTH.map((frame) => (delayMs + frame.at * SPROUT_MS) / BURST_MS),
    [delayMs]
  );

  /*
   * Interpolated once and kept, which is worth more than it looks. React Native
   * keys an `AnimatedProps` on the *identity* of the nodes inside `style`, so
   * interpolating mid-render mints new ones every time anything above this
   * draws itself — three of them here, and a hundred and eight plants at a
   * time. A curve that cannot have changed unless the delay did should not be
   * handed to the native driver again because something further up the screen
   * moved.
   */
  const growth = useMemo(() => {
    const track = (channel: Channel) =>
      progress.interpolate({
        inputRange: frames,
        outputRange: GROWTH.map((frame) => frame[channel]),
        extrapolate: 'clamp',
      });

    return { opacity: track('opacity'), scaleY: track('scaleY'), scaleX: track('scaleX') };
  }, [progress, frames]);

  return (
    <Animated.View
      style={{
        // A plant grows from its root, so that is what stays nailed to the
        // ground while the rest of it stretches. Not the bottom of the canvas,
        // which is a nib's margin lower — pivoting there lifted every root a
        // couple of points at the peak and set it back down again.
        transformOrigin: ROOT_ORIGIN,
        opacity: growth.opacity,
        transform: [{ scaleY: growth.scaleY }, { scaleX: growth.scaleX }],
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
 * One shared breath for a screen that wants several marks to settle together.
 *
 * The timer ring and the meditation veil borrow this rather than each starting
 * a private loop, because two nearly-matched breaths would read as drift. Like
 * every loop here, it stops when the screen that asked for it leaves.
 */
export function useBreath(active: boolean) {
  const breath = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!active) return;

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
    return () => loop.stop();
  }, [active, breath]);

  return breath;
}

/**
 * A mark breathing where it stands — the one place the garden asks for anything.
 *
 * It wraps the dot a sitting would fill next, and it exists because a ring alone
 * is a label: it tells you where the garden carries on, but a still field gives
 * you no reason to look. The breath is what turns that into an invitation.
 *
 * It was the second looping animation in the app and it is still the one that
 * both invites and runs forever, which is the nearest this app comes to
 * something it does not do — `Ripple` nudges harder and is forgiven because it
 * retires; this one never does. What keeps it honest instead is its
 * size. The swing is small enough that you notice it only once you are already
 * looking at the garden, and nothing about it accumulates, congratulates or
 * keeps score — miss a week and it is doing exactly what it does now.
 *
 * It is not always what is on that dot. On a garden nobody has ever sat in,
 * `Ripple` runs in its place — the dot needs saying what it is for before it
 * needs a breath, and two of them on one mark would be one too many.
 *
 * Transform and opacity only, so it stays on the native driver and never
 * competes with the wall clock a sitting runs on. One driver, because only one
 * dot is ever next.
 */
export function Pulse({ children }: { children: ReactNode }) {
  const breath = useBreath(true);

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
 *
 * `from` is how far below its place it starts. The default is the nudge a card
 * on a page wants — enough to say "this is new", not enough to be a movement.
 * Something that genuinely arrives from off the bottom of the screen, like the
 * note sheet, asks for more, and asking is better than a second component that
 * differs from this one by a single number.
 */
export function Rise({
  delayMs = 0,
  from = 10,
  style,
  children,
}: {
  delayMs?: number;
  from?: number;
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
            { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) },
          ],
        },
        style,
      ]}>
      {children}
    </Animated.View>
  );
}

/**
 * Something arriving that must not move.
 *
 * `Rise`'s sibling, and the pair covers the app's entrances: a card arrives
 * from somewhere, a veil does not. A veil that slid would be a sheet of paper
 * over the screen rather than the screen going quiet, and the thing rising in
 * front of it is what the eye is meant to follow.
 *
 * It settles rather than bouncing — an overshoot on opacity would be a flicker.
 */
export function Fade({
  to = 1,
  style,
  children,
}: {
  /** The opacity it settles at. */
  to?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(enter, {
      toValue: to,
      duration: 220,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [enter, to]);

  return <Animated.View style={[{ opacity: enter }, style]}>{children}</Animated.View>;
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
