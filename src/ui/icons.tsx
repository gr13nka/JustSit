import { ColorValue } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

import { ICON_PATHS, IconName } from './icons.paths';
import { PEN_DOODLE } from './pen';

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

/**
 * A pencil — the one mark in the app still drawn in code.
 *
 * It is a **placeholder**. Every other icon here came off a real nib and was
 * traced (`icons.paths.ts`), which is why they are filled; this one is four
 * cubics stroked with `PEN_DOODLE` on the same 48-unit canvas, so it reads as
 * the same hand at the same weight until a drawn one comes off the art loop
 * (`npm run art`). When it does, it joins the traced set and this component
 * becomes another `Mark` — nothing outside this file needs to change.
 *
 * Two strokes for the shaft, one for the shoulder where the nib is cut, and one
 * closing the tip. A stroked drawing on the doodle nib, and nothing filled:
 * this is a pen, not a shape.
 */
const PENCIL = [
  'M13.4,35.2 C19.6,28.2 25.2,22.2 32.6,15',
  'M18.6,40 C24.4,33.8 31.4,26.4 37.4,19.8',
  'M32.6,15 C34.6,16.1 36.3,17.7 37.4,19.8',
  'M13.4,35.2 C11.9,37.6 10.9,40.4 10.4,43.2 C13.3,42.5 15.9,41.5 18.6,40',
];

/** A pencil — catching a thought. Stroked, not traced; see `PENCIL`. */
export function PencilIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {PENCIL.map((d, i) => (
        <Path key={i} d={d} {...PEN_DOODLE} stroke={color} />
      ))}
    </Svg>
  );
}
