import { ColorValue } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

import { PEN_DOODLE } from './pen';

export type IconProps = {
  /** ColorValue rather than string — this is what expo-router hands tabBarIcon. */
  color: ColorValue;
  size?: number;
};

/**
 * The canvas and the pen every icon here shares, so each icon is only its own
 * paths. A shape that wants to be a circle is drawn as a near-circle instead,
 * because a true circle beside this art reads as a different hand.
 */
function Frame({
  tint,
  size = 24,
  children,
}: {
  tint: ColorValue;
  size?: number;
  children: React.ReactNode;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <G stroke={tint} {...PEN_DOODLE}>
        {children}
      </G>
    </Svg>
  );
}

/** Garden — a sprout with two leaves. */
export function GardenIcon({ color, size }: IconProps) {
  return (
    <Frame tint={color} size={size}>
      <Path d="M24,40 C23,35 24.4,31 24,26" />
      <Path d="M24,26 C19.8,26.3 17.7,24.2 18,20 C22.2,19.7 24.3,21.8 24,26" />
      <Path d="M24,26 C28.2,26.3 30.3,24.2 30,20 C25.8,19.7 23.7,21.8 24,26" />
    </Frame>
  );
}

/** You — a figure. */
export function YouIcon({ color, size }: IconProps) {
  return (
    <Frame tint={color} size={size}>
      <Path d="M24,8 C27.9,8.2 31.2,11.4 31,15.4 C30.8,19.4 27.6,22.2 23.6,22 C19.8,21.8 16.8,18.6 17,14.6 C17.2,10.8 20.2,7.8 24,8" />
      <Path d="M9,41 C9.4,32.6 16,26.4 24,26.4 C32.2,26.4 38.6,32.4 39,41" />
    </Frame>
  );
}

/**
 * An arrow, for the places the interface has to point somewhere. Drawn rather
 * than set as a chevron: nothing else on the screen is a system glyph, and one
 * would give the game away.
 */
export function ArrowRight({ color, size }: IconProps) {
  return (
    <Frame tint={color} size={size}>
      <Path d="M6,27 C16,23 29,22 38,24" />
      <Path d="M32,16 C36,19 40,22 43,25" />
      <Path d="M43,25 C39,28 35,30 31,33" />
    </Frame>
  );
}

/**
 * An arrow pointing back, for the one screen you can back out of.
 *
 * Drawn rather than mirrored from `ArrowRight`: flipping a path with a
 * transform gives you the same hand's stroke running the wrong way, and the
 * overshoot at the head — the part that makes it look drawn — ends up on the
 * side a right-handed pen would not have left it on.
 */
export function ArrowLeft({ color, size }: IconProps) {
  return (
    <Frame tint={color} size={size}>
      <Path d="M42,26 C32,22 19,21 10,23" />
      <Path d="M16,15 C12,18 8,21 5,24" />
      <Path d="M5,24 C9,27 13,29 17,32" />
    </Frame>
  );
}

/**
 * A sun — one day — for the run of days.
 *
 * The kit's own sun draws its rays with straight line commands. Nothing in this
 * app is drawn with a ruler, so each ray is redrawn here as a cubic with a
 * slight bow in it.
 */
export function SunIcon({ color, size }: IconProps) {
  return (
    <Frame tint={color} size={size}>
      <Path d="M24,17 C29,16 32,20 31,24 C33,28 29,32 24,31 C19,32 15,28 16,24 C15,19 19,17 24,17" />
      <Path d="M24,15 C24.3,12.6 23.8,10.4 24,8" />
      <Path d="M29,17 C30.9,14.8 32.4,13 34,11" />
      <Path d="M33,24 C35.6,23.7 38.4,24.3 41,24" />
      <Path d="M29,31 C30.5,33 31.8,35.1 33,37" />
      <Path d="M24,33 C24.3,35.4 23.8,37.6 24,40" />
      <Path d="M19,31 C17.7,32.6 16.4,34.3 15,36" />
      <Path d="M16,24 C13.4,24.5 10.6,24.6 8,25" />
      <Path d="M19,17 C17.4,15.3 15.8,13.6 14,12" />
    </Frame>
  );
}

/**
 * A leaf — one thing that grew — for the count of sittings.
 *
 * Deliberately not the sprout: that one is the Garden tab's mark, already
 * spoken for at the bottom of the same screen.
 */
export function LeafIcon({ color, size }: IconProps) {
  return (
    <Frame tint={color} size={size}>
      <Path d="M24,8 C34,14 36,28 24,42 C12,28 14,14 24,8" />
      <Path d="M24,11 C23,20 25,30 24,39" />
      <Path d="M24,17 C27,16 30,17 31,19 M24,23 C20,22 17,23 16,25 M24,29 C27,28 30,29 31,31 M24,34 C21,33 18,34 17,36" />
    </Frame>
  );
}
