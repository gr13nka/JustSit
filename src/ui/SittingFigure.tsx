import Svg, { Circle, Path } from 'react-native-svg';

import { color } from '../theme/tokens';

const line = {
  fill: 'none',
  strokeWidth: 1.4,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

/**
 * The welcome illustration: someone sitting, at night, among grass.
 *
 * Placeholder in the same sense as the plants — when your own drawings arrive
 * this is the other thing to replace.
 */
export function SittingFigure({ width = 260 }: { width?: number }) {
  return (
    <Svg width={width} height={width * 0.62} viewBox="0 0 160 100">
      {/* moon */}
      <Path
        d="M132 18a11 11 0 1 0 7 13 9 9 0 0 1-7-13Z"
        stroke={color.terracotta}
        {...line}
      />

      {/* stars */}
      <Path d="M116 12v4M114 14h4" stroke={color.terracotta} {...line} />
      <Path d="M28 22v3M26.5 23.5h3" stroke={color.terracotta} {...line} />
      <Path d="M46 12v3M44.5 13.5h3" stroke={color.terracotta} {...line} />

      {/* head, with the eyes closed */}
      <Circle cx="80" cy="34" r="9" stroke={color.ink} {...line} />
      <Path d="M75.5 34.5a2.5 2.5 0 0 1 3 0M81.5 34.5a2.5 2.5 0 0 1 3 0" stroke={color.ink} {...line} />

      {/* shoulders and arms resting on the knees */}
      <Path d="M80 43c-7 1-12 6-14 13" stroke={color.ink} {...line} />
      <Path d="M80 43c7 1 12 6 14 13" stroke={color.ink} {...line} />

      {/* crossed legs */}
      <Path
        d="M60 70c6-5 34-5 40 0-6 5-34 5-40 0Z"
        stroke={color.ink}
        {...line}
      />
      <Path d="M66 56c-3 4-5 9-6 14M94 56c3 4 5 9 6 14" stroke={color.ink} {...line} />

      {/* grass either side */}
      <Path d="M40 76c-1-6-2-10-4-14M44 76c0-7 0-11 0-15M48 76c1-6 2-10 4-13" stroke={color.terracotta} {...line} />
      <Path d="M112 76c-1-6-2-10-4-13M116 76c0-7 0-11 0-15M120 76c1-6 2-10 4-14" stroke={color.terracotta} {...line} />

      {/* ground */}
      <Path d="M34 78h92" stroke={color.line} {...line} />
    </Svg>
  );
}
