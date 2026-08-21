import { Pressable, StyleSheet, View } from 'react-native';

import { Note } from '../store/types';
import { radius, space } from '../theme/tokens';
import { useColor } from '../theme/useColor';
import { CARD_LINES } from './masonry';
import { Plant } from './Plant';
import { Text } from './Text';
import { formatDay } from './time';
import { useOrganicCorners } from './useOrganicCorners';

/** A mark beside the words rather than a picture: about a line of type tall. */
const GLYPH = 24;

/**
 * One note in the pile.
 *
 * The app's card at the shelf's smaller radius — paper laid on paper, no
 * border, no shadow — cut to whatever its note is long. What makes a screen of
 * them readable is that they are all different heights, so the eye has
 * something to count by; what makes it finite is that the body stops after a
 * few lines. A card is the way back into a thought, not the place to read it.
 *
 * The plant is the only drawn link between a note and where it grew, and it is
 * absent far more often than not — a note written in a sitting that was
 * abandoned has no plant, and neither has one written outside a sitting at all.
 * Nothing is said about that. An explanation of why some cards have a leaf on
 * them would be longer than every note on the screen.
 */
export function NoteCard({
  note,
  plant,
  onPress,
}: {
  note: Note;
  /** The species grown by the sitting this was caught in, if it finished. */
  plant?: string;
  onPress: () => void;
}) {
  const color = useColor();
  const corners = useOrganicCorners(radius.card);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={note.body}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        corners,
        { backgroundColor: color.paperDeep },
        pressed && styles.pressed,
      ]}>
      <Text variant="body" numberOfLines={CARD_LINES}>
        {note.body}
      </Text>
      <View style={styles.meta}>
        <Text variant="caption" color="inkFaint">
          {formatDay(note.createdAt)}
        </Text>
        {/*
          Standing on the card, so its filled shapes take the card's ground
          rather than the page's — a plant filled with paper on paper-deep is a
          plant with a hole cut round it.
        */}
        {plant !== undefined && <Plant plant={plant} size={GLYPH} ground="paperDeep" />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: space.md,
  },
  meta: {
    flexDirection: 'row',
    // Centred rather than on the baseline: the plant is a drawing, and a
    // drawing has no baseline to sit on.
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.sm,
    // Holds the row's height when there is no plant, so a card with one and a
    // card without differ by the note and by nothing else.
    minHeight: GLYPH,
  },
  /** Ink settling, the same as everywhere else — no scale, no shadow. */
  pressed: {
    opacity: 0.6,
  },
});
