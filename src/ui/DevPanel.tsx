import { Pressable, StyleSheet, View } from 'react-native';

import { plantFor } from '../domain/plants';
import {
  nextFreeSlot,
  PLOT_SIZE,
  STARTER_GARDEN,
  withNextGarden,
} from '../domain/plots';
import {
  DAYS_AT_STAGE_TO_OFFER,
  SESSIONS_TO_OFFER,
} from '../domain/progression';
import { FINAL_STAGE } from '../domain/stages';
import { DEV_CLOCK_MS } from '../session/devClock';
import { hairline, radius, space } from '../theme/tokens';
import { useColor } from '../theme/useColor';
import { __replaceState, __reset, getState, setStage, useSettings } from '../store';
import { Session } from '../store/types';
import { Text } from './Text';

const DAY = 86_400_000;
const TEN_MINUTES = 600_000;

/**
 * Developer shortcuts, and the whole of what `settings.devMode` unlocks.
 *
 * These exist because the interesting states of this app are the slow ones:
 * the 108th plant, and a stage offer that needs twenty sessions across three
 * weeks. Waiting for either by hand is not a realistic way to check they work.
 *
 * Two gates rather than one, and the second is why this is no longer folded out
 * of a release build. `__DEV__` covers the ordinary loop over Metro; the stored
 * setting covers the states only a release APK can reach at all — both
 * notification paths, and the status bar the plugin config hides — where
 * `__DEV__` is false by construction and this panel used to simply not exist.
 * The cost is that everything below now ships, which is what a switch in the
 * settings means.
 */
export function DevPanel() {
  const color = useColor();
  const settings = useSettings();

  if (!__DEV__ && !settings.devMode) return null;

  const seed = (n: number) => {
    const { sessions, progress } = getState();
    const now = Date.now();

    // Seeding runs past the end of a garden, which real sittings cannot: the
    // app asks what size to grow next, and there is nobody here to answer. A
    // 108 is what these buttons are for — the interesting states are the ones
    // a full mala takes to reach.
    let gardens = progress.gardens;

    const added: Session[] = [];
    for (let i = 0; i < n; i++) {
      const grown = [...sessions, ...added];
      if (nextFreeSlot(grown, gardens) === null) {
        gardens = withNextGarden(gardens, PLOT_SIZE);
      }

      const completedAt = now - (n - i) * DAY;
      const id = `dev-${completedAt}-${i}`;
      added.push({
        id,
        startedAt: completedAt - TEN_MINUTES,
        durationMs: TEN_MINUTES,
        completedAt,
        stage: progress.stage,
        // One plant per seeded sitting, in the first free dot — the shape a
        // ten-minute sitting takes when its single-plant offer is accepted.
        plants: [
          { key: plantFor(id), slot: nextFreeSlot(grown, gardens) as number },
        ],
      });
    }

    __replaceState({
      sessions: [...sessions, ...added],
      progress: { ...progress, gardens },
    });
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
    <View style={[styles.panel, { borderColor: color.inkFaint }]}>
      <Text variant="label" color="inkSoft">
        Dev only
      </Text>
      {/* Said out loud, because a five-second sitting is the one shortcut that
          changes what the app does rather than what is in it, and forgetting it
          is on would make every timing on the phone a lie. */}
      {settings.devMode && (
        <Text variant="caption" color="inkSoft">
          Sittings end after {DEV_CLOCK_MS / 1000} s
        </Text>
      )}
      <View style={styles.row}>
        <DevButton label="+1" onPress={() => seed(1)} />
        {/* Fills the starter bed exactly, so the ask screen is one tap away. */}
        <DevButton label={`+${STARTER_GARDEN}`} onPress={() => seed(STARTER_GARDEN)} />
        <DevButton label="+10" onPress={() => seed(10)} />
        <DevButton label={`+${PLOT_SIZE}`} onPress={() => seed(PLOT_SIZE)} />
      </View>
      <View style={styles.row}>
        <DevButton label="Next stage" onPress={bumpStage} />
        <DevButton label="Arm offer" onPress={armAdvanceOffer} />
        {/* Reset empties the garden and sends the app back to onboarding. It is
            the only irreversible button in the app, so it says so — and on a
            release build it also puts this panel away, `devMode` being one of
            the settings a fresh install does not have. The Developer card is
            still there to turn it back on. */}
        <DevButton label="Reset" onPress={__reset} destructive />
      </View>
    </View>
  );
}

function DevButton({
  label,
  onPress,
  destructive = false,
}: {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  const color = useColor();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { borderColor: color.inkFaint },
        pressed && styles.pressed,
      ]}>
      <Text variant="caption" color={destructive ? 'danger' : 'inkSoft'}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: hairline,
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
    borderRadius: radius.card,
  },
  pressed: {
    opacity: 0.6,
  },
});
