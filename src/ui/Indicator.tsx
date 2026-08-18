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
  grew = false,
}: {
  icon: (props: IconProps) => React.ReactElement;
  value: number;
  /** What the drawing means, for anyone who cannot see it. */
  label: string;
  /** Pen-green, for the figure that counts growth rather than merely reporting. */
  grew?: boolean;
}) {
  const color = useColor();

  return (
    <View style={styles.row} accessibilityLabel={`${label}: ${value}`}>
      <Icon color={color.inkSoft} size={ICON} />
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
