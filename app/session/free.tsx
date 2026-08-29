import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useSettings, updateSettings } from '../../src/store';
import { space } from '../../src/theme/tokens';
import { BackHeader } from '../../src/ui/BackHeader';
import { Button } from '../../src/ui/Button';
import { Screen } from '../../src/ui/Screen';
import { Text } from '../../src/ui/Text';
import { TimerRing } from '../../src/ui/TimerRing';

const MINUTE = 60_000;
const MIN_MINUTES = 2;
const MAX_MINUTES = 60;

export default function FreeSittingScreen() {
  const settings = useSettings();
  const [minutes, setMinutes] = useState(() => clampMinutes(settings.lastDurationMs));

  const change = (delta: number) => {
    setMinutes((current) => Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, current + delta)));
  };

  const begin = () => {
    const durationMs = minutes * MINUTE;
    updateSettings({ lastDurationMs: durationMs });
    router.push({ pathname: '/session/run', params: { durationMs: String(durationMs) } });
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <BackHeader onBack={() => router.back()} />

      <View style={styles.middle}>
        <TimerRing plant="grass" />
        <Text variant="caption" color="inkSoft">Free sitting</Text>
        <View style={styles.stepper} accessibilityRole="adjustable" accessibilityLabel="Sitting duration">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Shorten sitting"
            accessibilityState={{ disabled: minutes <= MIN_MINUTES }}
            disabled={minutes <= MIN_MINUTES}
            onPress={() => change(-1)}
            hitSlop={space.md}
            style={({ pressed }) => [styles.adjust, pressed && styles.pressed]}>
            <Text variant="title" color={minutes <= MIN_MINUTES ? 'inkFaint' : 'ink'}>-</Text>
          </Pressable>
          <Text variant="display" style={styles.value}>{minutes}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Lengthen sitting"
            accessibilityState={{ disabled: minutes >= MAX_MINUTES }}
            disabled={minutes >= MAX_MINUTES}
            onPress={() => change(1)}
            hitSlop={space.md}
            style={({ pressed }) => [styles.adjust, pressed && styles.pressed]}>
            <Text variant="title" color={minutes >= MAX_MINUTES ? 'inkFaint' : 'ink'}>+</Text>
          </Pressable>
        </View>
        <Text variant="caption" color="inkSoft">minutes</Text>
      </View>

      <Button label="Meditate" variant="wobbly" onPress={begin} style={styles.start} />
    </Screen>
  );
}

function clampMinutes(durationMs: number | null): number {
  const minutes = durationMs === null ? 20 : Math.round(durationMs / MINUTE);
  return Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, minutes));
}

const styles = StyleSheet.create({
  middle: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xl,
    minHeight: 72,
  },
  adjust: {
    minWidth: 44,
    alignItems: 'center',
  },
  value: {
    minWidth: 96,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  start: {
    alignSelf: 'stretch',
    marginBottom: space.lg,
  },
});
