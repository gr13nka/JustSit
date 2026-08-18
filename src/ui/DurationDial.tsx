import { StyleSheet, View } from 'react-native';

import { DURATION_OPTIONS_MS } from '../domain/stages';
import { space } from '../theme/tokens';
import { Card } from './Card';
import { Slider } from './Slider';
import { Text } from './Text';

/**
 * The duration picker.
 *
 * Every option is tappable at every stage — the stage only decides which one
 * arrives pre-selected. Wallace is explicit that beginners fail by sitting too
 * long too early, and this encodes that as a default rather than a gate.
 *
 * It is the same sliding selector the screen switcher uses, and deliberately
 * so: the app now has one way of showing a choice among a few things, and a
 * marker that travels says "this one, of these" better than six rings of which
 * five are drawn in nothing. The card it sits in is the bar the marker runs
 * along, which is why the picker keeps a card while the figures on the garden
 * lost theirs.
 */

/**
 * Six of these have to fit a 320pt screen: 320 − 48 (screen) − 8 (card padding)
 * leaves 264, and six 40pt boxes with 4pt between them spend 260 of it. The box
 * is wider than it is tall, like every marker in this app — nothing here is a
 * pill, and nothing is a square either.
 */
const OPTION_WIDTH = 40;
const OPTION_HEIGHT = 32;
const OPTION_GAP = 4;

export function DurationDial({
  valueMs,
  onChange,
}: {
  valueMs: number;
  onChange: (ms: number) => void;
}) {
  const index = Math.max(0, DURATION_OPTIONS_MS.indexOf(valueMs));

  return (
    <Card style={styles.card}>
      <Text variant="label" style={styles.heading}>
        Choose duration
      </Text>
      <View style={styles.row}>
        <Slider
          count={DURATION_OPTIONS_MS.length}
          index={index}
          onSelect={(i) => onChange(DURATION_OPTIONS_MS[i])}
          itemWidth={OPTION_WIDTH}
          itemHeight={OPTION_HEIGHT}
          gap={OPTION_GAP}
          // Makes the drawn box up to a comfortable touch target without
          // making it look like one.
          hitSlop={space.sm}
          role="radio"
          labelFor={(i) => `${minutesOf(i)} minutes`}
          renderItem={(i, active) => (
            <Text variant="body" color={active ? 'paper' : 'inkSoft'}>
              {minutesOf(i)}
            </Text>
          )}
        />
      </View>
    </Card>
  );
}

function minutesOf(index: number): number {
  return Math.round(DURATION_OPTIONS_MS[index] / 60_000);
}

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
    alignItems: 'center',
  },
});
