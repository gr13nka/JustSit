import { ReactNode, useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  KeyboardAvoidingView,
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
import { ArrowLeft } from './icons';
import { Fade, Rise } from './motion';
import { Text } from './Text';
import { formatDay } from './time';
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
 */

/**
 * How far the veil dims what is behind it.
 *
 * Paper over paper rather than ink over paper: the screen goes quiet by being
 * washed out, not by being put in shadow. This app has no shadows and nothing
 * on it is ever darkened.
 */
const VEIL = 0.55;

/** Far enough that the card reads as coming from off the bottom of the screen. */
const CARD_RISE = 28;

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
  /** Touching anything that is not the card. Never destructive — see callers. */
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
  const { width } = useWindowDimensions();

  const note = card === 'note';

  /**
   * The Android back key puts the card away.
   *
   * The sheet is not a route, so nothing else answers back while it is up — and
   * what the navigator would answer with on the run screen is the end of a
   * sitting, without a word. The keyboard eats the first press itself; this is
   * what answers the second. It goes through a ref because that screen
   * re-renders four times a second, and a dependency on the callback would
   * re-subscribe just as often. `BackHandler` is a no-op on iOS and web.
   */
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      dismiss.current();
      return true;
    });
    return () => sub.remove();
  }, []);

  /*
    The width is a share of the screen and the height follows from it, so a
    narrow phone gets a proportionally narrower card rather than a clipped one,
    and however many lines fit is however many fit. `maxHeight` is what caps it
    against the room the keyboard leaves on a short screen, rather than luck.

    It goes on the entrance rather than on the card, and that is the whole
    reason `Rise` is carrying layout at all: a percentage resolves against a
    parent with a *definite* height, and `Rise` is sized by its child. Set on
    the card it would have measured itself against an auto height and silently
    done nothing — the stage is the nearest box that knows how tall it is, so
    the shape has to sit one level up, where the stage is the parent.
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

  return (
    <View style={StyleSheet.absoluteFill}>
      <Fade to={VEIL} style={[StyleSheet.absoluteFill, { backgroundColor: color.paper }]} />

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
          onPress={onDismiss}
        />
        <View
          pointerEvents="box-none"
          style={[
            styles.stage,
            note && styles.middle,
            { paddingTop: insets.top, paddingBottom: floor },
          ]}>
          <Rise from={CARD_RISE} style={note ? noteShape : styles.dock}>
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
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

/** Small enough to read as a mark on the card rather than as a control. */
const ARROW_SIZE = 24;

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
  /** Put it down and lower the card. Empty is a perfectly good answer. */
  onDone: () => void;
}) {
  const color = useColor();
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
      */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Put it away"
        onPress={onDone}
        hitSlop={space.md}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
        <ArrowLeft color={color.ink} size={ARROW_SIZE} />
      </Pressable>

      {/*
        A TextInput is not `Text`, so it cannot name a variant — it reads the
        same row out of the type scale by hand. This is the only place in the
        app that does, and it is still typography.ts that decides.
      */}
      <TextInput
        style={[type.body, styles.input, { color: color.ink }]}
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
  onOpen: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <Text variant="body">{note.body}</Text>
      <View style={styles.meta}>
        <Text variant="caption" color="inkFaint">
          {formatDay(note.createdAt)}
        </Text>
        <View style={styles.actions}>
          <Button label="open" variant="quiet" onPress={onOpen} style={styles.action} />
          <Button label="close" variant="quiet" onPress={onClose} style={styles.action} />
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
  /** The page's gutter, which a docked card needs and a card with its own width does not. */
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
