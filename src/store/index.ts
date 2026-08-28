import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { Offer, offersForSession } from '../domain/plants';
import { freeSlots, nextFreeSlot, nextGardenSize, STARTER_GARDEN } from '../domain/plots';
import { DEFAULT_THEME } from '../theme/themes';
import {
  mergePersisted,
  migrate,
  PersistedState,
  storage,
  STORAGE_KEY,
  STORAGE_VERSION,
} from './persistence';
import { Note, Planted, Progress, Session, Settings } from './types';

export type { Note, Planted, Progress, Session, Settings } from './types';

const initialProgress: Progress = {
  stage: 1,
  stageStartedAt: 0,
  lastOfferedAt: null,
  seenTipIds: [],
  // A new field needs a default, not a migration — and a garden is the one
  // thing here that must never come back as nothing.
  gardenSize: STARTER_GARDEN,
};

const initialSettings: Settings = {
  onboardedAt: null,
  reminderAt: null,
  lastDurationMs: null,
  hideSeconds: true,
  // A new field needs a default, not a migration: `mergePersisted` merges
  // settings over these on every launch, so an existing garden comes back
  // wearing the theme it was drawn in.
  theme: DEFAULT_THEME,
  devMode: false,
};

type StoreState = {
  sessions: Session[];
  /**
   * Everything caught, oldest first — a collection of its own rather than a
   * field on a sitting. A note may outlive the sitting it was written in (an
   * abandoned one records no session at all), and a sitting may be read back
   * from the garden without ever asking whether it has one.
   */
  notes: Note[];
  progress: Progress;
  settings: Settings;
  /** False until AsyncStorage has been read. Screens must wait on this. */
  hydrated: boolean;
};


const useStore = create<StoreState>()(
  persist(
    (): StoreState => ({
      sessions: [],
      notes: [],
      progress: initialProgress,
      settings: initialSettings,
      hydrated: false,
    }),
    {
      name: STORAGE_KEY,
      storage,
      version: STORAGE_VERSION,
      migrate,
      // `hydrated` is a runtime fact about this launch, never a stored one.
      partialize: (state): PersistedState => ({
        sessions: state.sessions,
        notes: state.notes,
        progress: state.progress,
        settings: state.settings,
      }),
      merge: mergePersisted,
      // Runs on success *and* on read failure. A corrupt blob should leave the
      // user with an empty garden they can keep using, not a permanent splash.
      onRehydrateStorage: () => () => useStore.setState({ hydrated: true }),
    }
  )
);

// ---------------------------------------------------------------------------
// Reads. Components subscribe through these; nothing else imports `useStore`.
// ---------------------------------------------------------------------------

export const useHydrated = () => useStore((s) => s.hydrated);
export const useSessions = () => useStore((s) => s.sessions);
export const useNotes = () => useStore((s) => s.notes);
export const useProgress = () => useStore((s) => s.progress);
export const useSettings = () => useStore((s) => s.settings);

/** Non-reactive read, for logic that runs outside render. */
export const getState = (): StoreState => useStore.getState();

// ---------------------------------------------------------------------------
// Writes. Plain functions, callable from anywhere including event handlers.
// ---------------------------------------------------------------------------

/**
 * An id for something that happened at `at`: when, and enough noise to keep two
 * of them apart. Sessions and notes are both minted here — nothing in this app
 * has an id that means anything, so there is no reason for them to differ.
 */
