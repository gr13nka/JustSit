import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { prepareBells, ringBell } from '../../src/session/bells';
import { useSession } from '../../src/session/useSession';
import { space } from '../../src/theme/tokens';
import { recordCompletedSession } from '../../src/store';
import { Button } from '../../src/ui/Button';
import { Clock } from '../../src/ui/Clock';
import { Screen } from '../../src/ui/Screen';
import { TimerRing } from '../../src/ui/TimerRing';

const PREVIEW_PLANT = 'grass';

export default function RunScreen() {
  const params = useLocalSearchParams<{ durationMs: string }>();
  const durationMs = Number(params.durationMs);

  // Fixed at mount. Everything downstream derives from wall time, so a re-render
  // must never restart the clock.
  const [startedAt] = useState(() => Date.now());
  const opened = useRef(false);

  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    void prepareBells().then(() => ringBell('in'));
  }, []);

  const { remainingMs } = useSession({
    startedAt,
    durationMs,
    onComplete: () => {
      const session = recordCompletedSession({ startedAt, durationMs });
      router.replace({
        pathname: '/session/complete',
        params: { sessionId: session.id },
      });
    },
  });

  /**
   * Leaving early records nothing. No plant, no message, no "are you sure" —
   * the garden only ever shows completed sittings, and being scolded by a
   * meditation app is worse than the missed session.
   */
  const leave = () => router.replace('/(tabs)');

  return (
    <Screen center edges={['top', 'bottom']}>
      <View style={styles.middle}>
        <TimerRing
          plant={PREVIEW_PLANT}
          spent={durationMs > 0 ? 1 - remainingMs / durationMs : 0}
        />
        <View style={styles.clock}>
          <Clock ms={remainingMs} />
        </View>
      </View>

      <Button label="End" variant="quiet" onPress={leave} style={styles.end} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  middle: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clock: {
    marginTop: space.xl,
  },
  end: {
    marginBottom: space.lg,
  },
});
