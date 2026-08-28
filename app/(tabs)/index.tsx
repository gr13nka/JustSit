import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { noteForSession, notedSlots } from '../../src/domain/notes';
import { currentPlot, Grown, nextDot } from '../../src/domain/plots';
import { currentStreak, satToday } from '../../src/domain/stats';
import { space } from '../../src/theme/tokens';
import { Note, useNotes, useProgress, useSessions } from '../../src/store';
import { Baton } from '../../src/ui/Baton';
import { SunIcon } from '../../src/ui/icons';
import { Indicator } from '../../src/ui/Indicator';
import { useBurst, usePullToReplay, useSway } from '../../src/ui/motion';
import { NoteReader, NoteSheet } from '../../src/ui/NoteSheet';
import { PlantGrid } from '../../src/ui/PlantGrid';
import { Screen } from '../../src/ui/Screen';
import { NAV_HEIGHT } from '../../src/ui/SliderNav';

/** Small enough to read as a mark on the page, not as an illustration. */
const BATON_SIZE = 110;

export default function GardenScreen() {
  const sessions = useSessions();
  const notes = useNotes();
  const { gardenSize } = useProgress();
  const plot = currentPlot(sessions, gardenSize);
  const streak = currentStreak(sessions);

  const { progress, restart } = useBurst();

  /**
   * Pulling down at the top plays it again. The garden is the one screen in
   * this app worth looking at rather than using, and the burst was previously
   * only available by leaving and coming back.
   */
  const pull = usePullToReplay(restart);

  /**
   * The garden bursts every time you arrive at it, not once per launch. The tab
   * stays mounted while you are on the other one, so a mount effect would play
   * this exactly once in the life of the app.
   */
  /**
   * Whether the garden is the tab you are looking at. The sway is a loop, and
   * the tab stays mounted behind the other one — so unlike the burst, which
   * simply plays and stops, this has to be told when to give up.
   */
  const [shown, setShown] = useState(false);

  /**
   * When this tab was last arrived at, which is what "today" is measured
   * against below.
   *
   * The tab stays mounted for the life of the app, so a clock read once at
   * mount would still be answering with the day the app was opened — a garden
   * left on screen overnight would claim you had sat today because you sat
   * yesterday. Re-reading it on focus is enough: nothing can change the answer
   * except a sitting or a midnight, and you arrive here after both.
   */
  const [visitedAt, setVisitedAt] = useState(() => Date.now());

  useFocusEffect(
    useCallback(() => {
      restart();
      setVisitedAt(Date.now());
      setShown(true);
      return () => setShown(false);
    }, [restart])
  );

  /** Whether today has already grown something. Two marks depend on it. */
  const sat = satToday(sessions, visitedAt);

  /**
   * Nobody has ever sat here.
   *
   * Two marks turn on it and they are saying the same thing in two registers —
   * Батон holding a page with nothing on it, and the next dot explaining itself
   * rather than merely being findable. Named once so they cannot drift into two
   * slightly different ideas of which garden is the first one.
   */
  const untouched = sessions.length === 0;

  /**
   * Where Батон is, if he is anywhere.
   *
   * He holds two quiet places and they cannot collide: a garden nobody has
   * ever sat in can never also be a day somebody has. Deciding it once, here,
   * is what makes that structural rather than merely true today.
   */
  const baton: 'above' | 'below' | null = untouched ? 'above' : sat ? 'below' : null;

  /** The idle sway, one clock for all 108. Still while you are elsewhere. */
  const sway = useSway(shown);

  /**
   * Nothing is promised to the garden until a sitting actually finishes, which
   * is what keeps backing out of the flow free of consequences. The dot is not
   * named here or carried along: the garden fills in order, so where the plant
   * goes is decided at the end, from the garden as it is then.
   */
  const beginSitting = () => router.push('/session/start');

  /**
   * A plant remembers what you wrote while it was growing.
   *
   * Held rather than tapped, and only where there is something to show: the
   * garden is a record and reading one back is looking at the record more
   * closely, not doing something to it. Which dots those are is worked out
   * here, because the grid draws the bed and does not read the store.
   */
  const marked = notedSlots(notes, plot.plants);
  const [reading, setReading] = useState<Note | null>(null);

  const inspect = (grown: Grown) => {
    const note = noteForSession(notes, grown.session);
    if (note) setReading(note);
  };

  /**
   * The bed has no room left, which is the one state in which the field itself
   * answers a touch. See where it is wrapped below.
   */
  const full = nextDot(plot) === null;

  /**
   * The field. Named rather than written twice, so the two branches below can
   * differ only in whether anything is wrapped around it — a grid spelled out
   * on both sides of a ternary is a grid that can come to disagree with itself.
   */
  const field = (
    <PlantGrid
      plot={plot}
      onBegin={beginSitting}
      hint={untouched}
      burst={progress}
      sway={sway}
      noted={marked}
      onInspect={inspect}
    />
  );

  return (
    <View style={styles.root}>
      <Screen edges={['top']}>
        {/*
          The figure, pinned to the corner. It used to be a pair of cards below
          the plot, which made the smallest fact on the screen the biggest thing
          on it, and until recently a pair of marks up here.

          The leaf that stood in the other corner has gone. It counted sittings,
          and with one continuous bed the field itself is that count — a number
          beside a drawing of the same number, in the corner reserved for the
          thing the garden cannot say.
        */}
        <View style={styles.figures}>
          {/*
            The sun goes green on a day already sat — drawing and figure both,
            which is the one place the whole mark takes the colour. Green means
            something grew, and today something has. On any other day it is ink,
            and says nothing about that either way.

            It is also the way to the days themselves. A streak is the one
            number here that is about the calendar rather than the bed, so the
            mark that reports it is the mark that opens the screen it came from
            — nothing new is added to the page to say so.
          */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Your days"
            onPress={() => router.push('/streak')}
            hitSlop={space.sm}
            style={({ pressed }) => pressed && styles.pressed}>
            <Indicator
              icon={SunIcon}
              value={streak}
              label="Current streak, in days"
              grew={sat ? 'mark' : undefined}
            />
          </Pressable>
        </View>

        {/*
          Nine rows fit any phone, so a full plot no longer scrolls. It stays a
          ScrollView for the two states that put Батон on the page as well —
          above an empty field, below a field already sat in today — and for the
          short phones where he and the plot together do not fit. The nav floats
          over the foot of it, so the last rows are padded clear of it.
        */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          {...pull}>
          {/*
            Nothing has grown yet, so the cat has the page. He is here instead of
            copy: a garden of empty dots needs no explaining, and an apology for
            it would be the first thing this app said to anyone.
          */}
          {baton === 'above' && (
            <View style={styles.empty}>
              <Baton size={BATON_SIZE} />
            </View>
          )}
          {/*
            The field, and on a full bed the field is also the way on.

            Nothing on the screen says so, because nothing needs to: a bed with
            no room has exactly one thing you can do with it, so a touch
            anywhere meaning that one thing costs nothing and adds no mark. It
            is a route that only exists while it is the only route — the moment
            there is room again the ring is back, the wrapper is gone, and the
            rule that only the next dot answers a touch is intact.

            It has to exist at all because of a real corner. Finishing a sitting
            normally lands on the completion screen, whose Done goes here on its
            own; killing the app there instead leaves a full field with no ring,
            nothing to touch, and no way forward — rare, and permanent, which is
            worse than rare. A line of copy would be the app explaining itself,
            and an automatic redirect would fight the back gesture off the grow
            screen and could loop somebody who wanted to look at their garden.

            While it is up, a screen reader sees one button rather than the
            plants inside it, so holding a plant to read its note is out of
            reach until the bed grows. That is the right way round: the notes
            have their own screen, and this is the only state in the app you
            cannot otherwise leave.
          */}
          {full ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Grow the garden"
              onPress={() => router.push('/garden/grow')}
              style={({ pressed }) => pressed && styles.pressed}>
              {field}
            </Pressable>
          ) : (
            field
          )}
          {/*
            On a day already sat he naps at the foot of the field, and that is the
            entire acknowledgement — no copy, no figure, nothing that accumulates.
            Below rather than above because the field is what you came for, and
            because up there he would be under the burst's overhang.

            On any other day he is simply not here. An absent cat is not a
            reproach; a sad one would be, and this app does not have a failure
            state to draw.
          */}
          {baton === 'below' && (
            <View style={styles.napping}>
              <Baton size={BATON_SIZE} />
            </View>
          )}
        </ScrollView>
      </Screen>

      {/*
        Raised over the garden, which goes on swaying underneath — nothing has
        been left, and there is nothing here to come back from. It is lifted
        clear of the floating nav, which the navigator draws above anything a
        screen renders.
      */}
      {reading && (
        <NoteSheet lift={NAV_HEIGHT} onDismiss={() => setReading(null)}>
          <NoteReader
            note={reading}
            onOpen={() => {
              setReading(null);
              router.push({ pathname: '/notes/[id]', params: { id: reading.id } });
            }}
            onClose={() => setReading(null)}
          />
        </NoteSheet>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  /** The garden, and the note that may be raised over all of it. */
  root: {
    flex: 1,
  },
  /**
   * The corner the figure is pinned into. A row still, though it holds one
   * mark: the corner is the arrangement, and a second thing the garden cannot
   * say would go in the other end of it.
   */
  figures: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: space.xs,
  },
  scroll: {
    // Clears the floating nav, which the plot now runs underneath.
    paddingBottom: space.xxxl + space.lg,
  },
  empty: {
    alignItems: 'center',
    paddingBottom: space.md,
  },
  /**
   * The grid already reserves its own bottom overhang, so this is clearance
   * between two drawings rather than a guess at how far a plant hangs; the
   * scroll's padding below keeps him clear of the floating nav.
   */
  napping: {
    alignItems: 'center',
    paddingTop: space.md,
  },
  /** Ink settling, the same as everywhere else — no scale, no shadow. */
  pressed: {
    opacity: 0.6,
  },
});
