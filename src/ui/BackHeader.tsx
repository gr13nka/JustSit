import { Pressable, StyleSheet, View } from 'react-native';

import { space } from '../theme/tokens';
import { useColor } from '../theme/useColor';
import { ArrowLeft } from './icons';
import { Text } from './Text';

/** Small enough to read as a mark on the page rather than as a control. */
const ARROW_SIZE = 24;

/**
 * A screen title with the way back beside it.
 *
 * The arrow is positioned rather than laid out, so the title is centred on the
 * *screen* and not on what is left of it — a heading that shifted a few points
 * sideways depending on whether you could go back would be the app fidgeting.
 * It is also why the arrow belongs here and not on the screen: an absolutely
 * positioned child of a padded box is inset by that padding on a phone and not
 * in the browser, so a hand-rolled one lands in two different places on the two
 * targets this app is judged on.
 *
 * A screen that titles itself in its own copy passes no title and gets the row
 * with only the arrow in it, which is the whole of what it needs from here.
 *
 * It is the hand-drawn arrow, which is the only mark this app uses for "out of
 * here": the same one that leaves a sitting.
 */
export function BackHeader({ title, onBack }: { title?: string; onBack?: () => void }) {
  const color = useColor();

  return (
    <View style={styles.head}>
      {onBack && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack}
          hitSlop={space.md}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
          <ArrowLeft color={color.ink} size={ARROW_SIZE} />
        </Pressable>
      )}
      {title !== undefined && <Text variant="title">{title}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.md,
    // The arrow is out of the flow, so a row without a title would otherwise be
    // nothing but its own padding. Under the height a title gives the row, so
    // this only ever decides the untitled one.
    minHeight: ARROW_SIZE + space.md,
  },
  back: {
    position: 'absolute',
    left: 0,
  },
  /** Ink settling, the same as everywhere else. */
  pressed: {
    opacity: 0.6,
  },
});
