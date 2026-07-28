import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { allPlots } from '../../src/domain/plots';
import { stageAt } from '../../src/domain/stages';
import { daysSat, totalSatMs } from '../../src/domain/stats';
import { requestPermission, setDailyReminder } from '../../src/session/notifications';
import { color, hairline, radius, space } from '../../src/theme/tokens';
import { updateSettings, useProgress, useSessions, useSettings } from '../../src/store';
import { DevPanel } from '../../src/ui/DevPanel';
import { Screen } from '../../src/ui/Screen';
import { Text } from '../../src/ui/Text';
import { formatDate, formatTotal, fromHhMm, toHhMm } from '../../src/ui/time';

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
        <View style={styles.card}>
          <Text variant="label">
            Stage {stage.number} · {stage.name}
          </Text>
          <Text variant="caption" style={styles.practice}>
            {stage.practice}
          </Text>
          <View style={styles.rule} />
          <Text variant="body">{stage.felt}</Text>
        </View>

        <View style={styles.card}>
          <Text variant="label">Practice</Text>
          <View style={styles.figures}>
            <Text variant="body">
              {daysSat(sessions)} {daysSat(sessions) === 1 ? 'day' : 'days'} sat
            </Text>
            <Text variant="body">{formatTotal(totalSatMs(sessions))} in total</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text variant="label">Seconds</Text>
          <Pressable
            onPress={() => updateSettings({ hideSeconds: !settings.hideSeconds })}
            style={styles.settingRow}>
            <Text variant="body" color={settings.hideSeconds ? 'inkSoft' : 'ink'}>
              {settings.hideSeconds ? 'Hidden' : 'Shown'}
            </Text>
            <Text variant="caption" color="terracotta">
              {settings.hideSeconds ? 'Show' : 'Hide'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text variant="label">Daily reminder</Text>
          <Pressable onPress={() => setPickerOpen(true)} style={styles.settingRow}>
            <Text variant="body" color={settings.reminderAt ? 'ink' : 'inkSoft'}>
              {settings.reminderAt ?? 'Off'}
            </Text>
            <Text variant="caption" color="terracotta">
              {settings.reminderAt ? 'Change' : 'Set a time'}
            </Text>
          </Pressable>
          {settings.reminderAt !== null && (
            <Pressable onPress={clearReminder}>
              <Text variant="caption" color="inkSoft" style={styles.clear}>
                Turn off
              </Text>
            </Pressable>
          )}
        </View>

        {archive.length > 0 && (
          <View style={styles.card}>
            <Text variant="label">Finished plots</Text>
            {archive.map((plot) => (
              <View key={plot.index} style={styles.archiveRow}>
                <Text variant="body">Plot {plot.index + 1}</Text>
                <Text variant="caption">
                  {formatDate(plot.startedAt!)} — {formatDate(plot.completedAt!)}
                </Text>
              </View>
            ))}
          </View>
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
    backgroundColor: color.paperDeep,
    borderRadius: radius.card,
    padding: space.md,
    gap: space.xs,
  },
  practice: {
    marginBottom: space.xs,
  },
  rule: {
    width: 48,
    borderBottomWidth: hairline,
    borderBottomColor: color.line,
    marginVertical: space.sm,
  },
  figures: {
    gap: space.xs,
    marginTop: space.xs,
  },
  /** Value on the left, the action that changes it on the right. */
  settingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: space.xs,
  },
  clear: {
    marginTop: space.sm,
  },
  archiveRow: {
    marginTop: space.sm,
    gap: 2,
  },
});
