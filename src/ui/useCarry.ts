import { useMemo, useRef } from 'react';
import {
  Animated,
  GestureResponderHandlers,
  PanResponder,
  PanResponderGestureState,
} from 'react-native';

import {
  GRAB_SLOP,
  LIFT_CARRY,
  LIFT_PRESS,
  SPRING,
  THROW_DAMPING,
  armed,
  drawnTravel,
  leaves,
  smooth,
  throwSpeed,
} from './carry';
import { feel } from './feel';

/**
 * A card under a finger: what carries it, and the two places it can end up.
 *
 * `carry.ts` is the arithmetic and this is the hand laid on it — a pan
 * responder, a running velocity, and the one value everything on the screen
 * reads its position off. It holds no numbers of its own on purpose: every
 * constant it spends is imported, and a quantity this hook wanted and could not
 * find there would belong there rather than here, where it could not be checked
 * without a phone.
 *
 * The value is made in the hook, which is to say in the component that calls
 * it, and that is the rule rather than a convenience. React Native ties an
 * `Animated.Value`'s native node to the views reading it: when the last of them
 * detaches the node is dropped, and the next attach rebuilds it from a stale
 * JavaScript value with nothing driving it. A clock held anywhere but with its
 * views is one the platform will silently stop — it shipped once in the garden
 * and cost two wrong fixes to find.
 *
 * Everything that moves the value is **native-driven, without exception**. A
 * JS-driven animation on a value that has already been handed to the native
 * driver throws at runtime, on a phone, after the value has worked once — and
 * it will not reproduce in a browser, where the native module is missing and
 * `Animated` warns once and falls back to JavaScript. So the card is drawn with
 * a transform and nothing else, and the veil with an opacity, because those are
 * the two things the native driver can carry.
 */

/** What a screen gets back: where the card is, how to hold it, how to end it. */
export type Carry = {
  /**
   * How far the card is drawn below home, in points. The only thing that moves,
   * and the only input the veil has.
   */
  travel: Animated.Value;
  /**
   * How far off the page the card is being held, from 0 to `LIFT_CARRY`.
   *
   * A **step**, not a reading of `travel`: nothing, then `LIFT_PRESS` the moment
   * a finger lands, then `LIFT_CARRY` once the hand has committed to a carry,
   * then nothing again when it lets go. What makes it read as weight is that it
   * is sprung to each of those in turn and therefore always a little behind the
   * hand, which is the one thing in this gesture that is *allowed* to lag: the
   * card itself is assigned and exact, so the lag has to live somewhere else or
   * the card has no mass at all.
   *
   * Derived from `travel` it would be none of that. It would be rigid with the
   * position, so the card would sink as it came home rather than being set
   * down, and a card held still an inch down would be held at a different height
   * from the same card held still where it started.
   */
  lift: Animated.Value;
  /** Spread onto the view that *is* the card. */
  panHandlers: GestureResponderHandlers;
  /**
   * Play the exit, and when the card has gone run `then` — or `onLeave`, for a
   * door with nothing of its own to say.
   *
   * One way out and several doors onto it: the swipe finds it from the inside,
   * and a mark drawn on the card, a touch on the veil and the back key all call
   * this. It answers once and then ignores everybody, because the back key can
   * fire twice while the card is still leaving.
   *
   * Fixed for the life of the card, so an effect may depend on it — the freshest
   * `onLeave` is this hook's business rather than its caller's.
   */
  leave: (then?: () => void) => void;
};

