import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { stageAt } from '../src/domain/stages';
import { requestPermission, setDailyReminder } from '../src/session/notifications';
import { space } from '../src/theme/tokens';
import { completeOnboarding, updateSettings } from '../src/store';
import { Baton } from '../src/ui/Baton';
import { Button } from '../src/ui/Button';
import { Rule } from '../src/ui/Rule';
import { Screen } from '../src/ui/Screen';
import { SittingFigure } from '../src/ui/SittingFigure';
import { Text } from '../src/ui/Text';
import { fromHhMm, toHhMm } from '../src/ui/time';

type Step = 'welcome' | 'reminder' | 'stage';

/**
 * Shorter than the figure's default. The welcome step also carries a scrawled
 * title, a tagline and a button, and at the full size the hero pushes the button
 * against the bottom of a small screen.
 */
const FIGURE_SIZE = 200;

/** A doodle in the margin, not a second hero. */
const BATON_SIZE = 100;

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
          {/*
            The one place a tagline is allowed the hand face: two short felt
            lines, kept softer than the title so the app still says its own name
            loudest. Anything longer than this belongs to the reading face.
          */}
          <Text variant="hand" color="inkSoft" style={styles.motto}>
            Calm mind. Clear path.{'\n'}Every day.
          </Text>
          <View style={styles.figure}>
            <SittingFigure size={FIGURE_SIZE} />
          </View>
        </View>

        <View style={styles.footer}>
          {/*
            Drawn rather than styled, like Meditate. This is the other button in
            the app that commits you to something — the first one, in fact — and
            a committing button is the one place the pen is allowed on a control.
          */}
          <Button
            label="Begin"
            variant="wobbly"
            onPress={() => setStep('reminder')}
            style={styles.stretch}
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
          <Rule />
          <Text variant="teaching">
            A consistent cue is the strongest thing you can give a new habit. One
            quiet nudge a day, at a time you pick — and nothing else, ever.
          </Text>
          {/*
            Asleep, and off to one side of the paragraph rather than under the
            title: what is being promised here is one quiet nudge a day, and a
            wide-awake mascot in the middle of the page would promise the
            opposite.
          */}
          <View style={styles.baton}>
            <Baton size={BATON_SIZE} />
          </View>
        </View>

        <View style={styles.footer}>
          <Button
            label="Choose a time"
            onPress={() => setPickerOpen(true)}
            style={styles.stretch}
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
        <Rule />
        <Text variant="teaching">{stageOne.felt}</Text>
        <Text variant="caption" style={styles.note}>
          There are ten stages, and they are meant to take a long time. The app
          will suggest moving on when it seems reasonable to ask — you decide.
        </Text>
      </View>

      <View style={styles.footer}>
        <Button label="Start where you are" onPress={finish} style={styles.stretch} />
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
  },
  figure: {
    alignItems: 'center',
    marginTop: space.xl,
  },
  practice: {
    marginTop: space.xs,
  },
  baton: {
    alignSelf: 'flex-end',
    marginTop: space.lg,
  },
  note: {
    marginTop: space.xl,
  },
  footer: {
    paddingBottom: space.lg,
    gap: space.xs,
  },
  /** The footer button spans the screen; the quiet one below it does not. */
  stretch: {
    alignSelf: 'stretch',
  },
});
