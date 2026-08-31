import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { space } from '../../src/theme/tokens';
import { type } from '../../src/theme/typography';
import { useColor } from '../../src/theme/useColor';
import { deleteNote, updateNote, useNotes } from '../../src/store';
import { BackHeader } from '../../src/ui/BackHeader';
import { fieldReset } from '../../src/ui/fieldReset';
import { Screen } from '../../src/ui/Screen';
import { Text } from '../../src/ui/Text';
import { formatDay } from '../../src/ui/time';
import { useKeyboardUp } from '../../src/ui/useKeyboardUp';

/**
 * One note, opened out.
 *
 * The back arrow is the only "done" — there is no second word for it, because
 * the app's one way out of a screen is already the way out of this one, and a
 * button that saved would imply there is a state in which leaving does not.
 *
 * Nothing is written until you leave, and then only if something changed. That
 * is what puts the save on the unmount rather than on the arrow: the arrow is
 * one of four ways off this screen, along with the Android back key, the swipe,
 * and deleting the note — and a save that only fired on the button would lose a
 * paragraph to the gesture people actually use.
 */
export default function NoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const color = useColor();
  const notes = useNotes();

  const note = notes.find((n) => n.id === id);

  const [body, setBody] = useState(note?.body ?? '');

  /**
   * Whether the keyboard is up, which is the only reason this screen knows the
   * word exists.
   *
   * `delete` sits at the foot of the page precisely so it is a long way from
   * anything pressed by accident — and a raised keyboard puts its own top edge
   * exactly there, so the one destructive word in the app would be under the
   * thumb that just finished typing. It comes back the moment the keyboard is
   * dismissed, which is also the moment anybody would look for it.
   *
   * That last sentence is true for the first time. This used to watch the
   * field's focus, and the Android back key hides the IME without clearing it —
   * RN's `ReactEditText` overrides nothing for that key — so the word stayed
   * away until you left the field entirely, which is not a thing anybody does
   * to find a word they were looking for.
   */
  const keyboardUp = useKeyboardUp();

  /**
   * The latest text and where it started, reachable from the unmount.
   *
   * A cleanup closes over the render that mounted the screen, so state read
   * inside one is the state the screen opened with. Mirroring into a ref on
   * every render is the same arrangement `useSession` uses to keep hold of a
   * fresh `onComplete`.
   */
  const latest = useRef(body);
  latest.current = body;
  const opened = useRef(note?.body ?? '');
  const gone = useRef(false);

  useEffect(
    () => () => {
      if (gone.current) return;
      if (latest.current === opened.current) return;
      // Emptying a note deletes it — see `updateNote`. That is the same gesture
      // as rubbing something out, and the word below is the deliberate version.
      updateNote(id, latest.current);
    },
    [id]
  );

  const remove = () => {
    gone.current = true;
    deleteNote(id);
    router.back();
  };

  /*
    The page lifts off the keyboard itself, because nothing else does it any
    more: edge-to-edge is not optional under SDK 57, so the window is no longer
    resized for the IME whatever the manifest asks for, and a `flex: 1` field on
    a long note would put the caret under the keys.

    Where this stands is the whole of whether the lift is right, and it stands
    outside `Screen` deliberately. `KeyboardAvoidingView` pads by
    `frame.y + frame.height - keyboardY` — its own measured frame against the
    keyboard's top edge — which is the overlap only when that frame really is
    the screen's. `Screen` is a padded `SafeAreaView`, so a wrapper inside it
    would measure `frame.y` as 0 while actually standing at `insets.top` and
    under-lift by exactly that much. That gap is what `keyboardVerticalOffset`
    exists to correct, and placement is the version of the correction that
    cannot drift when an inset changes.

    `padding` on both platforms rather than the usual iOS-only split, and one
    behaviour serves both for the same reason: the overlap is measured rather
    than asked for, so the platforms' disagreement about what a keyboard's
    height includes — Android's leaves out the navigation bar, iOS's spans the
    home indicator — never enters the arithmetic. It carries no colour either;
    the stack paints paper behind the strip padding opens up.
  */
  return (
    <KeyboardAvoidingView style={styles.root} behavior="padding">
      {/*
        The bottom inset goes while the keyboard is up. It is room held for the
        navigation bar, and a raised keyboard is standing on that bar — held
        anyway, it is held twice, and the page floats a bar's height above a
        keyboard it is already clear of.
      */}
      <Screen edges={keyboardUp ? ['top'] : ['top', 'bottom']}>
        <BackHeader title="Note" onBack={() => router.back()} />

        {note && (
          <>
            <View style={styles.head}>
              <Text variant="caption" color="inkFaint">
                {formatDay(note.createdAt)}
              </Text>
            </View>

            {/*
              A TextInput cannot name a variant, so it reads the row out of the
              type scale by hand — `hand`, the same face the pile drew this note
              in and the same one it was typed in. It fills the screen rather
              than sitting in a box: the page is the paper, and a field drawn on
              it would be a second one, which is also what `fieldReset` takes
              off in a browser.
            */}
            <TextInput
              style={[type.hand, styles.input, fieldReset, { color: color.ink }]}
              value={body}
              onChangeText={setBody}
              multiline
              textAlignVertical="top"
              placeholder="nothing here"
              placeholderTextColor={color.inkFaint}
            />

            {/*
              Destructive, and there is no dialog to ask about it — this app has
              never shown one. So it is put where nothing is pressed by accident:
              the foot of the page, a long way from the way out, and small. The
              colour is what makes it a warning rather than a third quiet word.

              Gone while the keyboard is up, because up there the foot of the page
              is the keyboard's own top edge — see `keyboardUp` above.
            */}
            {!keyboardUp && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Delete this note"
                onPress={remove}
                hitSlop={space.sm}
                style={({ pressed }) => [styles.delete, pressed && styles.pressed]}>
                <Text variant="caption" color="danger">
                  delete
                </Text>
              </Pressable>
            )}
          </>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  head: {
    alignItems: 'center',
    paddingBottom: space.md,
  },
  input: {
    flex: 1,
    // Android gives a TextInput its own padding, which would indent the text
    // off the screen's gutter and only on that platform.
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  delete: {
    alignSelf: 'center',
    paddingVertical: space.md,
  },
  /** Ink settling, the same as everywhere else. */
  pressed: {
    opacity: 0.6,
  },
});
