import { ColorValue } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

type IconProps = {
  /** ColorValue rather than string — this is what expo-router hands tabBarIcon. */
  color: ColorValue;
  size?: number;
};

/**
 * Stroke-only line icons on a 24pt grid, drawn to sit alongside hand-drawn
 * plant art: 1.6 stroke, round caps and joins, no fills anywhere.
 */
const stroke = {
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  fill: 'none',
} as const;

function Frame({ size = 24, children }: { size?: number; children: React.ReactNode }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {children}
    </Svg>
  );
}

/** Garden — a sprout with two leaves. */
export function GardenIcon({ color, size }: IconProps) {
  return (
    <Frame size={size}>
      <Path d="M12 21V11" stroke={color} {...stroke} />
      <Path d="M12 14C8.5 14 6 11.5 6 8c3.5 0 6 2.5 6 6Z" stroke={color} {...stroke} />
      <Path d="M12 12c3 0 5.2-2.2 5.2-5.2C14.2 6.8 12 9 12 12Z" stroke={color} {...stroke} />
    </Frame>
  );
}

/** You — a figure. */
export function YouIcon({ color, size }: IconProps) {
  return (
    <Frame size={size}>
      <Circle cx="12" cy="8" r="3.5" stroke={color} {...stroke} />
      <Path d="M5 20.5c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5" stroke={color} {...stroke} />
    </Frame>
  );
}
