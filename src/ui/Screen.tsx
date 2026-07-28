import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';

import { color, space } from '../theme/tokens';

type ScreenProps = {
  children: ReactNode;
  /** Centres content vertically — used by the session and welcome screens. */
  center?: boolean;
  /** Which safe-area edges to inset. Tab screens skip 'bottom' (the bar handles it). */
  edges?: readonly Edge[];
  style?: ViewStyle;
};

/**
 * Every screen sits on paper. Nothing in the app has a white background.
 */
export function Screen({
  children,
  center = false,
  edges = ['top'],
  style,
}: ScreenProps) {
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      <View style={[styles.body, center && styles.center, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: color.paper,
  },
  body: {
    flex: 1,
    paddingHorizontal: space.lg,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
