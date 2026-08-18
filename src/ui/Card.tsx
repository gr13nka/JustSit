import { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { radius, space } from '../theme/tokens';
import { useColor } from '../theme/useColor';
import { useOrganicCorners } from './useOrganicCorners';

/**
 * The app's card: paper laid on paper, closed with four generous corners that
 * don't quite agree — and no border. A filled box with an ink outline reads as
 * a comic panel, not a page; the kit keeps fill and outline as separate card
 * variants and this app uses only the filled one. Separation is the darker
 * paper alone.
 */
export function Card({
  children,
  cornerSeed,
  style,
}: {
  children: ReactNode;
  /** Only where this card's exact corners matter; otherwise they see to themselves. */
  cornerSeed?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const color = useColor();
  const corners = useOrganicCorners(radius.lg, cornerSeed);

  return (
    <View style={[styles.card, { backgroundColor: color.paperDeep }, corners, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: space.lg,
  },
});
