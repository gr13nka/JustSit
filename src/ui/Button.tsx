import { useState } from 'react';
import {
  Animated,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { radius, space } from '../theme/tokens';
import { useColor } from '../theme/useColor';
import { boxPath } from './box';
import { usePressSettle } from './motion';
import { Text } from './Text';
import { useOrganicCorners } from './useOrganicCorners';

type Variant = 'primary' | 'quiet' | 'wobbly';

type ButtonProps = {
  label: string;
  onPress: () => void;
  /**
   * primary — accent fill, CSS corners. The one obvious action on a screen.
   * quiet   — text only. For "not yet", "skip", "I'll set this later".
   * wobbly  — the same fill, but the shape is *drawn*: a closed path whose
   *           corners disagree and whose sides belly a percent off true, with
   *           an ink outline around it. Every other box in the app is a
   *           rectangle with soft corners; this is the one that looks like
   *           somebody drew a button. Reserved for the single most hand-placed
   *           action in the app: put a second one on screen and neither reads
   *           as placed by hand any more.
   */
  variant?: Variant;
  disabled?: boolean;
  style?: ViewStyle;
};

/** A shade rounder than a card, because a button is meant to look pressable. */
const WOBBLY_RADIUS = 14;

/**
 * The outline's weight. At the top of the range the kit gives a hand-drawn UI
 * mark — this one has to read as a drawn edge around a filled shape rather than
 * as the app's structural 1.5px border, which is a different statement.
 */
const WOBBLY_STROKE = 2;

/** Which token each variant sets its label in. Values arrive with the theme. */
const labelToken = {
  primary: 'paper',
  quiet: 'inkSoft',
  wobbly: 'paper',
} as const;

/**
 * There is at most one primary button on any screen. If a screen seems to need
 * two, the second one is quiet.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  style,
}: ButtonProps) {
  const color = useColor();
  const { onPressIn, onPressOut, settleStyle } = usePressSettle();
  const corners = useOrganicCorners(radius.card);

  const wobbly = variant === 'wobbly';

  /**
   * A drawn shape has to know how big it is, and only the label can say — so
   * the first frame lays the label out and the second draws the box around it.
   * The label is held invisible until then rather than flashing paper-on-paper.
   */
  const [size, setSize] = useState({ width: 0, height: 0 });
  const measured = size.width > 0;
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((current) =>
      current.width === width && current.height === height
        ? current
        : { width, height }
    );
  };

  /**
   * The accent is what says "touchable" now that the app has one: it fills both
   * of the shapes that commit to something. Quiet stays type on paper — a third
   * accented shape on a screen would stop the first two meaning anything.
   */
  const fill = {
    primary: [{ backgroundColor: color.accent }, corners],
    quiet: null,
    // Painted by the path below, which has to sit inside its own bulge and so
    // cannot be a background on the box it is drawn in.
    wobbly: null,
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onLayout={wobbly ? onLayout : undefined}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        fill,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}>
      {wobbly && measured && (
        <Svg
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          width={size.width}
          height={size.height}>
          <Path
            d={boxPath(size.width, size.height, WOBBLY_RADIUS, WOBBLY_STROKE)}
            fill={color.accent}
            stroke={color.ink}
            strokeWidth={WOBBLY_STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      )}
      <Animated.View style={[settleStyle, wobbly && !measured && styles.unmeasured]}>
        <Text variant="button" color={labelToken[variant]}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.md,
    paddingHorizontal: space.xl,
  },
  primary: {},
  quiet: {
    backgroundColor: 'transparent',
  },
  wobbly: {
    backgroundColor: 'transparent',
  },
  /** One frame, while the label is being measured so the box can be drawn. */
  unmeasured: {
    opacity: 0,
  },
  /**
   * Ink settling: the label sinks one point and the whole button fades a little.
   * No scale and no shadow — the kit gives a button exactly this much movement,
   * and a bounce would be a different app's idea of a press.
   */
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.35,
  },
});
