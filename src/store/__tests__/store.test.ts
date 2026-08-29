import { isKnownPlant, offersFor, surpriseOfferIndex } from '../../domain/plants';
import { MALA, nextGardenSize, STARTER_GARDEN } from '../../domain/plots';
import { stageAt } from '../../domain/stages';
import { Session } from '../types';
import { noteForSession } from '../../domain/notes';
import {
  __replaceState,
  __reset,
  addNote,
  deleteNote,
  chooseOffer,
  completeOnboarding,
  getState,
  growGarden,
  markTipSeen,
  noteAdvanceOffered,
  recordCompletedSession,
  resetProgress,
  setStage,
  updateNote,
  updateSettings,
} from '../index';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const TEN_MIN = 600_000;

/** A plant already in the ground, for setting up a garden to sit into. */
function seeded(id: string, slot: number): Session {
  return {
    id,
    startedAt: 0,
    durationMs: TEN_MIN,
    completedAt: TEN_MIN,
    stage: 1,
    plants: [{ key: 'grass', slot }],
  };
}

/** A bed of `size` dots with `grown` of them already filled. */
function garden(size: number, grown: number) {
  __replaceState({
    sessions: Array.from({ length: grown }, (_, i) => seeded(`s${i}`, i)),
    progress: { ...getState().progress, gardenSize: size },
  });
}

/** Every dot in use. */
function slots(): number[] {
  return getState().sessions.flatMap((s) => s.plants.map((p) => p.slot));
}

beforeEach(() => {
  __reset();
});

describe('recordCompletedSession', () => {
  it('records exactly one sitting', () => {
    recordCompletedSession({ startedAt: Date.now(), durationMs: TEN_MIN });
    expect(getState().sessions).toHaveLength(1);
  });

  it('assigns species we have art for, and stores them rather than deriving them', () => {
    garden(MALA, 0);
    const session = recordCompletedSession({
      startedAt: Date.now(),
      durationMs: TEN_MIN,
    });
    expect(session.plants.length).toBeGreaterThan(0);
    for (const planted of session.plants) expect(isKnownPlant(planted.key)).toBe(true);
    expect(getState().sessions[0].plants).toEqual(session.plants);
  });

  it('writes the surprise offer straight away, so no sitting is ever plantless', () => {
    // Kill the app on the completion screen and the sitting is still in the
    // ground.
    garden(MALA, 0);
    const startedAt = 1;
    const session = recordCompletedSession({ startedAt, durationMs: 30 * 60_000 });

    const offers = offersFor(session.id, 30 * 60_000, 0, MALA);
    const index = surpriseOfferIndex(String(startedAt), offers.length);
    expect(session.plants.map((p) => p.key)).toEqual(offers[index].plants);
  });

  it('stamps the stage the user was actually on', () => {
    setStage(3);
    const session = recordCompletedSession({
      startedAt: Date.now(),
      durationMs: TEN_MIN,
    });
    expect(session.stage).toBe(3);
  });

  it('does not treat a guided completion as an explicit duration choice', () => {
    updateSettings({ lastDurationMs: 15 * 60_000 });
    recordCompletedSession({ startedAt: Date.now(), durationMs: 30 * 60_000 });
    expect(getState().settings.lastDurationMs).toBe(15 * 60_000);
  });

  it('gives distinct ids to sittings started in the same millisecond', () => {
    const at = Date.now();
    const a = recordCompletedSession({ startedAt: at, durationMs: TEN_MIN });
    const b = recordCompletedSession({ startedAt: at, durationMs: TEN_MIN });
    expect(a.id).not.toBe(b.id);
  });

  it('appends, so the garden stays in the order things grew', () => {
    const first = recordCompletedSession({ startedAt: 1, durationMs: TEN_MIN });
    const second = recordCompletedSession({ startedAt: 2, durationMs: TEN_MIN });
    expect(getState().sessions.map((s) => s.id)).toEqual([first.id, second.id]);
  });
});