export function useCarry({
  height,
  exit,
  onLeave,
}: {
  /** How tall the card is, which is what the threshold is a share of. */
  height: number;
  /** How far it has to travel to be off the bottom edge of what it stands in. */
  exit: number;
  /** What a departure with nothing else to say ends in. */
  onLeave: () => void;
}): Carry {
  const travel = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(0)).current;

  /*
    The responder is built once and its handlers close over whatever was in
    scope at the time, so everything that changes reaches them through a ref.
    None of it is state: not one of these is read while rendering, and a
    velocity that re-rendered the screen would re-render it under the thumb
    producing the velocity.
  */
  const geometry = useRef({ height, exit });
  geometry.current = { height, exit };
  const dismiss = useRef(onLeave);
  dismiss.current = onLeave;

  /** The smoothed velocity in points per millisecond, and when it last moved. */
  const speed = useRef(0);
  const movedAt = useRef(0);

  /** Whether the card is already on its way out. */
  const going = useRef(false);

  /** And whether this touch has become a carry rather than a press. */
  const carrying = useRef(false);

  /**
   * Whether the card is far enough down that letting go would send it.
   *
   * Held here rather than in `armed`, which is pure and has nowhere honest to
   * keep it, and kept as the *decision* rather than as a distance — see the tick
   * in `onPanResponderMove` for why that distinction is the whole point.
   */
  const latched = useRef(false);

  const gesture = useMemo(() => {
    /**
     * The lift, to each of its three heights in turn.
     *
     * `SNAP` because a hand does not negotiate: the card is either on the page,
     * under a finger, or being carried, and each of those arrives flat. The
     * spring is what puts the shade a frame or two behind the hand, which is
     * the whole of the weight — see `lift` above.
     */
    const raise = (toValue: number) => {
      Animated.spring(lift, { toValue, ...SPRING.SNAP, useNativeDriver: true }).start();
    };

    const home = (velocity: number) => {
      Animated.spring(travel, {
        toValue: 0,
        velocity,
        ...SPRING.SETTLE,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) feel('drop');
      });
    };

    /**
     * The exit, from wherever the card is and with whatever it was thrown at.
     *
     * `overshootClamping` is what makes "gone" an event rather than an
     * asymptote. `GLIDE` sits a hair under critical, so left alone it would
     * pass the edge, come back six tenths of a millimetre and then spend the
     * better part of a second creeping into the default rest threshold of a
     * thousandth of a point — with the card long since off the screen and the
     * sheet still mounted over a sitting. Clamped, it ends the moment the card
     * has cleared the edge, and the give it gives up is give nobody can see,
     * because it happens past the bottom of the screen.
     */
    const depart = ({
      velocity = 0,
      then,
      byHand = false,
    }: { velocity?: number; then?: () => void; byHand?: boolean } = {}) => {
      if (going.current) return;
      going.current = true;

      // Whether the keyboard should be put away here, on the commit rather than
      // on the grab, is still open. It is deliberately not decided.

      Animated.spring(travel, {
        toValue: geometry.current.exit,
        velocity,
        ...SPRING.GLIDE,
        overshootClamping: true,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        /*
          Only a card that was thrown lands. Reaching the bottom edge is the
          same event either way, but the arrow, the veil and the back key are
          taps, and this app answers a tap with an opacity change and a point of
          travel — a buzz for one of those would be a fourth sensation wearing
          the third one's name.
        */
        if (byHand) feel('drop');
        (then ?? dismiss.current)();
      });
    };

    /**
     * A finger lifted, and the one decision it makes.
     *
     * The throw is the *smoothed* running velocity rather than
     * `gestureState.vy`, which is the last sample's delta and is exactly what
     * `smooth` exists not to be — one jittery frame at the release would
     * otherwise throw the card off the screen. It is read undamped for the
     * decision and damped for the spring: how far the card was going to get is
     * a question about the finger, and how hard the paper is thrown is a
     * question about paper.
     */
    const settle = (state: PanResponderGestureState) => {
      const { height: tall } = geometry.current;
      const carried = drawnTravel(state.dy, tall);
      const speedPerSecond = throwSpeed(speed.current, Date.now() - movedAt.current);
      const thrown = speedPerSecond * THROW_DAMPING;

      raise(0);
      if (leaves(carried, speedPerSecond, tall)) depart({ velocity: thrown, byHand: true });
      else home(thrown);
    };

    const responder = PanResponder.create({
      /*
        Not the capture form, which is what makes the text field still work.
        React Native accumulates `onStartShouldSetResponderCapture` outermost
        first and then `onStartShouldSetResponder` **innermost** first, taking
        the first that answers true — and a `TextInput` supplies its own, deeper
        than this one. So the field keeps its caret, its selection and its
        scrolling, and the card gets every touch that is not on a control.

        Asked in the capture phase instead, this would answer first and swallow
        all three, which looks like a text field that has stopped accepting
        touches rather than like a gesture in the wrong place.
      */
      onStartShouldSetPanResponder: () => !going.current,

      /*
        And `onMoveShouldSetPanResponder` is deliberately absent. Set true it
        steals a drag that *began* inside the field on the first move, which
        still leaves a tap focusing the field — so it looks entirely correct
        until somebody writes more than fits on the card and tries to scroll it
        back.
      */

      onPanResponderGrant: () => {
        speed.current = 0;
        movedAt.current = Date.now();
        carrying.current = false;
        latched.current = false;
        raise(LIFT_PRESS);

        /*
          Contact, before the card has been asked to go anywhere. A surface that
          answers being touched is a surface, and this is the cheapest
          convincing thing in the whole gesture — it costs one call and it is
          the moment the card stops being a picture.
        */
        feel('pickup');
      },

      onPanResponderMove: (_event, state) => {
        speed.current = smooth(speed.current, state.vy);
        movedAt.current = Date.now();

        /*
          Where `GRAB_SLOP` earns its place, and the only thing in the gesture
          that waits for it. The card is drawn from the very first move because
          a carried card has to be under the finger, but how far *off the page*
          it is being held is a question about intent, and a thumb resting on
          paper wanders a point or two without meaning anything by it.
        */
        if (!carrying.current && Math.hypot(state.dx, state.dy) > GRAB_SLOP) {
          carrying.current = true;
          raise(LIFT_CARRY);
        }

        /*
          Assigned rather than sprung: the finger *is* the position, and a
          spring chasing it lags by its own settle time however carefully it is
          tuned. `setValue` also stops whatever was running on the value, which
          is what lets a card still on its way home be caught and carried again
          without anything having to know it was in flight.
        */
        const carried = drawnTravel(state.dy, geometry.current.height);
        travel.setValue(carried);

        /*
          And the one moment in the carry the card has something to say: it has
          come far enough that letting go would send it.

          Edge-triggered on the *decision* and never on a distance, which is the
          whole reason `armed` takes the previous answer. A comparison against a
          number is re-crossed by anything that passes back through it — a
          finger holding on the line, a spring ringing home — and each crossing
          is another tick under a thumb that did one thing once. The latch has
          the hysteresis; this only has to notice it turning over.
        */
        const far = armed(carried, geometry.current.height, latched.current);
        if (far && !latched.current) feel('tick');
        latched.current = far;
      },

      onPanResponderRelease: (_event, state) => settle(state),

      /*
        Nothing may take the card out of a hand that is still holding it. What
        can still terminate the gesture is the platform losing the touch
        outright, and that runs the same path as a release that stays: a card
        left in mid-air is a failure with no visible cause, and an interruption
        is not somebody asking for the note to go.
      */
      onPanResponderTerminationRequest: () => false,
      onPanResponderTerminate: () => {
        raise(0);
        home(0);
      },
    });

    return {
      panHandlers: responder.panHandlers,
      leave: (then?: () => void) => depart({ then }),
    };
  }, [travel, lift]);

  return { travel, lift, panHandlers: gesture.panHandlers, leave: gesture.leave };
}
