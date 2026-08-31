import { ReactNode, useEffect, useState } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

import { ROOT_ORIGIN } from './field';
import { arrivalKeyframes, Keyframes, sproutKeyframes, swayKeyframes } from './keyframes';
import { burstDelay, SPROUT_MS } from './sprout';
import { SWAY_CYCLE_MS, SWAY_HOLD_MS, SWAY_LEAD_MS } from './sway';

/**
 * How a plant moves in a browser: the same two motions, handed to the
 * compositor instead of to `Animated`.
 *
 * This is `plantMotion.tsx`'s twin, on the `webInsets.tsx` precedent, and it
 * exists for a measured reason rather than a stylistic one.
 * `react-native-web` answers `TurboModuleRegistry.get()` with null, so
 * `shouldUseNativeDriver()` is false for every animation in the app and RNW's
 * `useAnimatedProps` falls back to `onUpdate = () => scheduleUpdate()` — a
 * React dispatch per animated view per frame. On a full bed that is a couple of
 * hundred renders and inline-style writes a frame, each one invalidating an
 * `<svg>` subtree. Measured at 411x911 with 109 plants: 33.3ms a frame with the
 * wind blowing, 16.7ms the moment its turn ended. The sway alone halved the
 * frame rate. CSS keyframes cost nothing per frame at all.
 *
 * **Nothing here is a second animation**, and the correspondences are exact
 * rather than close:
 *
 * - `animation-timing-function: linear` between stops *is*
 *   `Animated.interpolate`'s piecewise-linear table — both draw straight lines
 *   between the numbers they were given;
 * - `animation-fill-mode: both` *is* `extrapolate: 'clamp'` — before the
 *   window the first frame, after it the last;
 * - each plant's `animation-delay` *is* the burst window
 *   `(delayMs + at * SPROUT_MS) / BURST_MS` that `Sprout` computes, stated as a
 *   time rather than as a slice of a shared clock;
 * - the wind's loop closes without a seam because every plant's table ends
 *   where it began, which `sway.test.ts` pins for both renderers at once.
 *
 * **`tsc` never checks this file against its twin.** It resolves
 * `./plantMotion` to the native one, so a prop-shape drift here compiles clean
 * and fails only in a browser. `useGardenMotion` and `PlantMotion` take exactly
 * the same arguments on both sides and `GardenMotion` is opaque to the caller.
 * Keep it that way by hand.
 *
 * **Never put two animations on one element here.** It is the tidy-looking
 * refactor, because the wind arrives in two stretches and CSS lets an element
 * carry a list of animations — and it costs the whole of the above. Two
 * animations targeting the same property take the element off the compositor
 * and onto the main thread: measured on the same 109 plants at 411x911, one
 * animation on the lean holds a steady 16.7ms a frame, and two take it to
 * 83–99ms with p95s of 134–183 and frames as long as 384. The arrangement
 * below therefore swaps one animation for the other rather than layering them,
 * which is why `arrived` exists. (If anyone tries it anyway: only
 * `animationKeyframes` compiles from an array — every other `animation*`
 * property has to be a comma-separated string, or RNW emits repeated
 * declarations and the last silently wins.)
 */

/**
 * The animation properties `react-native-web` understands and React Native's
 * own `ViewStyle` has never heard of.
 *
 * Narrow on purpose. This is the one seam between the two style languages, not
 * a licence to write CSS wherever it would be convenient — everything else in
 * this app is a style both platforms agree about.
 */
type WebAnimation = {
  /**
   * One block. An element here carries one animation at a time, for the
   * compositing reason above, so the list form RNW also accepts is deliberately
   * not in this type.
   */
  animationKeyframes?: Keyframes;
  animationDuration?: string;
  animationDelay?: string;
  animationIterationCount?: string;
  animationTimingFunction?: string;
  animationFillMode?: string;
  animationPlayState?: 'running' | 'paused';
};

/**
 * A style as this file writes it: React Native's, with the animation half
 * replaced rather than added to.
 *
 * Replaced because React Native now types some of these itself and types them
 * for its own animation implementation — `animationIterationCount` is
 * `'infinite' | number[]` there, which cannot say `'1, infinite'`. Intersecting
 * would leave the narrower of the two in force and rule out exactly the values
 * a browser needs, so the web's reading wins on the web file's own styles.
 */
type WebViewStyle = Omit<ViewStyle, keyof WebAnimation> & WebAnimation;

/**
 * One style through `StyleSheet.create`, which is not optional here.
 *
 * RNW compiles an *inline* style object with a path that has no support for
 * `animationKeyframes` at all — the property is quietly dropped and the plant
 * simply never moves. Only a registered style reaches the compiler that emits
 * an `@keyframes` rule and points `animation-name` at it.
 *
 * It is also where the whole cost of this file lands: `create` hashes the
 * keyframes object with `JSON.stringify` and inserts rules into the document's
 * stylesheet, which is a thing to pay once and never per render. Everything
 * below it is memoised on the way in.
 */
