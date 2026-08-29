import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { hairline, radius, space } from '../theme/tokens';
import { useColor } from '../theme/useColor';
import { boxPath } from './box';
import { Button } from './Button';
import { Text } from './Text';
import { fromHhMm } from './time';
import { useOrganicCorners } from './useOrganicCorners';

const DEFAULT_TIME = '07:30';

export function ReminderTimeMenu({
  initial = DEFAULT_TIME,
  onCancel,
  onPick,
}: {
  initial?: string | null;
  onCancel: () => void;
  onPick: (date: Date) => void;
}) {
  const color = useColor();
  const [hour, setHour] = useState(() => readPart(initial, 0, 23, 7));
  const [minute, setMinute] = useState(() => readPart(initial, 3, 59, 30));
  const corners = useOrganicCorners(radius.lg, 17);
  const hhmm = `${pad(hour)}:${pad(minute)}`;

  const commit = () => onPick(fromHhMm(hhmm));

  return (
    <View style={[styles.menu, corners, { borderColor: color.inkFaint }]}>
      <Text variant="hand" style={styles.time}>
        {hhmm}
      </Text>
      <View style={styles.columns}>
        <TimeColumn
          label="Hour"
          value={hour}
          onStep={(delta) => setHour((current) => wrap(current + delta, 24))}
        />
        <TimeColumn
          label="Minute"
          value={minute}
          onStep={(delta) => setMinute((current) => wrap(current + delta, 60))}
        />
      </View>
      <View style={styles.buttons}>
        <Button label="Cancel" variant="quiet" onPress={onCancel} />
        <Button label="Set" variant="wobbly" onPress={commit} />
      </View>
    </View>
  );
}

function TimeColumn({
  label,
  value,
  onStep,
}: {
  label: string;
  value: number;
  onStep: (delta: number) => void;
}) {
  return (
    <View style={styles.column}>
      <Text variant="label">{label}</Text>
      <View style={styles.stepper}>
        <StepButton label="-" seed={value} onPress={() => onStep(-1)} />
        <View style={styles.value}>
          <Text variant="stat">{pad(value)}</Text>
        </View>
        <StepButton label="+" seed={value + 1} onPress={() => onStep(1)} />
      </View>
    </View>
  );
}

function StepButton({
  label,
  seed,
  onPress,
}: {
  label: string;
  seed: number;
  onPress: () => void;
}) {
  const color = useColor();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label === '-' ? 'Decrease' : 'Increase'}
      onPress={onPress}
      style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}>
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Path
          d={boxPath(STEP_BUTTON, STEP_BUTTON, radius.sm + (seed % 3))}
          fill="transparent"
          stroke={color.inkFaint}
          strokeWidth={hairline}
        />
      </Svg>
      <Text variant="title">{label}</Text>
    </Pressable>
  );
}

function readPart(hhmm: string | null | undefined, start: number, max: number, fallback: number) {
  const value = Number((hhmm ?? DEFAULT_TIME).slice(start, start + 2));
  if (!Number.isInteger(value) || value < 0 || value > max) return fallback;
  return value;
}

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

function wrap(value: number, size: number): number {
  return (value + size) % size;
}

const STEP_BUTTON = 44;

const styles = StyleSheet.create({
  menu: {
    marginTop: space.md,
    padding: space.md,
    gap: space.md,
    borderWidth: hairline,
  },
  time: {
    textAlign: 'center',
  },
  columns: {
    flexDirection: 'row',
    gap: space.lg,
  },
  column: {
    flex: 1,
    gap: space.xs,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  stepButton: {
    width: STEP_BUTTON,
    height: STEP_BUTTON,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    flex: 1,
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.65,
  },
  buttons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: space.sm,
  },
});
