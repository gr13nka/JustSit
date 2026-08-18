import { ReactNode, useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { useColor } from '../theme/useColor';
import { BOUNCE, usePressSettle } from './motion';
import { useOrganicCorners } from './useOrganicCorners';

/**
 * The sliding selector: one accent marker that travels to the chosen item.
 *
 * Every item stays legible at rest — nothing lights up in place, nothing
 * collapses to a dot — so the marker arriving under an item is the only thing
 * that says which one is chosen. That is why the marker is a separate view
 * rather than a style on the selected item: only something positioned
 * continuously can move *between* two of them.
 *
 * This owns where the marker is and how it gets there. What each item draws,
 * and what the row sits in, belong to the caller: the screen switcher floats in
 * a bar of its own and draws doodles, the duration picker sits in a card and
 * draws numbers, and neither needs to know how the other looks.
 *
 * Items are a fixed width by contract, which is what keeps the travel to a
 * single `translateX` and therefore on the native driver. It also means there
 * is nothing to measure: the marker's position is arithmetic, available on the
 * first frame, with no layout pass that could show it briefly in the wrong place.
 */

/** Pushed past the usual asymmetry, so the fill reads as drawn rather than stamped. */
const MARKER_RADIUS = 9;
const MARKER_SEED = 7;

export function Slider({
  count,
  index,
  onSelect,
  itemWidth,
  itemHeight,
  gap,
  hitSlop = 0,
  role,
  labelFor,
  renderItem,
}: {
  count: number;
  index: number;
  onSelect: (index: number) => void;
  itemWidth: number;
  itemHeight: number;
  gap: number;
  /** Touch target padding beyond the drawn box, for small items. */
  hitSlop?: number;
  /** 'tab' for the screen switcher, 'radio' for a single choice among options. */
  role: 'tab' | 'radio';
  labelFor: (index: number) => string;
  /** `active` is true for the item the marker has arrived at. */
  renderItem: (index: number, active: boolean) => ReactNode;
}) {
  const color = useColor();
  const corners = useOrganicCorners(MARKER_RADIUS, MARKER_SEED);

  const step = itemWidth + gap;
  const travel = useRef(new Animated.Value(index * step)).current;
  // The first placement is not a choice anybody made, so it must not animate:
  // a marker sliding in from the left on launch reads as the app picking
  // something for you.
  const placed = useRef(false);

  useEffect(() => {
    const to = index * step;
    if (!placed.current) {
      placed.current = true;
      travel.setValue(to);
      return;
    }

    const animation = Animated.timing(travel, {
      toValue: to,
      duration: 250,
      easing: BOUNCE,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [index, step, travel]);

  return (
    <View style={[styles.row, { gap }]}>
      <Animated.View
        // Behind the items, so what is drawn reads on top of the fill.
        style={[
          styles.marker,
          corners,
          {
            width: itemWidth,
            height: itemHeight,
            backgroundColor: color.accent,
            transform: [{ translateX: travel }],
          },
        ]}
      />

      {Array.from({ length: count }, (_, i) => (
        <SliderItem
          key={i}
          width={itemWidth}
          height={itemHeight}
          hitSlop={hitSlop}
          role={role}
          label={labelFor(i)}
          active={i === index}
          onPress={() => onSelect(i)}>
          {renderItem(i, i === index)}
        </SliderItem>
      ))}
    </View>
  );
}

function SliderItem({
  width,
  height,
  hitSlop,
  role,
  label,
  active,
  onPress,
  children,
}: {
  width: number;
  height: number;
  hitSlop: number;
  role: 'tab' | 'radio';
  label: string;
  active: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  const { onPressIn, onPressOut, settleStyle } = usePressSettle();

  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      hitSlop={hitSlop}
      style={[styles.item, { width, height }]}>
      <Animated.View style={[styles.itemInner, settleStyle]}>{children}</Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    // The marker is positioned against this box.
    position: 'relative',
  },
  marker: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  item: {
    // Lifts the drawing above the travelling marker.
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
