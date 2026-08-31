import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Note } from '../store/types';
import { radius, space } from '../theme/tokens';
import { type } from '../theme/typography';
import { useColor } from '../theme/useColor';
import { Button } from './Button';
import { SHADE, SHADE_BLUR, SHADE_INSET, threshold, veilStops } from './carry';
import { fieldReset } from './fieldReset';
import { ArrowLeft } from './icons';
import { Fade, Rise } from './motion';
import { Text } from './Text';
import { formatDay } from './time';
import { useCarry } from './useCarry';
import { useKeyboardUp } from './useKeyboardUp';
import { useOrganicCorners } from './useOrganicCorners';

/**
 * A small sheet of paper raised over whatever screen you are on.
 *
 * It is the app's card — paper-deep, organic corners, no border — arriving from
 * the bottom rather than being laid on the page, and that is the whole of what
 * it is: not a modal, not a dialog, and not a route. A sitting continues
 * underneath it and a garden goes on swaying, because neither has been left.
 *
 * Two things are raised on it, and they are the same object read and written:
 * `NoteCapture` catches a thought during a sitting, `NoteReader` shows one back
 * where its plant grew. The sheet owns everything they share — the veil, the
 * entrance, the keyboard, the corners — so neither has any layout of its own.
 * It also owns what shape the card is, which is the one thing its two contents
 * disagree about.
 *
 * The card is carried rather than merely shown: it follows a finger exactly,
 * resists being pushed up, and pulled far enough down it leaves on the momentum
 * it was given. `useCarry` is the gesture and `carry.ts` is the arithmetic under
 * it; what this file adds is the two things only a screen knows — how far the
 * bottom edge is, and that the veil goes with the card rather than on a curve of
 * its own.
 *
 * It is also the one thing in this app that casts a shadow, which is the whole
 * of that licence and is spent on being *held* rather than on being important —
 * the `shadow` token in `themes.ts` says where it stops.
 *
 * **Nothing about that reads as discarding a thought.** The swipe is finish, not
 * discard: what is written is already the caller's, kept on every change, and
 * the bell puts it down independently of anything this sheet does. There is no
 * copy about it and no confirmation, because there is nothing to confirm.
 */

/**
 * How a mark drawn on the card asks the sheet to leave.
 *
 * The swipe, the arrow, the veil and the Android back key are four doors onto
 * one way out. Three of them are the sheet's own; the fourth is drawn by
 * whatever is on the card, which cannot play an exit it does not own — so it
 * asks, and hands over what to do once the card has gone. The alternative,
 * where the swipe animates and the other three cut, gives one action two
 * characters.
 *
 * The default does the thing at once, which is what a card rendered outside a
 * sheet would have to mean. Nothing renders one; it is what keeps the pieces
 * separable.
 */
const Exit = createContext<(then: () => void) => void>((then) => then());

/**
 * How far the veil dims what is behind it.
 *
 * Paper over paper rather than ink over paper: the screen goes quiet by being
 * washed out, not by being put in shadow.
 *
 * The card above it now casts a real one, and that is not this. A shadow says
 * where a thing is standing; a veil says a screen has been set aside for a
 * moment, and darkening it would say the screen was under something rather than
 * behind it. Nothing on this page is put in shade except by the card that is
 * being held.
 */
const VEIL = 0.55;

/** Far enough that the card reads as coming from off the bottom of the screen. */
const CARD_RISE = 28;

/**
 * How long the shade waits before it inks in, which is how long `Rise` takes.
 *
 * Written down here because `motion.tsx` does not hand its duration out, and
 * the two have to agree only in one direction: waiting a little too long costs
 * nothing, and going early costs the frame this is here to avoid. So it is the
 * entrance's own 220ms rather than a number of its own.
 */
const SHADE_WAIT = 220;

/**
 * An index card: taller than it is wide, and a good deal narrower than the
 * screen.
 *
 * Both halves are the point. A card the width of the page reads as a bar across
 * it however short it is, and the veil left either side is what says this is a
 * small thing being done on top of something else.
 */
