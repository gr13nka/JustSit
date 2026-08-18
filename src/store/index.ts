import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { plantFor } from '../domain/plants';
import {
  currentPlot,
  isSlotFree,
  nextFreeSlot,
  plotIndexOfSlot,
} from '../domain/plots';
import { DEFAULT_THEME } from '../theme/themes';
import {
  mergePersisted,
  migrate,
  PersistedState,
  storage,
  STORAGE_KEY,
  STORAGE_VERSION,
} from './persistence';
import { Progress, Session, Settings } from './types';

export type { Progress, Session, Settings } from './types';

const initialProgress: Progress = {
  stage: 1,
  stageStartedAt: 0,
  lastOfferedAt: null,
  seenTipIds: [],
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
};

type StoreState = {
  sessions: Session[];
  progress: Progress;
  settings: Settings;
  /** False until AsyncStorage has been read. Screens must wait on this. */
  hydrated: boolean;
};


const useStore = create<StoreState>()(
  persist(
    (): StoreState => ({
      sessions: [],
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
export const useProgress = () => useStore((s) => s.progress);
export const useSettings = () => useStore((s) => s.settings);

/** Non-reactive read, for logic that runs outside render. */
export const getState = (): StoreState => useStore.getState();

// ---------------------------------------------------------------------------
// Writes. Plain functions, callable from anywhere including event handlers.
// ---------------------------------------------------------------------------

function newSessionId(startedAt: number): string {
  return `${startedAt.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * The chosen dot, if it is still a dot the user could legitimately have tapped.
 *
 * It arrives as a route param that has survived a whole sitting, so it may name
 * a slot in an archived plot, or one that filled in the meantime. A plant must
 * never land on top of another, and never in a finished plot — falling back to
 * the first free dot is always better than refusing to record the sitting.
 */
function resolveSlot(sessions: readonly Session[], chosen: number | undefined): number {
  if (chosen === undefined || !Number.isInteger(chosen) || chosen < 0) {
    return nextFreeSlot(sessions);
  }

  const usable =
    plotIndexOfSlot(chosen) === currentPlot(sessions).index &&
    isSlotFree(sessions, chosen);

  return usable ? chosen : nextFreeSlot(sessions);
}

/**
 * The only way a plant ever appears. Called once, when a sitting has run its
 * full length — abandoned sessions are simply never passed here.
 */
export function recordCompletedSession(args: {
  startedAt: number;
  durationMs: number;
  /** The dot the user tapped. Omitted or unusable means the first free one. */
  slot?: number;
}): Session {
  const { startedAt, durationMs } = args;
  const { sessions, progress } = useStore.getState();
  const id = newSessionId(startedAt);
  const session: Session = {
    id,
    startedAt,
    durationMs,
    completedAt: Date.now(),
    stage: progress.stage,
    plant: plantFor(id),
    slot: resolveSlot(sessions, args.slot),
  };

  useStore.setState((s) => ({
    sessions: [...s.sessions, session],
    settings: { ...s.settings, lastDurationMs: durationMs },
  }));

  return session;
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

/** Test and dev-panel seam. Never called from screen code. */
export function __replaceState(patch: Partial<PersistedState>): void {
  useStore.setState(patch);
}

/** Wipes the garden back to a fresh install. Dev panel only. */
export function __reset(): void {
  useStore.setState({
    sessions: [],
    progress: initialProgress,
    settings: initialSettings,
  });
}
