import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { hairline, space } from '../theme/tokens';
import { useColor } from '../theme/useColor';

const WIDTH = 48;
const HEIGHT = 6;

/**
 * Four gentle cubic segments wandering either side of the midline, none of them
 * more than about 3% of the rule's length away from it.
 *
 * The offsets were drawn once from a fixed seed and written down here. A rule
 * that re-rolled its wobble between renders would read as a glitch rather than
 * as a hand, so the only randomness in this file has already happened.
 */
const WOBBLE =
  'M1 3.5 C4.8 3.5 8.7 1.9 12.5 1.9 C16.3 1.9 20.2 3.9 24 3.9 ' +
  'C27.8 3.9 31.7 2.4 35.5 2.4 C39.3 2.4 43.2 4 47 4';

/**
 * The divider. Short, faint and drawn by hand, so it separates two things
 * without underlining either — a breath in the page rather than a border.
 *
 * It sits wherever its parent puts it; only the space around it is negotiable.
 */
export function Rule({ style }: { style?: StyleProp<ViewStyle> }) {
  const color = useColor();

  return (
    <Svg
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      style={[styles.rule, style]}>
      <Path
        d={WOBBLE}
        stroke={color.inkFaint}
        strokeWidth={hairline}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  /** A full breath either side by default; a parent that wants less passes less. */
  rule: {
    marginVertical: space.lg,
  },
});
