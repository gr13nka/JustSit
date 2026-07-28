import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { nextTip, sessionsAtStage } from '../../src/domain/progression';
import { stageAt } from '../../src/domain/stages';
import { color, hairline, space } from '../../src/theme/tokens';
import { markTipSeen, useProgress, useSessions } from '../../src/store';
import { Screen } from '../../src/ui/Screen';
import { Text } from '../../src/ui/Text';

const ROMAN = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

/**
 * One idea, then you begin.
 *
 * The restraint is the design: a sitting should open with a single thing to
 * hold, not a briefing. So there are no buttons — the card itself is the way
 * through, and the only mark on the screen is the word telling you so. A
 * "Begin" button would make this a form to get past; without one it is a page
 * you finish reading.
 *
 * The way back out is the swipe, enabled for this route in the session layout.
 * Silent on purpose: printing "not now" beside a paragraph that just asked for
 * your attention is an odd thing to do.
 */
export default function TipScreen() {
  const { durationMs, slot } = useLocalSearchParams<{
    durationMs: string;
    slot: string;
  }>();
  const progress = useProgress();
  const sessions = useSessions();
  const stage = stageAt(progress.stage);

  // Resolved once, so the card cannot change under the user between reading it
  // and tapping Begin.
  const [tip] = useState(() =>
    nextTip(stage, progress.seenTipIds, sessionsAtStage(sessions, stage.number))
  );

  const begin = () => {
    // Marked here rather than on render: backing out should not spend a tip.
    markTipSeen(tip.id);
    router.replace({ pathname: '/session/run', params: { durationMs, slot } });
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Begin the sitting"
      onPress={begin}
      style={styles.sheet}>
      <Screen edges={['top', 'bottom']}>
        <View style={styles.body}>
          <Text variant="label">Stage {ROMAN[stage.number]}</Text>
          <Text variant="caption" style={styles.practice}>
            {stage.practice}
          </Text>

          <View style={styles.rule} />

          <Text variant="teaching">{tip.body}</Text>
        </View>

        <View style={styles.footer}>
          <Text variant="caption" style={styles.hint}>
            tap
          </Text>
        </View>
      </Screen>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    justifyContent: 'center',
  },
  practice: {
    marginTop: space.xs,
  },
  rule: {
    width: 48,
    borderBottomWidth: hairline,
    borderBottomColor: color.line,
    marginVertical: space.lg,
  },
  sheet: {
    flex: 1,
  },
  footer: {
    paddingBottom: space.lg,
    alignItems: 'center',
  },
  hint: {
    letterSpacing: 2,
  },
});
