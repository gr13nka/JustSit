import { ReactNode, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Note } from '../store/types';
import { hairline, radius, space } from '../theme/tokens';
import { type } from '../theme/typography';
import { useColor } from '../theme/useColor';
import { Button } from './Button';
import { Fade, Rise } from './motion';
import { Text } from './Text';
import { formatDay } from './time';
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

export function NoteSheet({
  onDismiss,
  lift = 0,
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
  children: ReactNode;
}) {
  const color = useColor();
  const insets = useSafeAreaInsets();
  const corners = useOrganicCorners(radius.lg);

  return (
    <View style={StyleSheet.absoluteFill}>
      <Fade to={VEIL} style={[StyleSheet.absoluteFill, { backgroundColor: color.paper }]} />

      {/*
        iOS pads; Android resizes the window itself (`softwareKeyboardLayoutMode`
        defaults to resize), and asking for both lifts the card twice.
      */}
      <KeyboardAvoidingView
        style={StyleSheet.absoluteFill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Put it away"
          onPress={onDismiss}
          style={styles.gap}
        />
        <Rise
          from={CARD_RISE}
          style={[styles.dock, { paddingBottom: insets.bottom + lift + space.md }]}>
          <View
            style={[styles.card, corners, { backgroundColor: color.paperDeep }]}>
            {children}
          </View>
        </Rise>
      </KeyboardAvoidingView>
    </View>
  );
}

/**
 * One line, caught during a sitting.
 *
 * The text lives here rather than on the screen above, and that is deliberate
 * twice over. A text field's contents are a view's business; and the run screen
 * recomputes a clock four times a second, so re-rendering it on every keystroke
 * would put the timer behind the keyboard. What the screen is told is every
 * change, so that it holds a copy it can put down at any moment — including the
 * moment the bell rings, which is the one thing that must not cost a thought.
 *
 * There is no second field and no title. A note caught mid-sitting is a line
 * you are putting down so you can stop carrying it, and a form would be an
 * invitation to compose something.
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
        A TextInput is not `Text`, so it cannot name a variant — it reads the
        same row out of the type scale by hand. This is the only place in the
        app that does, and it is still typography.ts that decides.
      */}
      <TextInput
        style={[type.body, styles.input, { color: color.ink, borderBottomColor: color.inkFaint }]}
        value={body}
        onChangeText={change}
        placeholder="catch it, then let it go"
        placeholderTextColor={color.inkFaint}
        autoFocus
        multiline={false}
        returnKeyType="done"
        onSubmitEditing={onDone}
        // The bell may ring while this is open, and a correction offered on the
        // way out is a word changed after the user stopped looking.
        autoCorrect={false}
      />
      <Button label="done" variant="quiet" onPress={onDone} style={styles.action} />
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
  /** Everything above the card: the way out, and nothing to look at. */
  gap: {
    flex: 1,
  },
  dock: {
    paddingHorizontal: space.md,
  },
  card: {
    padding: space.lg,
  },
  /**
   * The line you write on. A rule under the text rather than a box around it —
   * a bordered field would be the only outlined box in the app, and the card is
   * already the shape saying where to write.
   */
  input: {
    borderBottomWidth: hairline,
    paddingBottom: space.sm,
    // Android gives a TextInput its own generous padding, which would put the
    // text off the rule by a few points and only on that platform.
    paddingHorizontal: 0,
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
});
