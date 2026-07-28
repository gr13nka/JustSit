import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { stageAt } from '../../src/domain/stages';
import { color, hairline, space } from '../../src/theme/tokens';
import { noteAdvanceOffered, setStage, useProgress } from '../../src/store';
import { Button } from '../../src/ui/Button';
import { Screen } from '../../src/ui/Screen';
import { Text } from '../../src/ui/Text';

/**
 * The stage-readiness card.
 *
 * This is a question, not an award. The app has only noticed that enough time
 * and enough sittings have passed to make the question reasonable — whether the
 * next stage describes your mind is something only you can answer, which is
 * exactly how Wallace frames the stages.
 *
 * "Not yet" is a real answer and costs nothing.
 */
export default function AdvanceScreen() {
  const progress = useProgress();
  const next = stageAt(Math.min(progress.stage + 1, 10));

  const yes = () => {
    setStage(next.number);
    router.replace('/(tabs)');
  };

  const notYet = () => {
    noteAdvanceOffered();
    router.replace('/(tabs)');
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.body}>
        <Text variant="label">Stage {next.number} · {next.name}</Text>

        <View style={styles.rule} />

        <Text variant="teaching">{next.felt}</Text>

        <Text variant="caption" style={styles.question}>
          Does that describe your practice at the moment?
        </Text>
      </View>

      <View style={styles.footer}>
        <Button label="Yes, that sounds right" onPress={yes} style={styles.primary} />
        <Button label="Not yet" variant="quiet" onPress={notYet} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    justifyContent: 'center',
  },
  rule: {
    width: 48,
    borderBottomWidth: hairline,
    borderBottomColor: color.line,
    marginVertical: space.lg,
  },
  question: {
    marginTop: space.xl,
  },
  footer: {
    paddingBottom: space.lg,
    gap: space.xs,
  },
  primary: {
    alignSelf: 'stretch',
  },
});
