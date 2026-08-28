import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { hash32, scramble } from '../src/domain/hash';
import {
  bestStreak,
  currentStreak,
  recentDays,
  totalSatMs,
  weekSat,
} from '../src/domain/stats';
import { space } from '../src/theme/tokens';
import { useSessions } from '../src/store';
import { BackHeader } from '../src/ui/BackHeader';
import { DayMark } from '../src/ui/DayMark';
import { BURST_SPREAD_MS, Rise, Sprout, useBurst } from '../src/ui/motion';
import { Rule } from '../src/ui/Rule';
import { Screen } from '../src/ui/Screen';
import { Text } from '../src/ui/Text';
import { formatTotal } from '../src/ui/time';

/**
 * What the practice has looked like.
 *
 * The garden answers "what have I grown" and this answers "when did I sit",
 * which the garden cannot: it fills in order and says nothing about the
 * calendar, so a hundred plants grown over a year and a hundred grown over a
 * fortnight draw the same bed. Here time is the subject and the plants are not
 * in it at all.
 *
 * It is a stack screen and not a third tab. Tabs are rationed — there is no Sit
 * tab either — and one more would need a hand-traced mark off `npm run art`,
 * which is a hardware loop rather than a code change. It is also the right
 * shape for the thing: you come here, you look, and you leave, which is a
 * screen rather than a place.
 *
 * Three rules govern every mark on it. **Nothing here mentions a day you did
 * not sit** — a missed day is drawn as the same faint dot the garden puts under
 * every slot nobody has reached yet, which is a day with nothing in it and not
 * a day you failed at. **Nothing here is a percentage, a pace or a
 * projection**: every number is a count of something that happened. And the
 * totals at the foot are the counterweight that makes the run at the top safe
 * to show at all — see them below.
 */

/** Monday first, matching `weekSat`. The letters are what fits under a mark. */
const WEEKDAYS = [
  { letter: 'M', name: 'Monday' },
  { letter: 'T', name: 'Tuesday' },
  { letter: 'W', name: 'Wednesday' },
  { letter: 'T', name: 'Thursday' },
  { letter: 'F', name: 'Friday' },
  { letter: 'S', name: 'Saturday' },
  { letter: 'S', name: 'Sunday' },
] as const;

/**
 * The window under the week, and the shape it is dealt into.
 *
 * Four weeks rather than a month, because a month is a thing with edges and
 * this is deliberately a window that ends where you are standing — `recentDays`
 * makes the same distinction and for the same reason. Seven across so the
 * columns line up with the row above it: a texture whose rows were eight long
 * would put Tuesdays under Wednesdays and quietly stop meaning anything.
 */
const WINDOW_DAYS = 28;
const WINDOW_COLUMNS = 7;

/**
 * Mark sizes. The week is drawn at a garden cell's width, which is what puts
 * the pen at the weight the garden's own plants are drawn at; the window is
 * smaller because it is a texture rather than seven things to read.
 */
const WEEK_MARK = 30;
const WINDOW_MARK = 22;

/**
 * Where in the burst one mark starts, seeded off its own key so the screen
 * arrives the same way every time rather than re-rolling on each visit — the
 * garden's argument, and the same machinery underneath it.
 *
 * Scrambled before the modulo, which `hash32`'s own note asks of anything
 * slicing bits out of a key whose last character varies: FNV-1a leaves
 * consecutive keys a fixed distance apart, so the raw remainder would deal out
 * an arithmetic progression and the row would sweep left to right in step
 * instead of scattering. The garden skips the scramble only because its start
 * times are frozen and must keep answering the same forever.
 */
function burstDelay(key: string): number {
  return scramble(hash32(key)) % BURST_SPREAD_MS;
}

/** The figures and the totals arriving, one after another rather than at once. */
const CURRENT_DELAY_MS = 0;
const BEST_DELAY_MS = 80;
const TOTALS_DELAY_MS = 160;

