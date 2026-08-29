import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { stageAt } from '../../src/domain/stages';
import { daysSat } from '../../src/domain/stats';
import { requestPermission, setDailyReminder } from '../../src/session/notifications';
import { space } from '../../src/theme/tokens';
import { useColor } from '../../src/theme/useColor';
import {
  resetProgress,
  updateSettings,
  useNotes,
  useProgress,
  useSessions,
  useSettings,
} from '../../src/store';
import { Card } from '../../src/ui/Card';
import { DevPanel } from '../../src/ui/DevPanel';
import { ArrowRight } from '../../src/ui/icons';
import { ReminderTimeMenu } from '../../src/ui/ReminderTimeMenu';
import { Rule } from '../../src/ui/Rule';
import { Screen } from '../../src/ui/Screen';
import { Text } from '../../src/ui/Text';
import { TimedConfirm } from '../../src/ui/TimedConfirm';
import { toHhMm } from '../../src/ui/time';

/**
 * Small enough to read as a mark beside the words rather than a control of its
 * own. It is what tells you the row is tappable, now that no colour does.
 */
const ARROW_SIZE = 18;

export default function YouScreen() {
  const color = useColor();
  const progress = useProgress();
  const settings = useSettings();
  const sessions = useSessions();
  const notes = useNotes();
  const stage = stageAt(progress.stage);
  const days = daysSat(sessions);

  const [pickerOpen, setPickerOpen] = useState(false);

  const onPickTime = async (date: Date) => {
    setPickerOpen(false);

    // Ask only at the moment the user has actually chosen a time — a permission
    // prompt before they've expressed any interest is just an interruption.
    const granted = await requestPermission();
    if (!granted) return;

    const hhmm = toHhMm(date);
    updateSettings({ reminderAt: hhmm });
    await setDailyReminder(hhmm);
  };

  const clearReminder = async () => {
    updateSettings({ reminderAt: null });
    await setDailyReminder(null);
  };

  const resetApp = () => {
    resetProgress();
    void setDailyReminder(null).catch(() => {});
    router.replace('/onboarding');
  };

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <Text variant="title">You</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Card style={styles.card}>
          <Text variant="label">
            Stage {stage.number} · {stage.name}
          </Text>
          <Text variant="caption" style={styles.practice}>
            {stage.practice}
          </Text>
          <Rule style={styles.rule} />
          <Text variant="body">{stage.felt}</Text>
        </Card>

        {/*
          The practice itself, as one number and the way to the rest of it.

          It used to print two figures and stop there, which made it the only
          card on this screen that answered a question rather than opening one.
          Folding them behind a row keeps the card count flat and puts the days
          somewhere they can be looked at properly — a week, four weeks, and the
          run they add up to.

          Reachable at nought, exactly as the notes are: "you have not sat yet"
          is a fact about the screen rather than a reason to hide it.
        */}
        <Card style={styles.card}>
          <Text variant="label">Days</Text>
          <Pressable
            onPress={() => router.push('/streak')}
            style={({ pressed }) => [styles.settingRow, pressed && styles.pressed]}>
            <Text variant="body" color={days === 0 ? 'inkSoft' : 'ink'}>
              {days === 0 ? 'Nothing yet' : `${days} ${days === 1 ? 'day' : 'days'} sat`}
            </Text>
            <View style={styles.action}>
              <Text variant="caption" color="ink">
                Look back
              </Text>
              <ArrowRight color={color.inkSoft} size={ARROW_SIZE} />
            </View>
          </Pressable>
        </Card>

        <Card style={styles.card}>
          <Text variant="label">Daily reminder</Text>
          <Pressable
            onPress={() => setPickerOpen(true)}
            style={({ pressed }) => [styles.settingRow, pressed && styles.pressed]}>
            <Text variant="body" color={settings.reminderAt ? 'ink' : 'inkSoft'}>
              {settings.reminderAt ?? 'Off'}
            </Text>
            <View style={styles.action}>
              <Text variant="caption" color="ink">
                {settings.reminderAt ? 'Change' : 'Set a time'}
              </Text>
              <ArrowRight color={color.inkSoft} size={ARROW_SIZE} />
            </View>
          </Pressable>
          {settings.reminderAt !== null && (
            <Pressable
              onPress={clearReminder}
              style={({ pressed }) => [styles.clear, pressed && styles.pressed]}>
              <Text variant="caption" color="inkSoft">
                Turn off
              </Text>
            </Pressable>
          )}
          {pickerOpen && (
            <ReminderTimeMenu
              initial={settings.reminderAt}
              onCancel={() => setPickerOpen(false)}
              onPick={onPickTime}
            />
          )}
        </Card>

        {/*
          The other collection this app keeps, and the only one that is words.
          Reachable at nought, because "you have not written anything" is a fact
          about the screen rather than a reason to hide it.
        */}
        <Card style={styles.card}>
          <Text variant="label">Notes</Text>
          <Pressable
            onPress={() => router.push('/notes')}
            style={({ pressed }) => [styles.settingRow, pressed && styles.pressed]}>
            <Text variant="body" color={notes.length === 0 ? 'inkSoft' : 'ink'}>
              {notes.length === 0
                ? 'Nothing yet'
                : `${notes.length} ${notes.length === 1 ? 'note' : 'notes'}`}
            </Text>
            <View style={styles.action}>
              <Text variant="caption" color="ink">
                Read them
              </Text>
              <ArrowRight color={color.inkSoft} size={ARROW_SIZE} />
            </View>
          </Pressable>
        </Card>

        {/*
          The one irreversible thing a user can do, and it is last because it is
          the only thing on this screen nobody came looking for. There is no
          dialog — this app has never shown one — so the question is asked in
          the row the word was standing in, and the sentence above it is the
          whole warning: plain, in the app's voice, saying what goes and what
          stays rather than asking whether you are sure.
        */}
        <Card style={styles.card}>
          <Text variant="label">Reset</Text>
          <Text variant="body" color="inkSoft">
            Clears every sitting, garden, note and setting, and starts again.
          </Text>
          <TimedConfirm label="Reset" question="Are you sure?" onConfirm={resetApp} />
        </Card>

        {/*
          Last, because it is the only thing on this screen that is not for the
          person the app is for. It is a card like any other rather than a
          gesture nobody would find by accident: a switch that has to be
          discovered is one nobody can turn off again either.

          What it unlocks can make a mess of a garden — a hundred seeded
          sittings are still sittings — so it sits below the reset that is the
          way back from one, and says plainly what it is.
        */}
        <Card style={styles.card}>
          <Text variant="label">Developer</Text>
          <Pressable
            onPress={() => updateSettings({ devMode: !settings.devMode })}
            style={({ pressed }) => [styles.settingRow, pressed && styles.pressed]}>
            <Text variant="body" color={settings.devMode ? 'ink' : 'inkSoft'}>
              {settings.devMode ? 'On' : 'Off'}
            </Text>
            <View style={styles.action}>
              <Text variant="caption" color="ink">
                {settings.devMode ? 'Turn off' : 'Turn on'}
              </Text>
              <ArrowRight color={color.inkSoft} size={ARROW_SIZE} />
            </View>
          </Pressable>
        </Card>

        <DevPanel />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    paddingVertical: space.md,
  },
  scroll: {
    // Clears the floating nav, which this list now runs underneath.
    paddingBottom: space.xxxl + space.lg,
    gap: space.md,
  },
  card: {
    gap: space.xs,
  },
  practice: {
    marginBottom: space.xs,
  },
  /**
   * Tighter than the rule's default breath. Inside a card that already holds its
   * contents off the border by space.md, 24pt above and below reads as the card
   * falling into two halves rather than as a divider.
   */
  rule: {
    marginVertical: space.sm,
  },
  /** Value on the left, the action that changes it on the right. */
  settingRow: {
    flexDirection: 'row',
    // Centred rather than on the baseline: the arrow is drawn, and a drawing
    // has no baseline to sit on.
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.xs,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  clear: {
    marginTop: space.sm,
    alignSelf: 'flex-start',
  },
  /** Ink settling, the same as a button's — no scale, no shadow. */
  pressed: {
    opacity: 0.6,
  },
});
