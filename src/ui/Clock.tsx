import { StyleSheet, View } from 'react-native';

import { space } from '../theme/tokens';
import { useSettings } from '../store';
import { Text } from './Text';
import { formatRemaining, formatRemainingMinutes } from './time';

/**
 * The largest thing in the app. Shown before a sitting (the length you chose)
 * and during one (what is left), which is why it lives here rather than in
 * either screen — both render it identically, and only one of them should ever
 * have to know that the user asked for whole minutes.
 *
 * Hiding seconds is the default. The unit only appears when it is ambiguous:
 * "2:00" says minutes by its shape, "2" does not.
 */
export function Clock({ ms }: { ms: number }) {
  const { hideSeconds } = useSettings();

  return (
    <View style={styles.clock}>
      <Text variant="timer">
        {hideSeconds ? formatRemainingMinutes(ms) : formatRemaining(ms)}
      </Text>
      {hideSeconds && (
        <Text variant="caption" style={styles.unit}>
          min
        </Text>
      )}
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
