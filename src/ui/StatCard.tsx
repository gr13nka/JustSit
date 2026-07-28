import { StyleSheet, View } from 'react-native';

import { color, radius, space } from '../theme/tokens';
import { Text } from './Text';

/**
 * A stat card from the mockup: a quiet label, a number, and its unit.
 *
 * The number is ink, never terracotta — nothing here is tappable, and colour in
 * this app means either "touch this" or "this grew".
 */
export function StatCard({
  label,
  value,
  unit,
  accent = false,
}: {
  label: string;
  value: string | number;
  unit: string;
  /** Sage, for numbers that count growth rather than merely reporting it. */
  accent?: boolean;
}) {
  return (
    <View style={styles.card}>
      <Text variant="label">{label}</Text>
      <Text variant="stat" style={accent ? styles.accent : undefined}>
        {value}
      </Text>
      <Text variant="caption">{unit}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: color.paperDeep,
    borderRadius: radius.card,
    padding: space.md,
    gap: space.xs,
  },
  accent: {
    color: color.sage,
  },
});