function webStyle(style: WebViewStyle): ViewStyle {
  // The one cast in this file, and it is the seam itself: what goes in is a
  // style written in CSS's vocabulary, what comes out is a registered style a
  // `View` will take. Nothing downstream needs to know the difference.
  return StyleSheet.create({ style: style as ViewStyle }).style;
}

/**
 * Whether the wind is turning, as its own rule.
 *
 * Held apart from the lean itself so that a hundred and eight plants share one
 * declaration instead of each carrying a second copy of its own keyframes —
 * RNW compiles a style property at a time, so this is one class name that flips
 * on and off under every plant at once.
 *
 * `paused` freezes an animation where it stands and resumes it there. Leaving
 * the tab also winds the wind's arrival back to the beginning, so what actually
 * resumes is a plant standing upright waiting out the hold again — which is
 * what the phone does when its clock returns to `-SWAY_LEAD_SHARE`, and is why
 * the two platforms say the same thing about coming back to the garden.
 */
const CLOCK = {
  running: webStyle({ animationPlayState: 'running' }),
  paused: webStyle({ animationPlayState: 'paused' }),
};

/** The two styles a plant wears in turn, built and cached together. */
type Lean = { arrival: ViewStyle; loop: ViewStyle };

/**
 * Every style built so far, by the plant and where it stands.
 *
 * The cache is what makes `StyleSheet.create`'s hashing and rule insertion a
 * mount-time cost rather than a render-time one, and it is honest for
 * `swayTrack`'s reason: these are pure functions of their arguments, so a
 * remembered answer and a fresh one are the same rule.
 *
 * A plant's two leans are held as one entry rather than two maps, which is what
 * makes them impossible to build separately — see `leanStyles`.
 */
const LEANS = new Map<string, Lean>();
const GROWTHS = new Map<number, ViewStyle>();

/**
 * How long after the ramp should have ended the swap is made.
 *
 * The margin is deliberately one-sided. **Late is free**: the arrival's
 * `forwards` fill is already holding the exact angle the loop starts from, so
 * a swap landing any time after the ramp has finished replaces one still
 * picture with an identical one. **Early is not**: the loop would begin at its
 * own 0% while the ramp was still short of that angle, which is a step you can
 * see. A timer that fires a frame or two late is therefore a non-event, and one
 * that fires early is a bug — so it is aimed past the end rather than at it.
 */
const SWAP_MARGIN_MS = 50;

/**
 * Both of one plant's leans: the wind picking it up, and the wind itself.
 *
 * A phone does the whole arrival with one clock and a knot at a negative
 * position. CSS cannot loop a sub-range, so here it is two styles the element
 * wears in turn — and in turn rather than together, because two animations on
 * one property is what took the field off the compositor.
 *
 * **They are built together even though only one is wanted yet, and that is the
 * point of this function rather than an inefficiency in it.** "Build what you
 * need when you need it" is the instinct and it is wrong here for three reasons
 * at once: the loop's rule is enormous — a hundred and sixty-one stops per
 * plant, near a megabyte of CSS text across a full bed — it is certain to be
 * needed about three seconds later, and the moment it would otherwise be built
 * is the swap, which is the one instant on this screen where a stall is
 * guaranteed to be seen. Built lazily it measured a 2.2 second frame dropped
 * into the middle of the wind arriving; built here it lands with the field's
 * first paint, where a garden is already appearing and the work is invisible,
 * and the swap is reduced to a class name changing.
 *
 * What it costs where it now lands is 181ms for a full bed of a hundred and
 * nine, of which the keyframes themselves are 37ms and the rest is
 * `StyleSheet.create` hashing each block and putting it in the document. That
 * is a real fifth of a second and it is spent once per load, under the
 * splash-to-garden transition rather than in front of anybody — which is the
 * whole argument for building it here and not later.
 *
 * Held as one cache entry rather than two maps so that this cannot quietly come
 * apart again: there is no way to ask for the arrival without the loop.
 *
 * The arrival's **backwards** fill is the upright fix — through the delay the
 * element shows its 0%, which is `0deg`, so a plant grows straight up and
 * stands there for the beat instead of tilting to whatever angle its loop
 * begins at. Its **forwards** half is what makes the swap safe: it goes on
 * holding the ramp's last angle, which is the angle the loop starts from, so
 * the two are one still picture at the moment one replaces the other. The loop
 * therefore takes no delay — the waiting was the arrival's job and is over.
 */
function leanStyles(slot: number, col: number, row: number): Lean {
  const key = `${slot}:${col}:${row}`;
  const known = LEANS.get(key);
  if (known) return known;

  const lean: Lean = {
    arrival: webStyle({
      // The root, as everywhere else a plant is transformed. RNW turns the
      // array into a CSS origin itself, so the native file's reason for never
      // writing it as a string does not arise here — but the value is shared,
      // so it is the same array either way.
      transformOrigin: ROOT_ORIGIN,
      animationKeyframes: arrivalKeyframes(slot, col, row),
      animationDuration: `${SWAY_LEAD_MS}ms`,
      animationDelay: `${SWAY_HOLD_MS}ms`,
      animationIterationCount: '1',
      animationTimingFunction: 'ease-out',
      animationFillMode: 'both',
    }),
    loop: webStyle({
      transformOrigin: ROOT_ORIGIN,
      animationKeyframes: swayKeyframes(slot, col, row),
      animationDuration: `${SWAY_CYCLE_MS}ms`,
      animationIterationCount: 'infinite',
      animationTimingFunction: 'linear',
    }),
  };

  LEANS.set(key, lean);
  return lean;
}

