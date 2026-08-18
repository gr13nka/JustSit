import { ThemeId } from '../theme/themes';

/** A sitting that ran to completion. Abandoned sessions are never recorded. */
export type Session = {
  id: string;
  startedAt: number;
  /** What the user chose, not what elapsed — a completed session ran the full length. */
  durationMs: number;
  completedAt: number;
  /** The stage the user was on at the time. Historical; never back-filled. */
  stage: number;
  /**
   * The plant's key, resolved once at completion and then permanent.
   * Stored rather than derived so adding new art later cannot change a plant
   * that has already grown.
   */
  plant: string;
  /**
   * Which dot this plant grew in, counted across the whole garden:
   * plot = Math.floor(slot / PLOT_SIZE), cell within it = slot % PLOT_SIZE.
   *
   * Stored for the same reason `plant` is, and a stronger one: the user chose
   * this dot by touching it. Position was array order once; deriving it again
   * would quietly rearrange a garden someone has been keeping.
   */
  slot: number;
};

export type Progress = {
  /** 1..10, per Wallace's ten stages of shamatha. */
  stage: number;
  /** When the current stage began. 0 until onboarding completes. */
  stageStartedAt: number;
  /** When we last offered to advance. Null if never — used to avoid nagging. */
  lastOfferedAt: number | null;
  /** Tip ids already shown, so teaching moves in order rather than repeating. */
  seenTipIds: string[];
};

export type Settings = {
  /** Null until the welcome flow is finished. Gates the onboarding redirect. */
  onboardedAt: number | null;
  /** Local time as "HH:MM", or null for no reminder. Off by default. */
  reminderAt: string | null;
  /**
   * The last duration the user explicitly chose, so the dial reopens where they
   * left it. Null means "no choice yet at this stage" — the dial then follows
   * the stage's suggestion. Cleared on advancing, so a new stage's proposal is
   * actually heard rather than buried under an old habit.
   */
  lastDurationMs: number | null;
  /**
   * Show whole minutes instead of m:ss. On by default: a clock that moves every
   * second is a second way to watch the clock, and watching the clock is the
   * one thing a sitting is not for.
   */
  hideSeconds: boolean;
  /**
   * Which palette the app is wearing. The one piece of pure taste in here —
   * it changes nothing about how the app behaves, only what it is drawn in.
   */
  theme: ThemeId;
};