const NOTE_WIDTH_SHARE = 0.64;
const NOTE_ASPECT = 3 / 4;

export function NoteSheet({
  onDismiss,
  lift = 0,
  card = 'hug',
  children,
}: {
  /**
   * The card has gone — called once, at the end of the exit, whichever door
   * asked for it. Never destructive; see callers.
   */
  onDismiss: () => void;
  /**
   * Room to leave under the card.
   *
   * The Garden tab's navigation floats over the foot of the page and is drawn
   * by the navigator, above anything a screen renders — so a card sitting on
   * the bottom edge would come up underneath it. Screens outside the tabs pass
   * nothing.
   */
  lift?: number;
  /**
   * What shape the card is. The two values are one decision rather than two
   * knobs.
   *
   * `hug` is a card the size of the thought on it, spread across the screen and
   * docked at the foot of it — a note being read. `note` is an index card, 3:4
   * and narrower than the screen, floated in the middle of whatever the
   * keyboard leaves — a note being written.
   */
  card?: 'hug' | 'note';
  children: ReactNode;
}) {
  const color = useColor();
  const insets = useSafeAreaInsets();
  const corners = useOrganicCorners(radius.lg);
  const keyboardUp = useKeyboardUp();
  const { width, height: screenHeight } = useWindowDimensions();

  const note = card === 'note';

  /*
    Two plain layouts and no `measureInWindow`: how tall the stage is, and where
    the card stands in it. Those two are the whole of what the carry needs — the
    exit is the room left under the card, and the threshold is a share of its
    height — and a callback that answers on the next layout pass is worth more
    here than a measurement that answers a frame later.

    Both are guarded on change, because the run screen re-renders four times a
    second for as long as this is open and neither number moves with a clock.
  */
  const [stageHeight, setStageHeight] = useState(0);
  const [box, setBox] = useState({ top: 0, height: 0 });

  const measureStage = useCallback((e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.height;
    setStageHeight((was) => (was === next ? was : next));
  }, []);

  const measureCard = useCallback((e: LayoutChangeEvent) => {
    const { y, height } = e.nativeEvent.layout;
    setBox((was) => (was.top === y && was.height === height ? was : { top: y, height }));
  }, []);

  /**
   * How far the card has to travel to be gone.
   *
   * The stage ends where the keyboard begins, because `KeyboardAvoidingView`
   * pads the foot of it — so a card carried out from under a raised keyboard is
   * hidden *by* the keyboard rather than by the screen's edge. That is the same
   * departure drawn by whatever happens to be nearest, and it is why this is
   * measured against the stage rather than against the window.
   *
   * The window's own height stands in until the first layout. It is an
   * over-estimate of a distance nobody can ask for yet: the card cannot be
   * touched before it has been drawn, and drawing it is what answers this.
   */
  const exit = stageHeight > 0 ? stageHeight - box.top : screenHeight;

  const carry = useCarry({ height: box.height, exit, onLeave: onDismiss });
  const { leave } = carry;

  /**
   * The Android back key is the fourth door onto that one way out.
   *
   * The sheet is not a route, so nothing else answers back while it is up — and
   * what the navigator would answer with on the run screen is the end of a
   * sitting, without a word. The keyboard eats the first press itself; this is
   * what answers the second, and `leave` is what stops a second press landing
   * on a card that is already going.
   *
   * It subscribes once rather than four times a second with the run screen's
   * clock, because `leave` is fixed for the life of the card and the freshness
   * of `onDismiss` is `useCarry`'s business rather than this effect's.
   * `BackHandler` is a no-op on iOS and web.
   */
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      leave();
      return true;
    });
    return () => sub.remove();
  }, [leave]);

  /*
    The width is a share of the screen and the height follows from it, so a
    narrow phone gets a proportionally narrower card rather than a clipped one,
    and however many lines fit is however many fit. `maxHeight` is what caps it
    against the room the keyboard leaves on a short screen, rather than luck.

    It goes on the held box rather than on the card, and the reason is the
    percentage: it resolves against a parent with a *definite* height, and every
    box between here and the card is sized by its child. The stage is the
    nearest one that knows how tall it is, so the shape has to sit on the
    stage's own child — set any lower it would measure itself against an auto
    height and silently do nothing.
  */
  const noteShape: ViewStyle = {
    width: Math.round(width * NOTE_WIDTH_SHARE),
    aspectRatio: NOTE_ASPECT,
    maxHeight: '100%',
  };

  /**
   * The floor the card stands on, which a raised keyboard takes away rather
   * than adds to. The keyboard stands on the navigation bar and covers the
   * floating nav with it, so an inset held for either while it is up is an
   * inset held twice — the card would float a bar's height above a keyboard it
   * is already clear of.
   */
  const floor = (keyboardUp ? 0 : insets.bottom + lift) + space.md;

  /*
    The veil goes with the card — one departure and not two — so it is the
    card's own position read piecewise rather than a second curve timed to
    agree with the first. It holds while the card is being carried, thins by the
    time the card is far enough to go, and is gone by the time it has.

    `Fade` still owns the entrance, so what this carries is the *share* of the
    veil that is left and the two opacities multiply: asking `veilStops` for a
    full veil of 1 is what keeps the resting veil at `VEIL` rather than at
    `VEIL` squared. `clamp` because the default extends at both ends, and an
    extended left end would take the veil past full while the card was being
    pulled upward.
  */
  const remaining = useMemo(() => {
    return carry.travel.interpolate({
      ...veilStops(1, threshold(box.height), exit),
      extrapolate: 'clamp',
    });
  }, [carry.travel, box.height, exit]);

  /*
    Memoised because `AnimatedProps` keys on node identity, and this screen
    re-renders four times a second for as long as the card is open — a style
    minted in the render body would build a fresh native node graph on every
    tick of the clock behind it.
  */
  const carried = useMemo(
    () => ({ transform: [{ translateY: carry.travel }] }),
    [carry.travel]
  );

  /*
    A shadow cannot arrive before the thing casting it, and on Android it would
    arrive *through* it. `Rise` fades the card in, and React Native's Android
    view group applies a parent's opacity to each child in turn rather than
    compositing the subtree and fading that — `needsOffscreenAlphaCompositing`
    is the prop that would change it and defaults to false — so for the two or
    three frames the card is translucent, the darkest part of the shade, which
    lives under the card by design, would show straight through it as a ring.

    So the shade waits out the entrance and then inks in. It is its own value
    rather than a `Fade` because what it needs is the delay: fading in alongside
    the card would put the two at half strength at the same moment, which is the
    frame that shows the ring.
  */
  const arrived = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.timing(arrived, {
      toValue: 1,
      duration: 160,
      delay: SHADE_WAIT,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [arrived]);

  /*
    What the card casts while it is held. Three channels off one stepped value,
    and every one of them memoised for the reason above.
  */
  const shade = useMemo(() => {
    const at = SHADE.map((row) => row.at);
    const read = (of: (row: (typeof SHADE)[number]) => number) =>
      carry.lift.interpolate({ inputRange: at, outputRange: SHADE.map(of), extrapolate: 'clamp' });

    return {
      opacity: Animated.multiply(read((row) => row.opacity), arrived),
      transform: [
        { translateY: read((row) => row.rise) },
        { scale: read((row) => row.scale) },
      ],
    };
  }, [carry.lift, arrived]);

  return (
    <Exit.Provider value={leave}>
      <View style={StyleSheet.absoluteFill}>
        <Fade to={VEIL} style={StyleSheet.absoluteFill}>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: color.paper, opacity: remaining },
            ]}
          />
        </Fade>

        {/*
          Padding on both platforms, and Android is no longer the exception it
          was: `edgeToEdgeEnabled` has been on and non-optional since SDK 54, so
          the window is not resized for the keyboard whatever the manifest still
          says about `adjustResize` — asking for nothing there lifted nothing.

          One behaviour serves both because this measures rather than asks. RN
          pads by the overlap between its own frame and the keyboard's `screenY`,
          so nothing here has to know how tall a keyboard is or whether the height
          it reports counts the navigation bar (on Android it does not).

          That reading needs this view's frame to *be* the screen's, which is what
          the absolute fill on the screen's root is for. Moved inside `Screen`'s
          padded box it would go on working and silently under-lift the card by
          the top inset.
        */}
        <KeyboardAvoidingView style={StyleSheet.absoluteFill} behavior="padding">
          {/*
            The whole veil answers a touch, where only the strip above the card
            used to. A centred card has veil below it as well, and a patch that
            answered nothing would be the one part of the screen that ignores you
            — which retires the same dead patch under a docked card too.
          */}
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel="Put it away"
            onPress={() => leave()}
          />
          <View
            pointerEvents="box-none"
            onLayout={measureStage}
            style={[
              styles.stage,
              note ? styles.middle : styles.dock,
              { paddingTop: insets.top, paddingBottom: floor },
            ]}>
            {/*
              The card as a thing that can be held, which is why the shape is on
              it and `Rise` is inside rather than around it.

              Two constraints meet here and only this order satisfies both. A
              percentage `maxHeight` resolves against a parent with a *definite*
              height, and the stage is the nearest box that knows how tall it is —
              so whatever carries `noteShape` has to be the stage's own child, or
              it measures itself against an auto height and silently does nothing.
              And the position the exit is measured from has to be a layout the
              stage reports, which is only true of a view the stage is the parent
              of: `onLayout` answers relative to the parent, so the same reading
              taken one level down would be zero for ever.

              `Rise` goes inside because it owns its own value, exposes nothing,
              and applies a caller's style *after* its own transform — a transform
              handed through it would clobber the entrance. Nothing is handed
              through it here but `flex: 1`, and it goes on translating the card
              within a box that is already the right size.
            */}
            <Animated.View
              {...carry.panHandlers}
              onLayout={measureCard}
              style={[note ? noteShape : styles.dock, carried]}>
              {/*
                What the card casts, and the app's first shadow of any kind —
                see the `shadow` token in `themes.ts` for what that licence
                covers and where it stops.

                A view of its own rather than a `boxShadow` on the card, and
                that is forced rather than chosen: only transform and opacity
                ride the native driver, so a shadow that has to answer a finger
                cannot be a property of the thing the finger is moving. Its
                softness cannot change either — **React Native has no
                interpolatable blur, and setting one animates nothing without
                complaining** — so it is baked at one blur and the spreading is
                done by scaling it, which widens the rendered blur with the box.

                Where that box sits is the whole trick, and it is written up
                under `SHADE_INSET`: set well inside the card, so the shadow's
                own bright edge is hidden under the paper and only its reach
                comes out from under the sides.

                `corners` is the card's own set rather than a second call to
                `useOrganicCorners`, which seeds off `useId` and would put a
                differently-shaped card behind this one. The inset makes them an
                approximation of each other, and twenty-eight points of blur is
                a long way past caring.
              */}
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.shade,
                  corners,
                  shade,
                  {
                    boxShadow: [
                      { offsetX: 0, offsetY: 0, blurRadius: SHADE_BLUR, color: color.shadow },
                    ],
                  },
                ]}
              />
              <Rise from={CARD_RISE} style={note ? styles.filling : undefined}>
                <View
                  style={[
                    styles.card,
                    note && styles.filling,
                    corners,
                    { backgroundColor: color.paperDeep },
                  ]}>
                  {children}
                </View>
              </Rise>
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Exit.Provider>
  );
}

