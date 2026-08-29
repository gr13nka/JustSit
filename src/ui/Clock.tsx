import { StyleSheet, View } from 'react-native';

import { space } from '../theme/tokens';
import { Text } from './Text';
import { formatRemainingMinutes } from './time';

/**
 * The largest thing in the app. Shown before a sitting (the length you chose)
 * and during one (what is left), which is why it lives here rather than in
 * either screen — both render it identically.
 *
 * Whole minutes are the only clock this app shows. The unit appears because
 * "2" needs the word beside it in a way "2:00" did not.
 */
export function Clock({ ms }: { ms: number }) {
  return (
    <View style={styles.clock}>
      <Text variant="timer">{formatRemainingMinutes(ms)}</Text>
      <Text variant="caption" style={styles.unit}>
        min
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  clock: {
    alignItems: 'center',
  },
  unit: {
    marginTop: space.xs,
    letterSpacing: 1,
  },
});
