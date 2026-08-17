import { ColorValue } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const WIDTH = 28;
const HEIGHT = 5;

/**
 * Three cubic segments that never quite settle on the baseline — one pen stroke
 * pulled through in a single go. The unevenness lives in the path data and
 * nowhere else; nothing here moves.
 */
const SCRIBBLE =
  'M1.5 2.8 C5 1.6 8.5 3.5 12 2.6 C15 1.8 18 3.4 21 2.3 C23 1.6 25 2.8 26.5 2.1';

/**
 * The mark under the active tab. It carries the whole active state: the tab you
 * are on is the one somebody has underlined, not merely the darker word.
 *
 * An unfocused tab still gets the box, empty. Holding the height here rather
 * than asking the tab bar to hold it is what keeps choosing a tab from nudging
 * the word above it.
 */
export function TabScribble({
  tint,
  focused,
}: {
  tint: ColorValue;
  focused: boolean;
}) {
  return (
    <Svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
      {focused && (
        <Path
          d={SCRIBBLE}
          stroke={tint}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      )}
    </Svg>
  );
}
