import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { stageAt } from '../src/domain/stages';
import { requestPermission, setDailyReminder } from '../src/session/notifications';
import { color, hairline, space } from '../src/theme/tokens';
import { completeOnboarding, updateSettings } from '../src/store';
import { Button } from '../src/ui/Button';
import { Screen } from '../src/ui/Screen';
import { SittingFigure } from '../src/ui/SittingFigure';
import { Text } from '../src/ui/Text';
import { fromHhMm, toHhMm } from '../src/ui/time';

type Step = 'welcome' | 'reminder' | 'stage';

/**
 * Three screens, once. No account, no questionnaire, no goal-setting — the app
 * has nothing it needs from the user before they can sit down.
 */
export default function Onboarding() {
  const [step, setStep] = useState<Step>('welcome');
  const [pickerOpen, setPickerOpen] = useState(false);
  const stageOne = stageAt(1);

  const finish = () => {
    completeOnboarding();
    router.replace('/(tabs)');
  };

  const onPickTime = async (event: DateTimePickerEvent, date?: Date) => {
    setPickerOpen(false);
    if (event.type !== 'set' || !date) return;

    const granted = await requestPermission();
    if (!granted) {
      setStep('stage');
      return;
    }

    const hhmm = toHhMm(date);
    updateSettings({ reminderAt: hhmm });
    await setDailyReminder(hhmm);
    setStep('stage');
  };

  if (step === 'welcome') {
    return (
      <Screen edges={['top', 'bottom']}>
        <View style={styles.body}>
          <Text variant="display" style={styles.title}>
            JUST SIT
          </Text>
          <Text variant="caption" style={styles.motto}>
            Calm mind. Clear path.{'\n'}Every day.
          </Text>
          <View style={styles.figure}>
            <SittingFigure />
          </View>
        </View>

        <View style={styles.footer}>
          <Button
            label="Begin"
            onPress={() => setStep('reminder')}
            style={styles.primary}
          />
        </View>
      </Screen>
    );
  }

  if (step === 'reminder') {
    return (
      <Screen edges={['top', 'bottom']}>
        <View style={styles.body}>
          <Text variant="label">One reminder</Text>
          <View style={styles.rule} />
          <Text variant="teaching">
            A consistent cue is the strongest thing you can give a new habit. One
            quiet nudge a day, at a time you pick — and nothing else, ever.
          </Text>
        </View>

        <View style={styles.footer}>
          <Button
            label="Choose a time"
            onPress={() => setPickerOpen(true)}
            style={styles.primary}
          />
          <Button label="Not now" variant="quiet" onPress={() => setStep('stage')} />
        </View>

        {pickerOpen && (
          <DateTimePicker mode="time" value={fromHhMm('07:30')} onChange={onPickTime} />
        )}
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.body}>
        <Text variant="label">
          Stage {stageOne.number} · {stageOne.name}
        </Text>
        <Text variant="caption" style={styles.practice}>
          {stageOne.practice}
        </Text>
        <View style={styles.rule} />
        <Text variant="teaching">{stageOne.felt}</Text>
        <Text variant="caption" style={styles.note}>
          There are ten stages, and they are meant to take a long time. The app
          will suggest moving on when it seems reasonable to ask — you decide.
        </Text>
      </View>

      <View style={styles.footer}>
        <Button label="Start where you are" onPress={finish} style={styles.primary} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
  },
  motto: {
    textAlign: 'center',
    marginTop: space.md,
    lineHeight: 22,
  },
  figure: {
    alignItems: 'center',
    marginTop: space.xxl,
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
  note: {
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
