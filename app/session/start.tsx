import { router } from 'expo-router';
import { useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { shouldShowTip } from '../../src/domain/progression';
import {
  activePractice,
  isPracticeIntroduction,
  practicePathComplete,
  practicePathForStage,
  sessionsAtStage as practiceSessionsAtStage,
} from '../../src/domain/practices';
import { stageAt, unlockedDurations } from '../../src/domain/stages';
import { space } from '../../src/theme/tokens';
import { useColor } from '../../src/theme/useColor';
import { markTipSeen, updateSettings, useProgress, useSessions, useSettings } from '../../src/store';
import { Button } from '../../src/ui/Button';
import { DurationDial } from '../../src/ui/DurationDial';
import { ArrowLeft, ArrowRight } from '../../src/ui/icons';
import { usePressSettle } from '../../src/ui/motion';
import { Rule } from '../../src/ui/Rule';
import { Screen } from '../../src/ui/Screen';
import { TimerRing } from '../../src/ui/TimerRing';
import { Text } from '../../src/ui/Text';

/** The ring's plant before a sitting. The one that grows is chosen at the end. */
const PREVIEW_PLANT = 'grass';

/**
 * Opened by touching the garden's next dot, which is why it is a screen rather
 * than a tab: a sitting starts from the place it will show up, and there is no
 * timer to visit for its own sake.
 *
 * Which dot that is does not travel with the sitting. A garden fills in order,
 * so the answer is worked out from the garden at the moment the sitting
 * finishes — the dot the screen was opened from is a fact about now, not a
 * promise about then.
 */
export default function StartScreen() {
  const color = useColor();
  const progress = useProgress();
  const settings = useSettings();
  const sessions = useSessions();
  const stage = stageAt(progress.stage);
  const path = practicePathForStage(progress.stage);
  const completedAtStage = path
    ? practiceSessionsAtStage(sessions, progress.stage)
    : 0;
  const practice = path ? activePractice(path, completedAtStage) : null;
  const [instructionOpen, setInstructionOpen] = useState(() =>
    practice
      ? isPracticeIntroduction(practice, completedAtStage, progress.seenTipIds)
      : false
  );

  /*
    How far up the ladder the dial reaches. Counted in sittings rather than
    read from the stage, because it is a tutorial about lengths and not a
    statement about practice: somebody who has sat twenty times knows what
    twenty-four minutes is, whatever stage they are at.
  */
  const options = unlockedDurations(sessions.length);

  const [durationMs, setDurationMs] = useState(() => {
    // The stage proposes; a previous explicit choice, if there is one, wins.
    const suggested = settings.lastDurationMs ?? stage.suggestedMs;
    /*
      Neither of those can outrun the ladder in ordinary use — the unlocks are
      done by sitting twenty and no stage past the first is reachable in fewer
      (see DURATION_UNLOCKS). The dev panel's stage jump is the one thing that
      can, and a pre-selection nothing on the row matches would leave the marker
      parked on the first option while the button started a sitting of another
      length entirely. So it falls back to the longest length actually offered
      rather than to the shortest: the intent was a longer sitting.
    */
    return options.includes(suggested) ? suggested : options[options.length - 1];
  });

  /*
    Straight to the bell when the card has nothing to add — `shouldShowTip`
    holds the reasoning. Pushing `run` rather than `tip` is safe: the session
    layout disables the back gesture everywhere except `start` and `tip`, and
    the way out of a sitting is End, which replaces the whole stack with the
    tabs.
  */
  const begin = () => {
    if (practice) {
      router.push({
        pathname: '/session/run',
        params: { durationMs: String(practice.durationMs) },
      });
      return;
    }

    // The fallback dial is an explicit choice, so remember it when it is used.
    updateSettings({ lastDurationMs: durationMs });
    router.push({
      pathname: shouldShowTip(sessions) ? '/session/tip' : '/session/run',
      params: { durationMs: String(durationMs) },
    });
  };

  if (practice && instructionOpen) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Read practice and continue"
        onPress={() => {
          markTipSeen(practice.id);
          setInstructionOpen(false);
        }}
        style={styles.sheet}>
        <Screen edges={['top', 'bottom']}>
          <View style={styles.body}>
            <Text variant="label">Stage One</Text>
            <Text variant="caption" style={styles.practiceLabel}>
              {practice.title} · {minutesOf(practice.durationMs)} minutes
            </Text>
            <Rule />
            <Text variant="teaching">{practice.body}</Text>
          </View>
          <View style={styles.footer}>
            <Text variant="caption" style={styles.hint}>tap</Text>
          </View>
        </Screen>
      </Pressable>
    );
  }

  if (practice) {
    const free = path && practicePathComplete(path, completedAtStage);

    return (
      <Screen edges={['top', 'bottom']}>
        <View style={styles.header}>
          <BackArrow onPress={() => router.back()} />
        </View>

        <View style={styles.guidedMiddle}>
          <TimerRing plant={PREVIEW_PLANT} />
          <View style={styles.practiceCopy}>
            <Text variant="title" style={styles.practiceTitle}>
              {practice.title}
            </Text>
            <Text variant="body" color="inkSoft" style={styles.cue}>
              {practice.cue}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Read full practice instruction"
              onPress={() => setInstructionOpen(true)}
              hitSlop={space.sm}
              style={({ pressed }) => pressed && styles.pressed}>
              <Text variant="label" color="inkSoft">i</Text>
            </Pressable>
          </View>
          <Text variant="caption" color="inkSoft">
            {minutesOf(practice.durationMs)} minutes
          </Text>
        </View>

        <Button label="Meditate" variant="wobbly" onPress={begin} style={styles.start} />

        {free && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose another length"
            onPress={() => router.push('/session/free')}
            style={({ pressed }) => [styles.freeLink, pressed && styles.pressed]}>
            <Text variant="caption" color="inkSoft">Choose another length</Text>
            <ArrowRight color={color.inkSoft} size={18} />
          </Pressable>
        )}
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.header}>
        <BackArrow onPress={() => router.back()} />
      </View>

      {/*
        The ring has the free height to itself and sits in the middle of it. It
        used to share a centred group with the clock and the button, which on a
        tall phone put all three near the top and left the foot of the screen
        empty.
      */}
      <View style={styles.middle}>
        <TimerRing plant={PREVIEW_PLANT} />
      </View>

      {/*
        Drawn, because this is where a hand commits to something. The pen goes
        on exactly that and nothing else — starting a sitting here, starting
        altogether in onboarding, taking a plant on the completion screen,
        agreeing to fill a bed on the ask — and what rations it is the verb
        rather than a count: "Choose a time" is a setting and "Not now" is a way
        out, so neither gets it. Two drawn buttons are never on one screen.

        It sits above the dial rather than inside the centred block, so "how
        long" and "go" are next to each other at the foot of the screen, where a
        thumb is.
      */}
      <Button
        label="Meditate"
        variant="wobbly"
        onPress={begin}
        style={styles.start}
      />

      <DurationDial options={options} valueMs={durationMs} onChange={setDurationMs} />
    </Screen>
  );
}