export default function StreakScreen() {
  const sessions = useSessions();

  /**
   * The clock, read once on arrival.
   *
   * Every mark on this screen is placed against a day, so they all have to
   * agree about which day it is; reading `Date.now()` per call would let a
   * midnight fall between the week row and the window under it. Pinned at
   * arrival rather than kept live because a stack screen's mount really is an
   * arrival — unlike the garden tab, which stays mounted for the life of the
   * app and therefore has to re-read the clock on focus.
   */
  const [openedAt] = useState(() => Date.now());

  const week = weekSat(sessions, openedAt);
  const recent = recentDays(sessions, WINDOW_DAYS, openedAt);

  /** Which column of the week row is today. Monday is 0, as `weekSat` lays it out. */
  const today = (new Date(openedAt).getDay() + 6) % 7;

  /**
   * The same burst the garden runs, restarted once on mount. A stack screen is
   * pushed and popped, so an entrance that fires on mount fires on every
   * arrival — the tab's `useFocusEffect` exists because a tab is never
   * unmounted, and nothing here needs it.
   */
  const { progress, restart } = useBurst();
  useEffect(() => restart(), [restart]);

  const satInWindow = recent.filter(Boolean).length;

  return (
    <Screen edges={['top', 'bottom']}>
      <BackHeader title="Your days" onBack={() => router.back()} />

      <View style={styles.body}>
        <View style={styles.week}>
          <Text variant="label">This week</Text>
          <View style={styles.row}>
            {week.map((sat, i) => (
              <View
                key={i}
                accessible
                accessibilityLabel={[
                  WEEKDAYS[i].name,
                  i === today && 'today',
                  sat && 'sat',
                ]
                  .filter(Boolean)
                  .join(', ')}
                style={styles.day}>
                {/*
                  Every mark sprouts, which the garden does not do — there only
                  the plants come up and the dots are already lying there as the
                  ground they come up out of. Nothing on this screen is ground:
                  a day with nothing in it is one of the seven things being
                  drawn, not the paper the other six stand on, so the row
                  arrives whole rather than filling in over a lattice that was
                  waiting for it.
                */}
                <Sprout progress={progress} delayMs={burstDelay(`week-${i}`)}>
                  <DayMark
                    size={WEEK_MARK}
                    sat={sat}
                    // The ring is the garden's locator, and here it says the
                    // same thing it says there: this is the one still open. A
                    // day already sat is closed, so it wears its stroke and
                    // nothing else.
                    today={i === today && !sat}
                    index={i}
                  />
                </Sprout>
                {/*
                  Today's letter darkens, which is the only thing on the row
                  that survives the day being sat: once the ring is gone,
                  nothing else would say where in the week you are standing.
                */}
                <Text variant="caption" color={i === today ? 'ink' : 'inkSoft'}>
                  {WEEKDAYS[i].letter}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/*
          The run, and the run that cannot be lost.

          A current streak is a number that spends most of its life going down,
          and a large figure reading nought the morning after a missed day is
          the app telling you that you failed. The best beside it is what makes
          that impossible: the days are still there, the app still knows about
          them, and a broken run becomes a run that *ended*. Neither figure is
          green — green is spent on the marks above, where it means a day grew
          something, and a streak is an arithmetic fact about days rather than
          a thing that grew.
        */}
        <View style={styles.figures}>
          <Rise delayMs={CURRENT_DELAY_MS} style={styles.figure}>
            <Text variant="label">Current</Text>
            <Text variant="stat">{currentStreak(sessions, openedAt)}</Text>
          </Rise>
          <Rise delayMs={BEST_DELAY_MS} style={styles.figure}>
            <Text variant="label">Best</Text>
            <Text variant="stat">{bestStreak(sessions)}</Text>
          </Rise>
        </View>

        <Rule style={styles.rule} />

        {/*
          Four weeks of texture, and deliberately not labelled.

          The row above is a week with names on it, and this is the same marks
          with the names taken off — you are meant to see the shape of a month
          rather than read a date out of it, which is why nothing here is
          captioned and why the whole grid answers a screen reader as one thing.

          Dealt into explicit rows rather than wrapped: seven fractional widths
          can total a hair over their container and throw the last mark onto a
          row of its own, which is the trap `field.ts` floors its cell against.
        */}
        <View
          accessible
          accessibilityLabel={`The last four weeks: ${satInWindow} ${
            satInWindow === 1 ? 'day' : 'days'
          } sat`}
          style={styles.window}>
          {Array.from({ length: WINDOW_DAYS / WINDOW_COLUMNS }, (_, r) => (
            <View key={r} style={styles.row}>
              {recent.slice(r * WINDOW_COLUMNS, (r + 1) * WINDOW_COLUMNS).map((sat, c) => {
                const i = r * WINDOW_COLUMNS + c;
                return (
                  <Sprout key={i} progress={progress} delayMs={burstDelay(`window-${i}`)}>
                    <DayMark
                      size={WINDOW_MARK}
                      sat={sat}
                      // `recentDays` ends at today, so the last mark is it.
                      today={i === WINDOW_DAYS - 1 && !sat}
                      index={i}
                    />
                  </Sprout>
                );
              })}
            </View>
          ))}
        </View>

        <Rule style={styles.rule} />

        {/*
          The counterweight, and the reason the figures above are allowed to be
          the size they are.

          Both of these only ever go up. A streak can break and a month can come
          out thin, and neither of those can touch a sitting that already
          happened — so however the rest of the screen reads on a bad week,
          there is something on it that has not moved. They are set quietly
          because that is the whole of their job: they are not the news, they
          are what stops the news being the only thing here.
        */}
        <Rise delayMs={TOTALS_DELAY_MS} style={styles.totals}>
          <Text variant="body" color="inkSoft">
            {sessions.length} {sessions.length === 1 ? 'sitting' : 'sittings'}
          </Text>
          <Text variant="body" color="inkSoft">
            {formatTotal(totalSatMs(sessions))} in total
          </Text>
        </Rise>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  /**
   * One breath between sections, and the rules give up their own margins to it
   * so a divider is spaced like everything else rather than twice over.
   */
  body: {
    gap: space.lg,
  },
  week: {
    gap: space.sm,
  },
  /** The week and each row of the window: seven marks, evenly spread. */
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  day: {
    alignItems: 'center',
    gap: space.xs,
  },
  window: {
    gap: space.sm,
  },
  figures: {
    flexDirection: 'row',
  },
  /** Two equal halves, so the pair reads as a pair rather than as a sentence. */
  figure: {
    flex: 1,
  },
  rule: {
    marginVertical: 0,
  },
  totals: {
    gap: space.xs,
  },
});
