import { Pressable, StyleSheet, ViewStyle } from 'react-native';

import { color, hairline, radius, space } from '../theme/tokens';
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

const labelColor: Record<Variant, string> = {
  primary: color.paper,
  quiet: color.inkSoft,
  wobbly: color.ink,
};

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
  const wobbly = variant === 'wobbly';
  const corners = useOrganicCorners(
    wobbly ? WOBBLY_RADIUS : radius.card,
    wobbly ? WOBBLY_SEED : undefined
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        corners,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}>
      <Text variant="button" style={{ color: labelColor[variant] }}>
        {label}
      </Text>
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
  primary: {
    backgroundColor: color.ink,
  },
  quiet: {
    backgroundColor: 'transparent',
  },
  wobbly: {
    backgroundColor: color.paper,
    borderWidth: hairline,
    borderColor: color.ink,
  },
  /** No scale or shadow — a press should feel like ink settling, not a bounce. */
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.35,
  },
});
