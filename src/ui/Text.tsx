import { Text as RNText, TextProps as RNTextProps } from 'react-native';

import { color as palette } from '../theme/tokens';
import { type } from '../theme/typography';

type Variant = keyof typeof type;

/**
 * The tokens type may be set in. The pen brights are absent on purpose — they
 * belong to the drawings — and `penGreen` is here for the one case that earns
 * it: a number large enough to carry it, counting something that grew.
 *
 * `paper` is absent too. Type on an ink fill is the fill's business, which is
 * why the primary button colours its own label.
 */
type TextColor = 'ink' | 'inkSoft' | 'inkFaint' | 'penGreen' | 'danger';

export type TextProps = RNTextProps & {
  variant?: Variant;
  /** Override the variant's colour with a token name. Never a raw hex. */
  color?: TextColor;
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
