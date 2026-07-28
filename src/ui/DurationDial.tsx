import { Pressable, StyleSheet, View } from 'react-native';

import { DURATION_OPTIONS_MS } from '../domain/stages';
import { color, hairline, radius, space } from '../theme/tokens';
import { Text } from './Text';

/**
 * The duration picker from the mockup.
 *
 * Every option is tappable at every stage — the stage only decides which one
 * arrives pre-selected. Wallace is explicit that beginners fail by sitting too
 * long too early, and this encodes that as a default rather than a gate.
 */
export function DurationDial({
  valueMs,
  onChange,
}: {
  valueMs: number;
  onChange: (ms: number) => void;
}) {
  return (
    <View style={styles.card}>
      <Text variant="label" style={styles.heading}>
        Choose duration
      </Text>
      <View style={styles.row}>
        {DURATION_OPTIONS_MS.map((ms) => {
          const selected = ms === valueMs;
          const minutes = Math.round(ms / 60_000);

          return (
            <Pressable
              key={ms}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${minutes} minutes`}
              onPress={() => onChange(ms)}
              hitSlop={space.xs}
              style={({ pressed }) => [
                styles.option,
                selected && styles.optionSelected,
                pressed && styles.pressed,
              ]}>
              <Text
                variant="body"
                style={selected ? styles.labelSelected : styles.label}>
                {minutes}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/**
 * Six of these have to fit a 320pt screen: 320 − 48 (screen) − 8 (card) leaves
 * 264, so 38 each spends 228 and keeps a readable gap. `hitSlop` makes up the
 * difference to a comfortable touch target.
 */
const SIZE = 38;

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.paperDeep,
    borderRadius: radius.card,
    paddingVertical: space.md,
    paddingHorizontal: space.xs,
  },
  heading: {
    textAlign: 'center',
    marginBottom: space.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  option: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: hairline,
    borderColor: 'transparent',
  },
  optionSelected: {
    borderColor: color.terracotta,
  },
  pressed: {
    opacity: 0.6,
  },
  label: {
    color: color.inkSoft,
  },
  labelSelected: {
    color: color.terracotta,
  },
});
