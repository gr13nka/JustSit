import { Pressable, StyleSheet, View } from 'react-native';

import { Grown, Plot } from '../domain/plots';
import { hairline, radius, space } from '../theme/tokens';
import { useColor } from '../theme/useColor';
import { MiniField } from './MiniField';
import { Text } from './Text';
import { formatMonthRange } from './time';
import { useOrganicCorners } from './useOrganicCorners';

/**
 * One garden on the shelf: its shape in miniature, and one quiet line saying
 * when it was.
 *
 * The card is the app's card at a smaller radius — paper laid on paper, no
 * border, no shadow — and it is cut to the shape of its own field rather than
 * to a common rectangle. That is the whole design of the shelf: a bed of three
 * beside a row of nine looks like a bed of three beside a row of nine, and a
 * mala takes a row to itself because that is how wide it is. There is no
 * percentage anywhere, and there is not going to be one.
 */
export function GardenCard({
  size,
  cells,
  meta,
  mark,
  start,
  pad = space.md,
  ghost = false,
  cornerSeed,
  onPress,
}: {
  size: number;
  /** What has grown, per dot. Absent draws the bed empty. */
  cells?: readonly (Grown | null)[];
  /** The line under the field. Absent on a card that is not making a claim. */
  meta?: string;
  /** One mark's width. The same across a shelf — see `shelfMark`. */
  mark: number;
  /** Where this garden starts in the whole run of dots — `Plot.start`. */
  start?: number;
  pad?: number;
  /**
   * A garden that does not exist yet — the size being considered on the ask
   * screen, drawn in its place on the user's own shelf.
   *
   * It is the one card that carries an outline instead of a fill, and the one
   * place on either screen where a border is allowed to say something: an empty
   * paper-deep card would read as a garden already open, which is exactly the
   * thing not yet decided.
   */
  ghost?: boolean;
  cornerSeed?: number;
  onPress?: () => void;
}) {
  const color = useColor();
  const corners = useOrganicCorners(radius.card, cornerSeed);

  const card = (
    <View
      style={[
        styles.card,
        corners,
        { padding: pad },
        ghost
          ? { borderWidth: hairline, borderColor: color.inkFaint }
          : { backgroundColor: color.paperDeep },
      ]}>
      <MiniField size={size} cells={cells} mark={mark} start={start} />
      {meta !== undefined && (
        <Text variant="caption" color="inkFaint" style={styles.meta}>
          {meta}
        </Text>
      )}
    </View>
  );

  if (!onPress) return card;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={meta ? `Garden, ${meta}` : 'Garden'}
      onPress={onPress}
      style={({ pressed }) => [styles.press, pressed && styles.pressed]}>
      {card}
    </Pressable>
  );
}

/**
 * The line under a garden: when it ran, or how far it has got.
 *
 * A finished garden is a fact about the past and takes the months it spanned; a
 * garden still being filled says "now" and counts. Neither says how long it
 * took, because a sitting can grow two or three plants and a garden's length in
 * days was never true of anything.
 */
export function gardenMeta(plot: Plot, current: boolean): string {
  if (current) return `now · ${plot.plants.length} of ${plot.size}`;
  if (plot.startedAt === null || plot.completedAt === null) return `${plot.size}`;

  return `${formatMonthRange(plot.startedAt, plot.completedAt)} · ${plot.size}`;
}

const styles = StyleSheet.create({
  card: {
    // Content-sized, so the card really is the shape of its field. Stretching
    // it to the column would put a three-dot bed in the middle of an acre.
    alignSelf: 'flex-start',
    alignItems: 'center',
  },
  press: {
    alignSelf: 'flex-start',
  },
  /** Ink settling, the same as everywhere else — no scale, no shadow. */
  pressed: {
    opacity: 0.6,
  },
  meta: {
    marginTop: space.sm,
  },
});