/**
 * The way back, drawn rather than written.
 *
 * "Back" was the only word on this screen doing a job an arrow does better, and
 * the kit sanctions hand-drawn arrows for exactly this. The label survives in
 * `accessibilityLabel`, where it is still the word.
 */
function BackArrow({ onPress }: { onPress: () => void }) {
  const color = useColor();
  const { onPressIn, onPressOut, settleStyle } = usePressSettle();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      hitSlop={space.md}
      style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
      <Animated.View style={settleStyle}>
        <ArrowLeft color={color.inkSoft} size={BACK_SIZE} />
      </Animated.View>
    </Pressable>
  );
}

/** Big enough to read as a drawing, small enough not to be the first thing seen. */
const BACK_SIZE = 26;

function minutesOf(ms: number): number {
  return Math.round(ms / 60_000);
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'flex-start',
  },
  back: {
    paddingVertical: space.sm,
  },
  /** Ink settling, the same as everywhere else. */
  pressed: {
    opacity: 0.6,
  },
  middle: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guidedMiddle: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.lg,
  },
  practiceCopy: {
    alignItems: 'center',
    gap: space.sm,
    maxWidth: 300,
  },
  practiceTitle: {
    textAlign: 'center',
  },
  practiceLabel: {
    marginTop: space.xs,
  },
  cue: {
    textAlign: 'center',
  },
  sheet: {
    flex: 1,
  },
  footer: {
    paddingBottom: space.lg,
    alignItems: 'center',
  },
  hint: {
    letterSpacing: 1,
  },
  freeLink: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    marginBottom: space.lg,
  },
  /**
   * Held clear of the dial below it. The two are the only controls on the
   * screen and they do opposite things — one changes the sitting, the other
   * commits to it — so they should not read as a pair of buttons in a row.
   *
   * The chosen length is no longer printed above this button. It was a large
   * number saying exactly what the dial's own marker already says, and the
   * marker says it in the place you change it.
   */
  start: {
    alignSelf: 'center',
    marginBottom: space.xl,
    minWidth: 220,
  },
});
