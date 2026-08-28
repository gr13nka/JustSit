import { StyleSheet, View } from 'react-native';

import { space } from '../theme/tokens';
import { useColor } from '../theme/useColor';
import { IconProps } from './icons';
import { Text } from './Text';

/**
 * A doodle and a number, and nothing else.
 *
 * These were two cards at the foot of the garden. Cards made them the largest
 * thing on a screen whose subject is the plot, and cost it four rows; pinned to
 * the corners instead they are legible without being the point, and the garden
 * gets the page back. There is no label and no unit — the drawing is the label.
 */
export function Indicator({
  icon: Icon,
  value,
  label,
  grew,
}: {
  icon: (props: IconProps) => React.ReactElement;
  value: number;
  /** What the drawing means, for anyone who cannot see it. */
  label: string;
  /**
   * How far green — the app's "something grew" colour — reaches into the mark.
   *
   * `mark` greens the drawing and the number together, and is spent on one
   * thing — the sun on a day already sat. Green means something grew, and today
   * something did, so the whole mark says it.
   *
   * `figure` greens the number alone and leaves the drawing as the label it is,
   * which is what a figure counting something that grew for good wants. Nothing
   * spends it today: the leaf that did counted sittings, and went when the
   * garden became one bed whose caption already says how many there are. It is
   * kept as the other half of the pair — a mark that reports a running total is
   * a different claim from one that reports today, and the distinction is worth
   * more than the four lines it costs.
   *
   * Absent, the indicator reports and does not comment.
   */
  grew?: 'figure' | 'mark';
}) {
  const color = useColor();

  return (
    <View style={styles.row} accessibilityLabel={`${label}: ${value}`}>
      <Icon color={grew === 'mark' ? color.penGreen : color.inkSoft} size={ICON} />
      <Text variant="title" color={grew ? 'penGreen' : 'ink'}>
        {value}
      </Text>
    </View>
  );
}

const ICON = 20;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    // The drawing has no baseline to sit on, so the two are centred instead.
    alignItems: 'center',
    gap: space.xs + 2,
  },
});
