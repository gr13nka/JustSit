import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { allPlots } from '../../src/domain/plots';
import { stageAt } from '../../src/domain/stages';
import { daysSat, totalSatMs } from '../../src/domain/stats';
import { requestPermission, setDailyReminder } from '../../src/session/notifications';
import { color, space } from '../../src/theme/tokens';
import { updateSettings, useProgress, useSessions, useSettings } from '../../src/store';
import { Card } from '../../src/ui/Card';
import { DevPanel } from '../../src/ui/DevPanel';
import { ArrowRight } from '../../src/ui/icons';
import { Rule } from '../../src/ui/Rule';
import { Screen } from '../../src/ui/Screen';
import { Text } from '../../src/ui/Text';
import { formatDate, formatTotal, fromHhMm, toHhMm } from '../../src/ui/time';

/**
 * Small enough to read as a mark beside the words rather than a control of its
 * own. It is what tells you the row is tappable, now that no colour does.
 */
const ARROW_SIZE = 18;

export default function YouScreen() {
  const progress = useProgress();
  const settings = useSettings();
  const sessions = useSessions();
  const stage = stageAt(progress.stage);

  const [pickerOpen, setPickerOpen] = useState(false);

  const archive = allPlots(sessions).filter((p) => p.isComplete).reverse();

  const onPickTime = async (event: DateTimePickerEvent, date?: Date) => {
    setPickerOpen(false);
    if (event.type !== 'set' || !date) return;

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

        <Card style={styles.card}>
          <Text variant="label">Practice</Text>
          <View style={styles.figures}>
            <Text variant="body">
              {daysSat(sessions)} {daysSat(sessions) === 1 ? 'day' : 'days'} sat
            </Text>
            <Text variant="body">{formatTotal(totalSatMs(sessions))} in total</Text>
          </View>
        </Card>

        <Card style={styles.card}>
          <Text variant="label">Seconds</Text>
          <Pressable
            onPress={() => updateSettings({ hideSeconds: !settings.hideSeconds })}
            style={({ pressed }) => [styles.settingRow, pressed && styles.pressed]}>
            <Text variant="body" color={settings.hideSeconds ? 'inkSoft' : 'ink'}>
              {settings.hideSeconds ? 'Hidden' : 'Shown'}
            </Text>
            <View style={styles.action}>
              <Text variant="caption" color="ink">
                {settings.hideSeconds ? 'Show' : 'Hide'}
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
        </Card>

        {archive.length > 0 && (
          <Card style={styles.card}>
            <Text variant="label">Finished plots</Text>
            {archive.map((plot) => (
              <View key={plot.index} style={styles.archiveRow}>
                <Text variant="body">Plot {plot.index + 1}</Text>
                <Text variant="caption">
                  {formatDate(plot.startedAt!)} — {formatDate(plot.completedAt!)}
                </Text>
              </View>
            ))}
          </Card>
        )}

        <DevPanel />
      </ScrollView>

      {pickerOpen && (
        <DateTimePicker
          mode="time"
          value={settings.reminderAt ? fromHhMm(settings.reminderAt) : fromHhMm('07:30')}
          onChange={onPickTime}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    paddingVertical: space.md,
  },
  scroll: {
    paddingBottom: space.lg,
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
  figures: {
    gap: space.xs,
    marginTop: space.xs,
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
  archiveRow: {
    marginTop: space.sm,
    gap: 2,
  },
});
