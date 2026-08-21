import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { appendThought, noteForSitting } from '../../src/domain/notes';
import { prepareBells, ringBell } from '../../src/session/bells';
import { sittingClockMs } from '../../src/session/devClock';
import { useSession } from '../../src/session/useSession';
import { space } from '../../src/theme/tokens';
import { useColor } from '../../src/theme/useColor';
import {
  addNote,
  recordCompletedSession,
  updateNote,
  useNotes,
  useSettings,
} from '../../src/store';
import { Button } from '../../src/ui/Button';
import { Clock } from '../../src/ui/Clock';
import { PencilIcon } from '../../src/ui/icons';
import { NoteCapture, NoteSheet } from '../../src/ui/NoteSheet';
import { Screen } from '../../src/ui/Screen';
import { TimerRing } from '../../src/ui/TimerRing';

const PREVIEW_PLANT = 'grass';

/** Small enough to be the quietest thing on a screen that is mostly nothing. */
const PENCIL_SIZE = 26;

export default function RunScreen() {
  const params = useLocalSearchParams<{ durationMs: string }>();
  const durationMs = Number(params.durationMs);
  const color = useColor();

  // Only ever read at the moment something is written, to find out whether this
  // sitting already has a note. Nothing here draws them.
  const notes = useNotes();
  const settings = useSettings();

  // Fixed at mount. Everything downstream derives from wall time, so a re-render
  // must never restart the clock.
  const [startedAt] = useState(() => Date.now());
  const opened = useRef(false);

  /**
   * How long the clock runs, which in developer mode is not how long the
   * sitting is worth.
   *
   * Everything the screen shows — the ring, the count — is measured against
   * *this*, so a shortened sitting counts down honestly rather than pretending
   * to be twenty minutes. What is recorded is the length the user chose, and
   * that is the only number the garden, the offers and the stage ever see.
   * `useSession` is never told which of the two it has been handed: it derives
   * from wall time and schedules the ending either way.
   */
  const clockMs = sittingClockMs(durationMs, settings.devMode);

  const [catching, setCatching] = useState(false);

  /**
   * What is in the card, held where anything can reach it.
   *
   * A ref rather than state because it is never rendered — the card draws its
   * own text — and because this screen recomputes a clock four times a second,
   * so a re-render per keystroke would put the timer behind the keyboard.
   */
  const draft = useRef('');

  /**
   * Puts the caught thought down, once.
   *
   * Clearing the buffer before writing is what makes a second call a no-op, and
   * there are two callers that can arrive in either order: "done", and the bell.
   * A thought must not be lost to the bell, and it must not be written twice by
   * it either.
   *
   * A sitting leaves one note. Raise the card again and what is caught is added
   * as another line of the note this sitting already has, rather than starting
   * a second — the notebook is one card per sitting, not one per time the
   * pencil was found.
   */
  const keepDraft = () => {
    const body = draft.current;
    draft.current = '';
    if (body.trim() === '') return;

    const caught = noteForSitting(notes, startedAt);
    if (caught) updateNote(caught.id, appendThought(caught.body, body));
    else addNote({ body, sittingStartedAt: startedAt });
  };

  const lowerCard = () => {
    keepDraft();
    setCatching(false);
  };

  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    void prepareBells().then(() => ringBell('in'));
  }, []);

  const { remainingMs } = useSession({
    startedAt,
    durationMs: clockMs,
    onComplete: () => {
      // Before anything else. The sitting is over either way, and the card may
      // still be open with a line in it that nobody has pressed "done" on.
      keepDraft();

      const session = recordCompletedSession({ startedAt, durationMs });
      router.replace({
        pathname: '/session/complete',
        params: { sessionId: session.id },
      });
    },
  });

  /**
   * Leaving early records nothing. No plant, no message, no "are you sure" —
   * the garden only ever shows completed sittings, and being scolded by a
   * meditation app is worse than the missed session.
   *
   * A note already written is not part of that bargain and stays. The plant was
   * what finishing earned; the thought was the user's as soon as they had it.
   */
  const leave = () => router.replace('/(tabs)');

  return (
    <View style={styles.root}>
      <Screen center edges={['top', 'bottom']}>
        <View style={styles.middle}>
          <TimerRing
            plant={PREVIEW_PLANT}
            spent={clockMs > 0 ? 1 - remainingMs / clockMs : 0}
          />
          <View style={styles.clock}>
            <Clock ms={remainingMs} />
          </View>
        </View>

        {/*
          The way out, and beside it the only other thing on the screen.

          They share a row rather than being placed on the screen separately,
          which is what puts the pencil on the page's own margin: an absolutely
          positioned child is inset by its parent's padding on a phone and not
          in a browser, so anything measured against a padded box comes out in
          two different places on the two targets this app is judged on.
        */}
        <View style={styles.foot}>
          <Button label="End" variant="quiet" onPress={leave} />

          {/*
            Deliberately the quietest mark on the screen: a thought that turns
            up mid-sitting will be carried for the next twenty minutes unless it
            can be put somewhere. The drawing stays small and the target does
            not — `hitSlop` reaches well past the ink, so it can be found
            without being looked for.
          */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Catch a thought"
            onPress={() => setCatching(true)}
            hitSlop={space.lg}
            style={({ pressed }) => [styles.pencil, pressed && styles.pressed]}>
            <PencilIcon color={color.inkSoft} size={PENCIL_SIZE} />
          </Pressable>
        </View>
      </Screen>

      {/*
        Raised over the sitting rather than replacing it. The clock is wall time,
        so the detour costs nothing at all — and `useSession` never learns this
        happened, which is what keeps that true.
      */}
      {catching && (
        <NoteSheet onDismiss={lowerCard}>
          <NoteCapture onChange={(body) => (draft.current = body)} onDone={lowerCard} />
        </NoteSheet>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  /** The sitting, and the sheet that may be raised over all of it. */
  root: {
    flex: 1,
  },
  middle: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clock: {
    marginTop: space.xl,
  },
  foot: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.lg,
  },
  /**
   * The corner, level with the way out. Positioned rather than laid out, so
   * that having it cannot move the button off the middle of the screen.
   */
  pencil: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  /** Ink settling, the same as everywhere else. */
  pressed: {
    opacity: 0.6,
  },
});
