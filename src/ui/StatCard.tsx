import { StyleSheet } from 'react-native';

import { color, space } from '../theme/tokens';
import { Card } from './Card';
import { Text } from './Text';

/**
 * A quiet label, a number, and its unit.
 *
 * The number is ink unless it counts growth. Colour here means one thing only —
 * something grew — so a stat that merely reports is not entitled to it.
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
  /** Pen-green, for numbers that count growth rather than merely reporting it. */
  accent?: boolean;
}) {
  return (
    <Card style={styles.card}>
      <Text variant="label">{label}</Text>
      <Text variant="stat" style={accent ? styles.accent : undefined}>
        {value}
      </Text>
      <Text variant="caption">{unit}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    gap: space.xs,
  },
  accent: {
    color: color.penGreen,
  },
});
