import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { space } from '../../src/theme/tokens';
import { type } from '../../src/theme/typography';
import { useColor } from '../../src/theme/useColor';
import { deleteNote, updateNote, useNotes } from '../../src/store';
import { BackHeader } from '../../src/ui/BackHeader';
import { Screen } from '../../src/ui/Screen';
import { Text } from '../../src/ui/Text';
import { formatDay } from '../../src/ui/time';

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
   */
  const [typing, setTyping] = useState(false);

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

  return (
    <Screen edges={['top', 'bottom']}>
      <BackHeader title="Note" onBack={() => router.back()} />

      {note && (
        <>
          <View style={styles.head}>
            <Text variant="caption" color="inkFaint">
              {formatDay(note.createdAt)}
            </Text>
          </View>

          {/*
            A TextInput cannot name a variant, so it reads the same row out of
            the type scale by hand — the reading weight, set as it is
            everywhere else. It fills the screen rather than sitting in a box:
            the page is the paper, and a field drawn on it would be a second one.
          */}
          <TextInput
            style={[type.body, styles.input, { color: color.ink }]}
            value={body}
            onChangeText={setBody}
            multiline
            textAlignVertical="top"
            placeholder="nothing here"
            placeholderTextColor={color.inkFaint}
            onFocus={() => setTyping(true)}
            onBlur={() => setTyping(false)}
          />

          {/*
            Destructive, and there is no dialog to ask about it — this app has
            never shown one. So it is put where nothing is pressed by accident:
            the foot of the page, a long way from the way out, and small. The
            colour is what makes it a warning rather than a third quiet word.

            Gone while the keyboard is up, because up there the foot of the page
            is the keyboard's own top edge — see `typing` above.
          */}
          {!typing && (
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
  );
}

const styles = StyleSheet.create({
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
