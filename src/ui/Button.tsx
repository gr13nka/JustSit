import { Pressable, StyleSheet, ViewStyle } from 'react-native';

import { color, radius, space } from '../theme/tokens';
import { Text } from './Text';

type ButtonProps = {
  label: string;
  onPress: () => void;
  /**
   * primary — terracotta fill. The one obvious action on a screen.
   * quiet   — text only. For "not yet", "skip", "I'll set this later".
   */
  variant?: 'primary' | 'quiet';
  disabled?: boolean;
  style?: ViewStyle;
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
  const primary = variant === 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        primary ? styles.primary : styles.quiet,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}>
      <Text
        variant="button"
        style={{ color: primary ? color.paper : color.inkSoft }}>
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
    borderRadius: radius.button,
  },
  primary: {
    backgroundColor: color.terracotta,
  },
  quiet: {
    backgroundColor: 'transparent',
  },
  /** No scale or shadow — a press should feel like ink settling, not a bounce. */
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.35,
  },
});
