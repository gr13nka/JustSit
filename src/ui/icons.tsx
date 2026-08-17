import { ColorValue } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

import { PEN_DOODLE } from './pen';

type IconProps = {
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