describe('the dot a plant grows in', () => {
  it('is the first free one in the garden, and nobody is asked', () => {
    garden(MALA, 2);
    const session = recordCompletedSession({
      startedAt: Date.now(),
      durationMs: TEN_MIN,
    });
    expect(session.plants[0].slot).toBe(2);
  });

  it('fills consecutive dots across consecutive sittings', () => {
    garden(MALA, 0);
    const grown = [0, 1, 2].map((i) =>
      recordCompletedSession({ startedAt: i + 1, durationMs: TEN_MIN })
    );
    expect(grown.map((s) => s.plants[0].slot)).toEqual([0, 1, 2]);
  });

  it('lays a bundle out over consecutive dots', () => {
    garden(MALA, 0);
    const session = recordCompletedSession({ startedAt: 1, durationMs: 30 * 60_000 });
    const laid = session.plants.map((p) => p.slot);
    expect(laid).toEqual(laid.map((_, i) => laid[0] + i));
  });

  /**
   * A garden grown while the user still picked dots has holes in it, and the
   * holes are where it carries on from — front to back, not after the newest
   * plant. Linear planting fills such a garden in rather than appending past
   * it, which is also what stops a plant landing on one already there.
   */
  it('fills the holes in a garden grown before planting was linear', () => {
    __replaceState({
      sessions: [seeded('a', 0), seeded('b', 4), seeded('c', 9)],
      progress: { ...getState().progress, gardenSize: MALA },
    });

    const first = recordCompletedSession({ startedAt: 1, durationMs: TEN_MIN });
    const second = recordCompletedSession({ startedAt: 2, durationMs: TEN_MIN });

    expect([first.plants[0].slot, second.plants[0].slot]).toEqual([1, 2]);
    expect(new Set(slots()).size).toBe(slots().length);
  });

  it('grows the bed rather than losing a sitting with nowhere to go', () => {
    // Unreachable from the app — a full bed has no dot left to start a sitting
    // from, and the grow screen gets there first. This is the floor under it,
    // and it takes the same rung the ladder would have.
    garden(3, 3);

    const session = recordCompletedSession({
      startedAt: Date.now(),
      durationMs: TEN_MIN,
    });

    expect(getState().progress.gardenSize).toBe(6);
    expect(session.plants[0].slot).toBe(3);
  });
});

describe('chooseOffer', () => {
  it('swaps the newest sitting\'s plants for the one that was picked', () => {
    garden(MALA, 0);
    const session = recordCompletedSession({ startedAt: 1, durationMs: 30 * 60_000 });
    const offers = offersFor(session.id, 30 * 60_000, 0, MALA);

    chooseOffer(session.id, 2);

    const stored = getState().sessions[0];
    expect(stored.plants.map((p) => p.key)).toEqual(offers[2].plants);
    expect(stored.plants.map((p) => p.slot)).toEqual([0, 1, 2]);
  });

  it('plants the choice where the first one stood', () => {
    // The dot is where the user touched; picking a different offer does not
    // move the sitting somewhere else in the garden.
    garden(MALA, 4);
    const session = recordCompletedSession({ startedAt: 1, durationMs: 30 * 60_000 });
    const first = session.plants[0].slot;

    chooseOffer(session.id, 1);
    expect(getState().sessions.at(-1)!.plants[0].slot).toBe(first);
  });

  it('leaves no dot used twice, whichever offer is taken', () => {
    garden(MALA, 0);
    const session = recordCompletedSession({ startedAt: 1, durationMs: 30 * 60_000 });

    for (const index of [0, 1, 2, 1, 0]) {
      chooseOffer(session.id, index);
      expect(new Set(slots()).size).toBe(slots().length);
    }
  });

  it('refuses a sitting that is no longer the newest', () => {
    // Its plants are no longer the tail of the used slots, so re-laying them
    // could land on a dot something else has grown in.
    garden(MALA, 0);
    const first = recordCompletedSession({ startedAt: 1, durationMs: 30 * 60_000 });
    recordCompletedSession({ startedAt: 2, durationMs: 30 * 60_000 });

    const before = getState().sessions[0].plants;
    chooseOffer(first.id, 2);
    expect(getState().sessions[0].plants).toEqual(before);
  });

  it('refuses an offer that was never on the table', () => {
    garden(MALA, 0);
    const session = recordCompletedSession({ startedAt: 1, durationMs: 30 * 60_000 });
    const before = getState().sessions[0].plants;

    chooseOffer(session.id, 7);
    chooseOffer('not-a-session', 0);
    expect(getState().sessions[0].plants).toEqual(before);
  });

  it('never grows a bundle past the end of the garden', () => {
    garden(4, 3);
    const session = recordCompletedSession({ startedAt: 1, durationMs: 30 * 60_000 });

    for (const index of [0, 1, 2]) {
      chooseOffer(session.id, index);
      expect(Math.max(...slots())).toBeLessThan(4);
    }
  });
});

