import { Pressable, StyleSheet, View } from 'react-native';

import { DURATION_OPTIONS_MS } from '../domain/stages';
import { color, hairline, organicCorners, space } from '../theme/tokens';
import { Card } from './Card';
import { Text } from './Text';

/**
 * The duration picker.
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
    <Card style={styles.card}>
      <Text variant="label" style={styles.heading}>
        Choose duration
      </Text>
      <View style={styles.row}>
        {DURATION_OPTIONS_MS.map((ms, index) => {
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
                // Seeded by position rather than by instance, so a rerender of
                // the row cannot swap two options' corners; and the six read as
                // six drawn rings rather than one ring stamped six times.
                //
                // The base is pulled inside half the box: at half exactly, the
                // ±20% takes a corner pair past the side they share, and the
                // platform then scales all four down to a shape nobody chose.
                organicCorners(OPTION_SIZE / 2 - 4, index),
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
    </Card>
  );
}

/**
 * Six of these have to fit a 320pt screen: 320 − 48 (screen) − 8 (card padding)
 * leaves 264, so 38 each spends 228 and keeps a readable gap. `hitSlop` makes
 * up the difference to a comfortable touch target.
 */
const OPTION_SIZE = 38;

const styles = StyleSheet.create({
  /** Tighter than a card's usual padding: six options need the width, and a
      control pinned to the screen's foot shouldn't be tall. */
  card: {
    paddingHorizontal: space.xs,
    paddingVertical: space.md,
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
    width: OPTION_SIZE,
    height: OPTION_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    // The unselected ring is drawn in nothing rather than not drawn at all:
    // giving the border its width back on selection would shift every label.
    borderWidth: hairline,
    borderColor: 'transparent',
  },
  optionSelected: {
    borderColor: color.ink,
  },
  pressed: {
    opacity: 0.6,
  },
  label: {
    color: color.inkSoft,
  },
  labelSelected: {
    color: color.ink,
  },
});
