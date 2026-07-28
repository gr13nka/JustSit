import { Pressable, StyleSheet, View } from 'react-native';

import { plantFor } from '../domain/plants';
import { nextFreeSlot, PLOT_SIZE } from '../domain/plots';
import {
  DAYS_AT_STAGE_TO_OFFER,
  SESSIONS_TO_OFFER,
} from '../domain/progression';
import { FINAL_STAGE } from '../domain/stages';
import { color, hairline, radius, space } from '../theme/tokens';
import { __replaceState, __reset, getState, setStage } from '../store';
import { Session } from '../store/types';
import { Text } from './Text';

const DAY = 86_400_000;
const TEN_MINUTES = 600_000;

/**
 * Development-only shortcuts. Stripped from release builds by the `__DEV__`
 * guard, which Metro constant-folds away.
 *
 * These exist because the interesting states of this app are the slow ones:
 * the 108th plant, and a stage offer that needs twenty sessions across three
 * weeks. Waiting for either by hand is not a realistic way to check they work.
 */
export function DevPanel() {
  if (!__DEV__) return null;

  const seed = (n: number) => {
    const { sessions, progress } = getState();
    const now = Date.now();

    const added: Session[] = [];
    for (let i = 0; i < n; i++) {
      const completedAt = now - (n - i) * DAY;
      const id = `dev-${completedAt}-${i}`;
      added.push({
        id,
        startedAt: completedAt - TEN_MINUTES,
        durationMs: TEN_MINUTES,
        completedAt,
        stage: progress.stage,
        plant: plantFor(id),
        // Each seeded plant takes the first free dot, exactly as a real sitting
        // would when the user has not picked one.
        slot: nextFreeSlot([...sessions, ...added]),
      });
    }

    __replaceState({ sessions: [...sessions, ...added] });
  };

  /** Puts the store exactly at the threshold, so the next Done offers a stage. */
  const armAdvanceOffer = () => {
    const { progress } = getState();
    __replaceState({
      progress: {
        ...progress,
        stageStartedAt: Date.now() - (DAYS_AT_STAGE_TO_OFFER + 1) * DAY,
        lastOfferedAt: null,
      },
    });
    seed(SESSIONS_TO_OFFER);
  };

  const bumpStage = () => {
    const { progress } = getState();
    setStage(progress.stage >= FINAL_STAGE ? 1 : progress.stage + 1);
  };

  return (
    <View style={styles.panel}>
      <Text variant="label" color="inkSoft">
        Dev only
      </Text>
      <View style={styles.row}>
        <DevButton label="+1" onPress={() => seed(1)} />
        <DevButton label="+10" onPress={() => seed(10)} />
        <DevButton label={`+${PLOT_SIZE}`} onPress={() => seed(PLOT_SIZE)} />
      </View>
      <View style={styles.row}>
        <DevButton label="Next stage" onPress={bumpStage} />
        <DevButton label="Arm offer" onPress={armAdvanceOffer} />
        <DevButton label="Reset" onPress={__reset} />
      </View>
    </View>
  );
}

function DevButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <Text variant="caption" color="inkSoft">
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: hairline,
    borderColor: color.line,
    borderRadius: radius.card,
    borderStyle: 'dashed',
    padding: space.md,
    gap: space.sm,
  },
  row: {
    flexDirection: 'row',
    gap: space.sm,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.sm,
    borderWidth: hairline,
    borderColor: color.line,
    borderRadius: radius.card,
  },
  pressed: {
    opacity: 0.6,
  },
});
