import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { notesNewestFirst, sessionForNote } from '../../src/domain/notes';
import { space } from '../../src/theme/tokens';
import { useNotes, useSessions } from '../../src/store';
import { BackHeader } from '../../src/ui/BackHeader';
import { masonry, noteWeight } from '../../src/ui/masonry';
import { NoteCard } from '../../src/ui/NoteCard';
import { Screen } from '../../src/ui/Screen';

/**
 * Everything caught, newest first.
 *
 * Two columns of cards at whatever height their notes are, which is the one
 * arrangement that makes a pile of unrelated lines readable: nothing lines up,
 * so the eye takes them one at a time instead of reading down a list. There is
 * no search, no tag and no folder — a note is kept so that it could be let go
 * of, and filing them would be the opposite of that.
 *
 * An empty screen is left empty. Батон keeps the app's quiet places and there
 * are already four of them; a fifth would make him decoration rather than the
 * cat who is where nothing else should be. Nobody arrives here by accident —
 * the way in says how many notes there are.
 */

const COLUMNS = 2;

export default function NotesScreen() {
  const notes = useNotes();
  const sessions = useSessions();

  const ordered = notesNewestFirst(notes);
  const columns = masonry(
    ordered.map((note) => noteWeight(note.body)),
    COLUMNS
  );

  return (
    <Screen edges={['top', 'bottom']}>
      <BackHeader title="Notes" onBack={() => router.back()} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.columns}>
          {columns.map((column, c) => (
            <View key={c} style={styles.column}>
              {column.map((i) => {
                const note = ordered[i];
                // The sitting a note was caught in, if it finished. The join is
                // by when that sitting began — see `domain/notes.ts`.
                const grew = sessionForNote(sessions, note);

                return (
                  <NoteCard
                    key={note.id}
                    note={note}
                    plant={grew?.plants[0]?.key}
                    onPress={() =>
                      router.push({ pathname: '/notes/[id]', params: { id: note.id } })
                    }
                  />
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    // The last card still wants air under it; flush with the bottom edge reads
    // as cut off.
    paddingBottom: space.xl,
  },
  columns: {
    flexDirection: 'row',
    // Cards hang from the top of their column and the columns end where they
    // end — levelling them would be a grid, which is what this is not.
    alignItems: 'flex-start',
    gap: space.md,
  },
  column: {
    flex: 1,
    gap: space.md,
  },
});