describe('growGarden', () => {
  it('starts a fresh user on the starter bed', () => {
    expect(getState().progress.gardenSize).toBe(STARTER_GARDEN);
  });

  it('takes the next rung of the ladder, and takes no size', () => {
    garden(3, 3);
    growGarden();
    expect(getState().progress.gardenSize).toBe(nextGardenSize(3));
  });

  it('does nothing while there is still somewhere to plant', () => {
    // A bed with room in it is a bed nobody has been asked about, so a second
    // tap on the grow screen is inert rather than two rungs.
    garden(12, 3);
    growGarden();
    expect(getState().progress.gardenSize).toBe(12);
  });

  it('is inert on a second press, so one ask grows one rung', () => {
    garden(6, 6);
    growGarden();
    growGarden();
    expect(getState().progress.gardenSize).toBe(12);
  });

  it('leaves every plant in the dot it was already in', () => {
    // The whole reason the ladder is not a menu. A widening is only ever asked
    // for on a full single-row bed, where nothing can re-flow.
    garden(6, 6);
    const before = slots();
    growGarden();
    expect(slots()).toEqual(before);
  });

  it('climbs the ladder a rung at a time, however often it is asked', () => {
    garden(3, 3);
    growGarden();
    expect(getState().progress.gardenSize).toBe(6);

    garden(6, 6);
    growGarden();
    expect(getState().progress.gardenSize).toBe(12);

    garden(12, 12);
    growGarden();
    expect(getState().progress.gardenSize).toBe(24);
  });
});

describe('an abandoned sitting', () => {
  it('leaves the garden untouched', () => {
    // Quitting early simply never reaches recordCompletedSession — the garden
    // has no concept of a partial session, which is what keeps it honest.
    expect(getState().sessions).toHaveLength(0);
    expect(getState().settings.lastDurationMs).toBeNull();
  });
});

describe('setStage', () => {
  it('restarts the stage clock', () => {
    const before = Date.now();
    setStage(2);
    expect(getState().progress.stage).toBe(2);
    expect(getState().progress.stageStartedAt).toBeGreaterThanOrEqual(before);
  });

  it('clears a previous decline, so the new stage is judged fresh', () => {
    noteAdvanceOffered();
    expect(getState().progress.lastOfferedAt).not.toBeNull();
    setStage(2);
    expect(getState().progress.lastOfferedAt).toBeNull();
  });

  it('drops the remembered duration so the new stage’s suggestion is heard', () => {
    updateSettings({ lastDurationMs: 5 * 60_000 });
    setStage(4);
    expect(getState().settings.lastDurationMs).toBeNull();
    // Which means the dial now opens on what stage four proposes.
    expect(stageAt(4).suggestedMs).toBe(15 * 60_000);
  });

  it('keeps tips already seen, so revisiting a stage does not replay them', () => {
    markTipSeen('s1-01');
    setStage(2);
    setStage(1);
    expect(getState().progress.seenTipIds).toContain('s1-01');
  });
});

describe('markTipSeen', () => {
  it('records a tip once', () => {
    markTipSeen('s1-01');
    markTipSeen('s1-01');
    expect(getState().progress.seenTipIds).toEqual(['s1-01']);
  });
});

describe('completeOnboarding', () => {
  it('starts the stage clock at that moment, not at install', () => {
    expect(getState().progress.stageStartedAt).toBe(0);
    completeOnboarding();
    expect(getState().settings.onboardedAt).not.toBeNull();
    expect(getState().progress.stageStartedAt).toBeGreaterThan(0);
  });
});

describe('notes', () => {
  it('keeps what was written, trimmed', () => {
    addNote({ body: '  call the dentist \n' });
    expect(getState().notes.map((n) => n.body)).toEqual(['call the dentist']);
  });

  it('links a note to the sitting by when that sitting began', () => {
    // The sitting has no id yet — it is still running. This is the whole
    // reason the link is a timestamp.
    const startedAt = Date.now();
    addNote({ body: 'the shoulders again', sittingStartedAt: startedAt });

    const session = recordCompletedSession({ startedAt, durationMs: TEN_MIN });
    expect(noteForSession(getState().notes, session)?.body).toBe('the shoulders again');
  });

  it('keeps a note whose sitting was abandoned', () => {
    // Nothing is recorded for a sitting left early, and the thought is still
    // the user's.
    addNote({ body: 'the list can wait', sittingStartedAt: Date.now() });
    expect(getState().sessions).toHaveLength(0);
    expect(getState().notes).toHaveLength(1);
  });

  it('leaves a note written outside a sitting pointing at nothing', () => {
    const note = addNote({ body: 'rain on the window' });
    expect(note.sittingStartedAt).toBeUndefined();
  });

  it('rewrites a note and records that it was touched', () => {
    const note = addNote({ body: 'first' });
    expect(note.editedAt).toBeUndefined();

    updateNote(note.id, 'second');
    const stored = getState().notes[0];
    expect(stored.body).toBe('second');
    expect(stored.editedAt).toEqual(expect.any(Number));
    expect(stored.createdAt).toBe(note.createdAt);
  });

  it('throws a note away when it is cleared', () => {
    // Rubbing a note out is how it is deleted. An empty card is not a thought,
    // and this app asks no confirmation about one.
    const note = addNote({ body: 'never mind' });
    updateNote(note.id, '   ');
    expect(getState().notes).toHaveLength(0);
  });

  it('deletes only the note asked for', () => {
    const first = addNote({ body: 'one' });
    addNote({ body: 'two' });

    deleteNote(first.id);
    expect(getState().notes.map((n) => n.body)).toEqual(['two']);
  });

  it('ignores an id it does not know rather than throwing', () => {
    addNote({ body: 'one' });
    updateNote('nobody', 'two');
    deleteNote('nobody');
    expect(getState().notes.map((n) => n.body)).toEqual(['one']);
  });

  it('keeps them in the order they were written', () => {
    addNote({ body: 'one' });
    addNote({ body: 'two' });
    expect(getState().notes.map((n) => n.body)).toEqual(['one', 'two']);
  });
});