/** Small enough to read as a mark on the card rather than as a control. */
const ARROW_SIZE = 24;

/** How anything drawn on the card gets the sheet's one way out. */
function useExit() {
  return useContext(Exit);
}

/**
 * A thought, caught during a sitting.
 *
 * The text lives here rather than on the screen above, and that is deliberate
 * twice over. A text field's contents are a view's business; and the run screen
 * recomputes a clock four times a second, so re-rendering it on every keystroke
 * would put the timer behind the keyboard. What the screen is told is every
 * change, so that it holds a copy it can put down at any moment — including the
 * moment the bell rings, which is the one thing that must not cost a thought.
 *
 * There is no second field and no title. A note caught mid-sitting is something
 * you are putting down so you can stop carrying it, and a form would be an
 * invitation to compose something. What there is instead of a single line is a
 * few of them: the field wraps and fills the card, because a thought is as long
 * as it is and one line put everything past the card's edge somewhere you could
 * not see it. Past the last line it scrolls inside the card, which is what
 * keeps the caret in front of you rather than walking it off the bottom.
 */
export function NoteCapture({
  onChange,
  onDone,
}: {
  onChange: (body: string) => void;
  /**
   * Put it down. Empty is a perfectly good answer.
   *
   * The sheet plays the exit first, so this runs once the card has gone rather
   * than at the touch that started it going.
   */
  onDone: () => void;
}) {
  const color = useColor();
  const exit = useExit();
  const [body, setBody] = useState('');

  const change = (next: string) => {
    setBody(next);
    onChange(next);
  };

  return (
    <>
      {/*
        The way out, and the only one the card draws. The veil, this arrow and
        the word that used to sit at the foot were three ways out of one small
        card; what is left is the mark this app already uses for "out of here",
        which is the sentence the notes screen makes when it says the back arrow
        is the only "done".

        Not `BackHeader`, whose `paddingVertical` is the air around a screen's
        title and would be a fifth of a card this small.

        It keeps its own touches because the responder system asks the deepest
        view first, and this is deeper than the box the carry is attached to.
        Its `hitSlop` is part of the target, so the top-left of the card is
        about a 56pt square that answers a tap rather than a drag, and the rest
        of that row carries the card. That is the right way round — the arrow is
        a small mark and needs the reach more than the paper does — but it is
        worth knowing rather than discovering.
      */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Put it away"
        onPress={() => exit(onDone)}
        hitSlop={space.md}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
        <ArrowLeft color={color.ink} size={ARROW_SIZE} />
      </Pressable>

      {/*
        A TextInput is not `Text`, so it cannot name a variant — it reads the
        row out of the type scale by hand, and it is still typography.ts that
        decides. `hand` rather than `body`, because what is typed here is the
        user's own and the app gives it back in the face it was thought in.

        `fieldReset` is the browser's focus ring and nothing else. On a phone
        it is empty, which is what a phone has to say about focus rings.
      */}
      <TextInput
        /*
          The field claims its own touches, and the card carries every other
          one. On a phone this line does nothing at all: `TextInput` renders
          through `usePressability`, whose `onStartShouldSetResponder` answers
          true and is spread *after* anything a caller passes, and the responder
          system asks the deepest view first — so the field would keep the caret,
          the selection and the scroll whatever was written here.

          It is `react-native-web` that needs it, and the divergence is worth
          knowing because it makes the preview lie in the direction of "it
          works". RNW's `TextInput` joins the responder system with the handlers
          it is *given* and supplies none of its own, since a real `<textarea>`
          does its own focusing — so with this absent, nothing at the field
          answers, the touch reaches the box the carry is on, and a drag begun
          on the text drags the card away instead of scrolling the thought. That
          is the same failure `onMoveShouldSetPanResponder` would cause on a
          phone, arriving through a different door.
        */
        onStartShouldSetResponder={() => true}
        style={[type.hand, styles.input, fieldReset, { color: color.ink }]}
        value={body}
        onChangeText={change}
        placeholder="catch it, then let it go"
        placeholderTextColor={color.inkFaint}
        autoFocus
        multiline
        // Android centres a tall field's text without this, which puts the first
        // line down the middle of the card and only on that platform.
        textAlignVertical="top"
        // The bell may ring while this is open, and a correction offered on the
        // way out is a word changed after the user stopped looking.
        autoCorrect={false}
      />
    </>
  );
}

/**
 * A note, read back where its plant grew.
 *
 * Read-only on purpose: this is the garden, and the garden is a record. Editing
 * happens on the notes screen, which is what `open` is for.
 */
export function NoteReader({
  note,
  onOpen,
  onClose,
}: {
  note: Note;
  /** The notes screen, which is a place to go rather than a card to put down. */
  onOpen: () => void;
  /** Put it back. The sheet plays the exit; this runs once the card has gone. */
  onClose: () => void;
}) {
  const exit = useExit();

  return (
    <>
      <Text variant="hand">{note.body}</Text>
      <View style={styles.meta}>
        <Text variant="caption" color="inkFaint">
          {formatDay(note.createdAt)}
        </Text>
        <View style={styles.actions}>
          <Button label="open" variant="quiet" onPress={onOpen} style={styles.action} />
          <Button
            label="close"
            variant="quiet"
            onPress={() => exit(onClose)}
            style={styles.action}
          />
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  /** Where the card stands: at the foot of the screen, or in the middle of it. */
  stage: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  /**
   * Centred across the screen as well as down it, which is what a card narrower
   * than the screen needs and a full-width one never did.
   */
  middle: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  /**
   * The page's gutter, which a docked card needs and a card with its own width
   * does not.
   *
   * It sits on the stage rather than on the held box, and that is the shade's
   * doing rather than tidiness. Yoga insets an absolutely positioned child by
   * its parent's padding and a browser does not, so a gutter on the box the
   * shade is placed against would put the shade sixteen points further in on a
   * phone than in the preview — which is a halo around the resting card on
   * exactly one of the two targets this app is judged on. With the padding a
   * level up, the held box *is* the card's box in both shapes and the inset
   * means one thing everywhere.
   */
  dock: {
    paddingHorizontal: space.md,
  },
  card: {
    padding: space.lg,
  },
  /** The card takes the shape its entrance was cut to — see `noteShape`. */
  filling: {
    flex: 1,
  },
  /**
   * The shade's box, which is deliberately not the card's: it is inset on every
   * side so that the shadow it casts starts under the paper. `SHADE_INSET`
   * carries the reasoning, and the inset is a distance rather than a share
   * because the two cards this sheet draws are very different shapes.
   */
  shade: {
    position: 'absolute',
    top: SHADE_INSET,
    left: SHADE_INSET,
    right: SHADE_INSET,
    bottom: SHADE_INSET,
  },
  /** The arrow's own air, and the card's margin is the rest of it. */
  back: {
    alignSelf: 'flex-start',
    marginBottom: space.md,
  },
  /**
   * The paragraph you write in, and there is no rule under it: a rule under
   * something that wraps underlines its last line only, and the card is already
   * the shape saying where to write.
   *
   * It fills a card whose height is settled by `NOTE_ASPECT`, so the card never
   * changes size while you type — a card that grew line by line would be
   * movement, and movement under the thumb doing the typing.
   */
  input: {
    flex: 1,
    // Android gives a TextInput its own generous padding, which would set the
    // text in off the card's margin and only on that platform.
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actions: {
    flexDirection: 'row',
  },
  /**
   * A quiet word at the foot of the card, not a button across it. The button's
   * own vertical padding is the air above it; the horizontal padding is what
   * makes it a target, and is kept on the inside edge only so the words sit
   * against the card's margin rather than floating off it.
   */
  action: {
    paddingHorizontal: space.md,
    paddingBottom: 0,
    paddingRight: 0,
    alignSelf: 'flex-end',
  },
  /** Ink settling, the same as everywhere else. */
  pressed: {
    opacity: 0.6,
  },
});
