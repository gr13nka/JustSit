import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { shouldOfferAdvance } from '../../src/domain/progression';
import { space } from '../../src/theme/tokens';
import { useProgress, useSessions } from '../../src/store';
import { Button } from '../../src/ui/Button';
import { Plant } from '../../src/ui/Plant';
import { Screen } from '../../src/ui/Screen';
import { Text } from '../../src/ui/Text';

/**
 * The plant reveal. Nothing is measured back at the user here — no elapsed
 * time, no streak, no "well done". Something grew; that is the whole message.
 */
export default function CompleteScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const sessions = useSessions();
  const progress = useProgress();

  const session = sessions.find((s) => s.id === sessionId);

  const done = () => {
    if (shouldOfferAdvance(progress, sessions)) {
      router.replace('/session/advance');
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <Screen center edges={['top', 'bottom']}>
      <View style={styles.middle}>
        {session && <Plant plant={session.plant} size={120} />}
        <Text variant="title" style={styles.line}>
          Something grew.
        </Text>
      </View>

      <Button label="Done" onPress={done} style={styles.done} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  middle: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xl,
  },
  line: {
    letterSpacing: 1,
  },
  done: {
    alignSelf: 'stretch',
    marginBottom: space.lg,
  },
});
