import { Animated, Pressable, StyleSheet, ViewStyle } from 'react-native';

import { hairline, radius, space } from '../theme/tokens';
import { useColor } from '../theme/useColor';
import { usePressSettle } from './motion';
import { Text } from './Text';
import { useOrganicCorners } from './useOrganicCorners';

type Variant = 'primary' | 'quiet' | 'wobbly';

type ButtonProps = {
  label: string;
  onPress: () => void;
  /**
   * primary — ink fill. The one obvious action on a screen.
   * quiet   — text only. For "not yet", "skip", "I'll set this later".
   * wobbly  — paper, a drawn ink border, and a base rounder than a card's.
   *           Every variant closes on uneven corners; this is the one that
   *           shows them, because nothing fills them in. Reserved for the single
   *           most hand-placed action in the app: put a second one on screen and
   *           neither reads as placed by hand any more.
   */
  variant?: Variant;
  disabled?: boolean;
  style?: ViewStyle;
};

/** A shade rounder than a card, because a button is meant to look pressable. */
const WOBBLY_RADIUS = 14;

/** The wobbly variant only earns its name at a seed that scatters all four. */
const WOBBLY_SEED = 1;

/** Which token each variant sets its label in. Values arrive with the theme. */
const labelToken = {
  primary: 'paper',
  quiet: 'inkSoft',
  wobbly: 'ink',
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

  const wobbly = variant === 'wobbly';
  const corners = useOrganicCorners(
    wobbly ? WOBBLY_RADIUS : radius.card,
    wobbly ? WOBBLY_SEED : undefined
  );

  /**
   * The accent is what says "touchable" now that the app has one: it fills the
   * primary and draws the wobbly one's border. Quiet stays type on paper — a
   * third accented shape on a screen would stop the first two meaning anything.
   */
  const fill = {
    primary: { backgroundColor: color.accent },
    quiet: null,
    wobbly: { backgroundColor: color.paper, borderColor: color.accent },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        fill,
        corners,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}>
      <Animated.View style={settleStyle}>
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
    borderWidth: hairline,
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
