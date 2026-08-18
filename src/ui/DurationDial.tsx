import { StyleSheet, View } from 'react-native';

import { DURATION_OPTIONS_MS } from '../domain/stages';
import { space } from '../theme/tokens';
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
 * five are drawn in nothing.
 *
 * What it does not have is a container. Six numbers with air between them are
 * already legible as a row of choices, and the card that used to hold them was
 * a box drawn around something that did not need one — the heaviest mark at the
 * foot of a screen whose whole argument is that it is quiet. The marker is the
 * only fill here now, and it is the soft one: a dark block travelling across
 * bare paper would pull the eye off the ring and onto the settings.
 */

/**
 * Small boxes with generous gaps, rather than large boxes packed together. Both
 * fit the same width; only the second one breathes, and the marker reads as
 * having arrived somewhere rather than as one cell of a strip.
 *
 * The narrowest screen worth fitting is 360pt, which leaves 312 inside the
 * screen's own margins: six 38pt boxes with 10pt between them spend 278 of it.
 * The old arithmetic aimed at 320pt, which is an iPhone 5.
 */
const OPTION_WIDTH = 38;
const OPTION_HEIGHT = 36;
const OPTION_GAP = 10;

export function DurationDial({
  valueMs,
  onChange,
}: {
  valueMs: number;
  onChange: (ms: number) => void;
}) {
  const index = Math.max(0, DURATION_OPTIONS_MS.indexOf(valueMs));

  return (
    /*
      No visible heading. Six minute figures in a row of markers say "choose a
      length" without being told to, and the words were the tallest thing in a
      control whose whole job is to be short. The label survives where it is
      still needed.
    */
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="How long to sit"
      style={styles.row}>
      <Slider
        count={DURATION_OPTIONS_MS.length}
        index={index}
        onSelect={(i) => onChange(DURATION_OPTIONS_MS[i])}
        itemWidth={OPTION_WIDTH}
        itemHeight={OPTION_HEIGHT}
        gap={OPTION_GAP}
        // Up to a comfortable touch target without making it look like one, and
        // kept under half the gap so two options never share a hit area.
        hitSlop={space.xs}
        role="radio"
        tone="quiet"
        labelFor={(i) => `${minutesOf(i)} minutes`}
        renderItem={(i, active) => (
          // The soft marker alone is a quiet thing to hang a choice on, so the
          // number darkens under it. What the unselected ones must not do is
          // fade: five greyed-out numbers would read as five things you can't
          // have, and every length is available at every stage.
          <Text variant="body" color={active ? 'ink' : 'inkSoft'}>
            {minutesOf(i)}
          </Text>
        )}
      />
    </View>
  );
}

function minutesOf(index: number): number {
  return Math.round(DURATION_OPTIONS_MS[index] / 60_000);
}

const styles = StyleSheet.create({
  row: {
    alignSelf: 'center',
    alignItems: 'center',
    marginBottom: space.lg,
  },
});
