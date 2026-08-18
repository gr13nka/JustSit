import { Text as RNText, TextProps as RNTextProps } from 'react-native';

import { ColorName } from '../theme/themes';
import { type, variantColor } from '../theme/typography';
import { useColor } from '../theme/useColor';

type Variant = keyof typeof type;

/**
 * The tokens type may be set in. The pen brights are absent on purpose — they
 * belong to the drawings — and `penGreen` is here for the one case that earns
 * it: a number large enough to carry it, counting something that grew.
 *
 * `paper` is here for one reason only: type sitting on an accent fill, where
 * the fill has already decided the colour. `accent` is absent — the accent
 * marks touchable shapes, and type that changed colour to say "touch me" would
 * be the thing this app most consistently refuses to do.
 */
type TextColor = Extract<
  ColorName,
  'ink' | 'inkSoft' | 'inkFaint' | 'penGreen' | 'danger' | 'paper'
>;

export type TextProps = RNTextProps & {
  variant?: Variant;
  /** Override the variant's colour with a token name. Never a raw hex. */
  color?: TextColor;
};

/**
 * The only Text used in the app. Screens name a role from the type scale
 * rather than a font and a size, so the app's voice lives in typography.ts
 * and changing it is one edit rather than a hundred.
 *
 * The variant carries the size and the face; the palette carries the value.
 * Between them there is `variantColor`, which is why a screen can say
 * `variant="caption"` and get the right quietness in any theme.
 */
export function Text({ variant = 'body', color, style, ...rest }: TextProps) {
  const palette = useColor();

  return (
    <RNText
      style={[type[variant], { color: palette[color ?? variantColor[variant]] }, style]}
      {...rest}
    />
  );
}