function newId(at: number): string {
  return `${at.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Turns an offer into plants in the ground.
 *
 * Planting is linear: the first plant takes the first free dot in the garden
 * being filled and a bundle takes the ones after it. Nothing chooses — where a
 * sitting lands is a fact about the garden at the moment the sitting ends,
 * which is why this is asked here and never passed in.
 */
function materialise(
  offer: Offer,
  sessions: readonly Session[],
  gardenSize: number
): Planted[] {
  const slots = freeSlots(sessions, gardenSize, offer.plants.length);

  // A bundle is capped against the garden's room before it is ever offered, so
  // this only ever trims when something upstream has gone wrong.
  return slots.map((slot, i) => ({ key: offer.plants[i], slot }));
}

/**
 * The only way a plant ever appears. Called once, when a sitting has run its
 * full length — abandoned sessions are simply never passed here.
 *
 * The first offer is written immediately rather than waiting for the user to
 * choose one, so a session never exists without plants: kill the app on the
 * completion screen and the sitting is still in the ground, at the modest cost
 * of it being the offer nobody picked. `chooseOffer` replaces them if the user
 * does choose, which is the only moment `plants` is ever rewritten.
 *
 * Where the plants land is not among the arguments, and that is the design
 * rather than an omission: the garden fills in order, so the dot is read off
 * the garden here, at the one moment it is certainly still true.
 */
export function recordCompletedSession(args: {
  startedAt: number;
  durationMs: number;
}): Session {
  const { startedAt, durationMs } = args;
  const { sessions, progress } = useStore.getState();

  /*
   * A finished sitting must leave something in the ground, and a full bed has
   * nowhere to put it. Growing the bed is the user's to confirm, on the grow
   * screen; this is the floor under that — it takes the next rung rather than
   * losing the sitting. Nothing in the app can reach it, since a full bed has
   * no dot left to start a sitting from.
   */
  const gardenSize =
    nextFreeSlot(sessions, progress.gardenSize) === null
      ? nextGardenSize(progress.gardenSize)
      : progress.gardenSize;

  const id = newId(startedAt);
  const draft: Session = {
    id,
    startedAt,
    durationMs,
    completedAt: Date.now(),
    stage: progress.stage,
    plants: [],
  };

  const offers = offersForSession(sessions, draft, gardenSize);
  const session: Session = {
    ...draft,
    plants: materialise(offers[0], sessions, gardenSize),
  };

  useStore.setState((s) => ({
    sessions: [...s.sessions, session],
    progress: { ...s.progress, gardenSize },
    settings: { ...s.settings, lastDurationMs: durationMs },
  }));

  return session;
}

/**
 * Swaps a just-finished sitting's plants for the offer the user picked.
 *
 * Only the newest sitting may be changed, and that is the real guard rather
 * than a convenience: its plants are the tail of the used slots, so replacing
 * them cannot land on a dot something else has grown in. Reaching back further
 * would mean re-laying the garden behind it.
 *
 * A refusal is silent. This runs from a screen the user reached by finishing a
 * sitting, and throwing there would take the app down at the one moment it has
 * something to show for the last twenty minutes.
 */
export function chooseOffer(sessionId: string, offerIndex: number): void {
  const { sessions, progress } = useStore.getState();

  const at = sessions.length - 1;
  const session = sessions[at];
  if (!session || session.id !== sessionId) return;

  const offer = offersForSession(sessions, session, progress.gardenSize)[offerIndex];
  if (!offer) return;

  // Laid out against the garden without this sitting in it, so the swap lands
  // exactly where the sitting already is: it is the newest, and a garden fills
  // in order, so the first free dot behind it is the dot it took.
  const earlier = sessions.slice(0, at);
  const plants = materialise(offer, earlier, progress.gardenSize);
  if (plants.length === 0) return;

  useStore.setState({ sessions: [...earlier, { ...session, plants }] });
}

/**
 * Grows the bed by one rung of the ladder.
 *
 * Only when there is nowhere left to plant, and that guard is what makes the
 * grow screen's button safe to press twice: a bed with room in it is a bed
 * nobody has been asked about, so a second tap is inert rather than two rungs.
 * It is also the only thing standing between the ladder and a bed that widened
 * with plants in it — every rung below twelve is a widening, and widening is
 * only harmless on a bed whose plants are all in its one row.
 *
 * The bed never shrinks and there is no size to pass: the ladder decides, so
 * that the only sizes a garden can ever be are ones `shapeFor` can lay out
 * without moving anything already in the ground.
 */
export function growGarden(): void {
  const { sessions, progress } = useStore.getState();
  if (nextFreeSlot(sessions, progress.gardenSize) !== null) return;

  useStore.setState((s) => ({
    progress: { ...s.progress, gardenSize: nextGardenSize(s.progress.gardenSize) },
  }));
}

// ---------------------------------------------------------------------------
// Notes. A collection beside the garden rather than inside it: what a sitting
// leaves in the ground is a plant, and what it leaves in a notebook is this.
// ---------------------------------------------------------------------------

/**
 * Puts a thought down.
 *
 * `sittingStartedAt` is the instant the sitting began, and it is all there is
 * to point at: the note is written in the middle of one, and a session with an
 * id does not exist until it finishes. Left out for a note written anywhere
 * else.
 *
 * The body is trimmed here rather than at the keyboard, so every caller stores
 * the same thing and nothing downstream has to wonder.
 */
export function addNote(args: { body: string; sittingStartedAt?: number }): Note {
  const note: Note = {
    id: newId(Date.now()),
    body: args.body.trim(),
    createdAt: Date.now(),
    ...(args.sittingStartedAt === undefined
      ? {}
      : { sittingStartedAt: args.sittingStartedAt }),
  };

  useStore.setState((s) => ({ notes: [...s.notes, note] }));
  return note;
}

/**
 * Rewrites a note, and deletes it if what is left is nothing.
 *
 * Clearing the text *is* how a note is thrown away, and it is the same gesture
 * on any paper: an empty card is not a thought, and this app shows no
 * confirmation dialogs to ask about one. The explicit "delete" on the edit
 * screen is the same outcome reached deliberately rather than by rubbing out.
 */
export function updateNote(id: string, body: string): void {
  const trimmed = body.trim();
  if (trimmed === '') return deleteNote(id);

  useStore.setState((s) => ({
    notes: s.notes.map((note) =>
      note.id === id ? { ...note, body: trimmed, editedAt: Date.now() } : note
    ),
  }));
}

export function deleteNote(id: string): void {
  useStore.setState((s) => ({ notes: s.notes.filter((note) => note.id !== id) }));
}

/**
 * Moves the user to a stage. Resets the stage clock and clears the offer
 * record, so the next advancement is judged from here rather than from before.
 */
export function setStage(stage: number): void {
  useStore.setState((s) => ({
    progress: {
      ...s.progress,
      stage,
      stageStartedAt: Date.now(),
      lastOfferedAt: null,
    },
    // Clearing the remembered duration lets the new stage's suggestion surface.
    settings: { ...s.settings, lastDurationMs: null },
  }));
}

/** Records that we asked and the user said "not yet", so we stop asking a while. */
export function noteAdvanceOffered(): void {
  useStore.setState((s) => ({
    progress: { ...s.progress, lastOfferedAt: Date.now() },
  }));
}

/** Marks a tip as delivered so teaching moves forward rather than repeating. */
export function markTipSeen(tipId: string): void {
  useStore.setState((s) =>
    s.progress.seenTipIds.includes(tipId)
      ? s
      : { progress: { ...s.progress, seenTipIds: [...s.progress.seenTipIds, tipId] } }
  );
}

export function updateSettings(patch: Partial<Settings>): void {
  useStore.setState((s) => ({ settings: { ...s.settings, ...patch } }));
}

/** Finishes the welcome flow. Stage one begins now, not at install time. */
export function completeOnboarding(): void {
  const now = Date.now();
  useStore.setState((s) => ({
    settings: { ...s.settings, onboardedAt: now },
    progress: { ...s.progress, stageStartedAt: now },
  }));
}

/**
 * Lets go of everything that grew, and keeps the user.
 *
 * Sittings, the garden and notes go; the settings that say how the app should
 * behave stay exactly as they are. That split is the whole difference between
 * this and `__reset`, which is a fresh install and takes onboarding with it —
 * somebody asking for this has been using the app and is not asking to be shown
 * the welcome screen again.
 *
 * Two fields therefore cannot simply take their initial value. `stageStartedAt`
 * is a sentinel: 0 means onboarding never finished, and `shouldOfferAdvance`
 * reads it that way, so the stage clock restarts *now* rather than unsetting —
 * which is also what the reset is asking for, since stage one begins again
 * here. And `lastDurationMs` is cleared on `setStage`'s precedent, so stage
 * one's suggested length is heard again instead of the length of a practice
 * that no longer exists.
 *
 * There is no undo and no dialog asking about it. What guards it is the wait
 * in front of it — see `ui/TimedConfirm.tsx`.
 */
export function resetProgress(): void {
  useStore.setState((s) => ({
    sessions: [],
    notes: [],
    progress: { ...initialProgress, stageStartedAt: Date.now() },
    settings: { ...s.settings, lastDurationMs: null },
  }));
}

/** Test and dev-panel seam. Never called from screen code. */
export function __replaceState(patch: Partial<PersistedState>): void {
  useStore.setState(patch);
}

/** Wipes the garden back to a fresh install. Dev panel only. */
export function __reset(): void {
  useStore.setState({
    sessions: [],
    notes: [],
    progress: initialProgress,
    settings: initialSettings,
  });
}