describe('updateSettings', () => {
  it('starts the developer switch off', () => {
    // It gates a panel that now ships in release builds, so the default is the
    // whole of what keeps it off a phone nobody asked to see it on.
    expect(getState().settings.devMode).toBe(false);
  });

  it('turns the developer switch on and off again', () => {
    updateSettings({ devMode: true });
    expect(getState().settings.devMode).toBe(true);

    updateSettings({ devMode: false });
    expect(getState().settings.devMode).toBe(false);
  });
});

describe('resetProgress', () => {
  /** Somebody who has been using the app for a while, with something to lose. */
  function established() {
    completeOnboarding();
    updateSettings({
      theme: 'ink',
      reminderAt: '07:30',
      hideSeconds: false,
      devMode: true,
    });
    setStage(3);
    markTipSeen('s3-01');
    recordCompletedSession({ startedAt: Date.now(), durationMs: TEN_MIN });
    addNote({ body: 'the shoulders again' });
  }

  it('lets go of everything that grew', () => {
    established();
    resetProgress();

    expect(getState().sessions).toEqual([]);
    expect(getState().notes).toEqual([]);
    expect(getState().progress.gardenSize).toBe(STARTER_GARDEN);
  });

  it('goes back to stage one, with nothing taught yet', () => {
    established();
    resetProgress();

    expect(getState().progress.stage).toBe(1);
    expect(getState().progress.seenTipIds).toEqual([]);
    expect(getState().progress.lastOfferedAt).toBeNull();
  });

  it('resets the settings the user chose', () => {
    established();
    resetProgress();

    expect(getState().settings.theme).toBe('ink');
    expect(getState().settings.reminderAt).toBeNull();
    expect(getState().settings.hideSeconds).toBe(true);
    expect(getState().settings.devMode).toBe(false);
  });

  it('unsets onboarding, so the welcome screen comes back', () => {
    established();
    resetProgress();

    expect(getState().settings.onboardedAt).toBeNull();
  });

  it('unsets the stage clock until onboarding finishes again', () => {
    established();
    resetProgress();

    expect(getState().progress.stageStartedAt).toBe(0);
  });

  it('lets stage one propose a length again', () => {
    established();
    expect(getState().settings.lastDurationMs).toBeNull();

    resetProgress();
    expect(getState().settings.lastDurationMs).toBeNull();
  });

  it('is the same twice, so a second hold changes nothing', () => {
    established();
    resetProgress();
    const once = getState().progress;

    resetProgress();
    expect(getState().sessions).toEqual([]);
    expect(getState().progress.stage).toBe(once.stage);
    expect(getState().progress.gardenSize).toBe(once.gardenSize);
  });
});

describe('__reset', () => {
  it('returns a fresh install', () => {
    recordCompletedSession({ startedAt: Date.now(), durationMs: TEN_MIN });
    addNote({ body: 'something' });
    setStage(5);
    __reset();
    expect(getState().sessions).toHaveLength(0);
    expect(getState().notes).toHaveLength(0);
    expect(getState().progress.stage).toBe(1);
    expect(getState().progress.gardenSize).toBe(STARTER_GARDEN);
    expect(getState().settings.onboardedAt).toBeNull();
    // A fresh install has never been asked for the developer panel, so pressing
    // this on a release build puts it away as well.
    expect(getState().settings.devMode).toBe(false);
  });
});

describe('__replaceState', () => {
  it('can seed a garden without going through the session flow', () => {
    __replaceState({ sessions: [seeded('seed', 0)] });
    expect(getState().sessions).toHaveLength(1);
  });
});