function growthStyle(slot: number): ViewStyle {
  const known = GROWTHS.get(slot);
  if (known) return known;

  const style = webStyle({
    transformOrigin: ROOT_ORIGIN,
    // The same block for every plant in the garden — only the delay below
    // differs — so RNW's content hash gives the whole field one `@keyframes`
    // rule between them.
    animationKeyframes: sproutKeyframes(),
    animationDuration: `${SPROUT_MS}ms`,
    animationDelay: `${burstDelay(slot)}ms`,
    animationFillMode: 'both',
    animationTimingFunction: 'linear',
  });

  GROWTHS.set(slot, style);
  return style;
}

/**
 * What the elements below need, which on this platform is no clock at all.
 *
 * A CSS animation runs itself, so there is nothing to start, nothing to stop
 * and nothing that can outlive the views reading it — the whole ownership rule
 * the native twin is built around simply has no purchase here. What is left is
 * three facts passed straight through.
 */
export type GardenMotion = {
  /** The entrance token, or null on a field that is only being drawn. */
  burst: number | null;
  /** Whether this field is in the wind at all — the half that decides structure. */
  windy: boolean;
  /** Whether the wind is blowing — the half that only starts and stops a clock. */
  swaying: boolean;
  /**
   * Whether the wind has finished picking the plants up, and so which of the
   * two lean styles they wear. It is the browser's stand-in for the phone's
   * clock crossing 0.
   */
  arrived: boolean;
};

export function useGardenMotion({
  burst,
  sway,
  ready,
}: {
  burst?: number;
  sway?: boolean;
  ready: boolean;
}): GardenMotion {
  const swaying = ready && sway === true;

  const [arrived, setArrived] = useState(false);

  /**
   * One timer for the whole grid, not one per plant.
   *
   * Every plant is picked up at the same moment — the hold and the lead-in are
   * the field's, not a slot's — so this is a single `setTimeout` and a single
   * re-render of the grid, once per visit. That render is the entire cost of
   * the arrangement, and it is what buys back the per-frame bill that two
   * animations on one element were charging on every plant.
   *
   * Not swaying winds it back rather than merely stopping it, which is what
   * makes returning to the tab replay the hold and the arrival. The phone does
   * exactly that by rewinding its clock to `-SWAY_LEAD_SHARE`, so this is the
   * two platforms agreeing rather than a web convenience. `setArrived(false)`
   * on a field that never arrived is a no-op React drops before rendering.
   */
  useEffect(() => {
    if (!swaying) {
      setArrived(false);
      return;
    }

    const swap = setTimeout(
      () => setArrived(true),
      SWAY_HOLD_MS + SWAY_LEAD_MS + SWAP_MARGIN_MS
    );

    return () => clearTimeout(swap);
  }, [swaying]);

  return {
    burst: burst === undefined ? null : burst,
    windy: sway !== undefined,
    swaying,
    arrived,
  };
}

/**
 * One plant, wearing whatever motion the field is in.
 *
 * The growth wrapper is **keyed on the burst token**, and that is the whole of
 * the replay. A CSS animation has no clock to rewind, and two keyframes objects
 * with the same content hash to the same rule, so there is nothing to restart
 * from the outside: keying the element is what makes React throw the old one
 * away and mount a fresh one with the animation at its beginning. It stays in
 * here rather than becoming something `PlantGrid` knows about — the grid asks
 * for the garden to grow in again, and how a platform obliges is this file's
 * business.
 *
 * The cost is that the plant's whole drawing is rebuilt on every visit to the
 * tab, which is a mount apiece rather than the render apiece per *frame* that
 * `Animated` was charging here — the trade this file exists to make, on a
 * smaller scale.
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
      <View key={motion.burst} style={growthStyle(slot)}>
        {children}
      </View>
    );

  if (!motion.windy) return <>{grown}</>;

  /*
   * Outside the growth, so a plant still growing leans by the same angle and
   * therefore a smaller distance — the composite is `skewX · scaleY`, exactly
   * as it is on a phone. The other way round the lean is unscaled and a
   * squashed plant swings as wide as a full one.
   *
   * One lean style at a time: the arrival, then the loop. Putting both on the
   * element at once is the arrangement this file's header warns against — it
   * reads better and costs five times the frame.
   */
  const lean = leanStyles(slot, col, row);

  return (
    <View
      style={[
        motion.arrived ? lean.loop : lean.arrival,
        motion.swaying ? CLOCK.running : CLOCK.paused,
      ]}>
      {grown}
    </View>
  );
}
