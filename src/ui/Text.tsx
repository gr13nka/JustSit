import { Text as RNText, TextProps as RNTextProps } from 'react-native';

import { color as palette } from '../theme/tokens';
import { type } from '../theme/typography';

type Variant = keyof typeof type;

export type TextProps = RNTextProps & {
  variant?: Variant;
  /** Override the variant's colour with a token name. Never a raw hex. */
  color?: keyof typeof palette;
};

/**
 * The only Text used in the app. Screens name a role from the type scale
 * rather than a font and a size, so the app's voice lives in typography.ts
 * and changing it is one edit rather than a hundred.
 */
export function Text({ variant = 'body', color, style, ...rest }: TextProps) {
  return (
    <RNText
      style={[type[variant], color ? { color: palette[color] } : null, style]}
      {...rest}
    />
  );
}
