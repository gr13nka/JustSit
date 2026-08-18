import { ColorValue } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

import { ICON_PATHS, IconName } from './icons.paths';

export type IconProps = {
  /** ColorValue rather than string — this is what expo-router hands tabBarIcon. */
  color: ColorValue;
  size?: number;
};

/**
 * One drawing from the traced set, on the 48-unit canvas the doodles share.
 *
 * Filled rather than stroked, and that is the whole difference from the pens in
 * `pen.ts`: these outlines came off a real nib, so the taper and the way a
 * stroke ends are already in the path. Stroking them would draw a second, even
 * line around a mark that is not even, and lose the hand twice over.
 *
 * The fill rule is left at SVG's default. potrace gives a hole the opposite
 * winding to the shape around it, which is exactly what non-zero reads — set
 * `evenodd` here and every enclosed shape (the sun's disc, the head, the leaf)
 * fills solid.
 */
function Mark({ name, color, size = 24 }: IconProps & { name: IconName }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <G fill={color}>
        {ICON_PATHS[name].map((d, i) => (
          <Path key={i} d={d} />
        ))}
      </G>
    </Svg>
  );
}

/** Garden — what is growing. */
export const GardenIcon = (props: IconProps) => <Mark name="garden" {...props} />;

/** You — a figure. */
export const YouIcon = (props: IconProps) => <Mark name="you" {...props} />;

/** Onward, for the places the interface has to point somewhere. */
export const ArrowRight = (props: IconProps) => <Mark name="arrowRight" {...props} />;

/**
 * Back out, for the one screen you can leave.
 *
 * Drawn separately rather than mirrored from `ArrowRight`: a flipped path is
 * the same hand's stroke running the wrong way, and the overshoot at the head —
 * the part that makes it look drawn — lands where a right hand would not leave it.
 */
export const ArrowLeft = (props: IconProps) => <Mark name="arrowLeft" {...props} />;

/** A sun — one day — for the run of days. */
export const SunIcon = (props: IconProps) => <Mark name="sun" {...props} />;

/** A leaf — one thing that grew — for the count of sittings. */
export const LeafIcon = (props: IconProps) => <Mark name="leaf" {...props} />;
