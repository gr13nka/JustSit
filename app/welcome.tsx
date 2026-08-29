import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { greetingLine } from '../src/domain/greeting';
import { recentDays } from '../src/domain/stats';
import { space } from '../src/theme/tokens';
import { noteGreeted, useSessions } from '../src/store';
import { Button } from '../src/ui/Button';
import { DayMark } from '../src/ui/DayMark';
import { Rise, Sprout, useBurst } from '../src/ui/motion';
import { EmptySlot, Plant } from '../src/ui/Plant';
import { Screen } from '../src/ui/Screen';
import { Text } from '../src/ui/Text';

/**
 * The first thing the day says, once.
 *
 * A line, the last plant grown, and the week behind it — then a button and the
 * garden. It comes up on the first open of a day and not again; `shouldGreet`
 * in `domain/greeting.ts` decides that, and the tabs layout is where the
 * question is asked.
 *
 * **This is the one screen in the app that praises you, and it is a decision
 * rather than drift.** The standing rule is that nothing here tells you you did
 * well; the licence is scoped to this screen and the module it reads its line
 * out of, and a later reader tidying praise out of the app should leave both
 * alone and treat praise anywhere else as the bug it still is.
 *
 * What the licence buys is praise *in words*, here, and nothing else. Every
 * other rule holds — and the no-failure rule most of all, which is the whole
 * reason **the week is drawn rather than printed**. A printed run was the first
 * draft and read like a scoreboard: a figure handed to you on arrival is a
 * thing to keep up, and keeping something up is not what this app asks of
 * anybody. The sharper objection was the zero. A number reading nought the
 * morning after a lapse is the app greeting you with what you did not do, and
 * the only way to keep that honest would have been a special case saying
 * nothing at all below one. Seven `DayMark`s have no such case to make, because
 * a row of marks has no zero to print: an empty week is seven faint dots, which
 * is exactly what the garden already draws under a slot nobody has reached. The
 * awkward case is retired rather than worked around.
 *
 * Neither Батон nor the night sky appears here. He holds the places where
 * nothing else should be and never turns up because something was finished; the
 * sky is the first run's hero and is spent. A daily greeting is neither.
 */

/**
 * Large enough to be the picture on the page rather than a garden cell that has
 * wandered off — this is one plant standing alone, with nothing beside it to
 * take its scale from.
 */
const PLANT_SIZE = 132;

/** The week at the garden's own cell width, as `app/streak.tsx` draws it. */
const WEEK_MARK = 30;

/** How many days stand behind the line. */
const WEEK_DAYS = 7;

/** The greeting arriving a piece at a time rather than all at once. */
const TITLE_DELAY_MS = 0;
const LINE_DELAY_MS = 80;
const GROUND_DELAY_MS = 120;
const WEEK_DELAY_MS = 160;

export default function WelcomeScreen() {
  const sessions = useSessions();

  /**
   * The clock, read once on arrival — `app/streak.tsx`'s reason. Every mark
   * here is placed against a day, so the line and the row have to agree about
   * which day it is, and a stack screen's mount really is an arrival.
   */
  const [openedAt] = useState(() => Date.now());

  const week = recentDays(sessions, WEEK_DAYS, openedAt);

  /**
   * The newest sitting's first plant. Sessions are appended in order, so the
   * newest is the last of them — and an install with nothing in the ground gets
   * the garden's own empty dot instead, ring and all, which says the same thing
   * standing here as it says there: this is where it carries on.
   */
  const newest = sessions[sessions.length - 1];
  const grown = newest?.plants?.[0]?.key;

  /**
   * One doodle off the shared clock, restarted on mount. A stack screen is
   * pushed and popped, so an entrance that fires on mount fires on every
   * arrival.
   */
  const { progress, restart } = useBurst();
  useEffect(() => restart(), [restart]);

  /**
   * Stamped on the way out rather than on the way in, so an app killed on this
   * screen is greeted again next time instead of silently spending the day's
   * welcome on a screen nobody read. `replace` rather than `back`, because a
   * greeting left in the history is a greeting the back gesture can return to.
   */
  const leave = () => {
    noteGreeted();
    router.replace('/(tabs)');
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.body}>
        <Rise delayMs={TITLE_DELAY_MS}>
          <Text variant="display" style={styles.centred}>
            Welcome back
          </Text>
        </Rise>

        {/*
          One felt line, which is what the hand face is for. It is the whole of
          the praise, and it is a sentence rather than a paragraph — anything
          that ran past a line would go back to the reading face and stop being
          a line said in passing.
        */}
        <Rise delayMs={LINE_DELAY_MS}>
          <Text variant="hand" color="inkSoft" style={[styles.centred, styles.line]}>
            {greetingLine(openedAt)}
          </Text>
        </Rise>

        {/*
          A plant sprouts and the bare dot does not, which is a difference in
          the drawings rather than a preference. `Sprout` pivots on the root a
          plant actually grows from, `ROOT_SHARE` of the way down its page —
          right for a plant, and 52pt below the ink of an `EmptySlot`, whose
          mark *is* the middle of its canvas. Scaled about a point that far
          outside itself the dot travels 43pt: it dives below where it belongs
          and slides up into place, on a ring 66pt across. The error is
          proportional to `size`, which is why `app/streak.tsx` can sprout its
          empty days at 30pt and this cannot at 132.

          `Rise` is also the truer reading. Nothing has grown on an install with
          an empty garden, and the dots are the ground a plant comes up out of —
          the same reason the grow screen fades its new ground in rather than
          sprouting it.
        */}
        <View style={styles.plant}>
          {grown ? (
            <Sprout progress={progress} delayMs={0}>
              <Plant plant={grown} size={PLANT_SIZE} />
            </Sprout>
          ) : (
            <Rise delayMs={GROUND_DELAY_MS}>
              <EmptySlot size={PLANT_SIZE} next />
            </Rise>
          )}
        </View>

        {/*
          Seven days, ending today. The row answers a screen reader as one thing
          and names itself without counting itself: what it draws is the shape
          of a week, and a spoken total would be the printed figure this screen
          exists without.
        */}
        <Rise delayMs={WEEK_DELAY_MS}>
          <View accessible accessibilityLabel="The last seven days" style={styles.week}>
            {week.map((sat, i) => (
              <DayMark
                key={i}
                size={WEEK_MARK}
                sat={sat}
                // The last mark is today, and the ring only ever circles a day
                // still open — a day already sat wears its stroke and nothing
                // else.
                today={i === WEEK_DAYS - 1 && !sat}
                index={i}
              />
            ))}
          </View>
        </Rise>
      </View>

      <View style={styles.footer}>
        {/*
          Drawn, like Begin and Done. What it commits to is the day: the screen
          is spent once it is pressed and does not come back until tomorrow.
        */}
        <Button
          label="Come in"
          variant="wobbly"
          onPress={leave}
          style={styles.stretch}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centred: {
    textAlign: 'center',
  },
  line: {
    marginTop: space.md,
  },
  plant: {
    marginTop: space.xl,
  },
  /** Seven marks with air between them, sitting under the plant. */
  week: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.xl,
  },
  footer: {
    paddingBottom: space.lg,
  },
  stretch: {
    alignSelf: 'stretch',
  },
});
