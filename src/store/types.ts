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
   * What this sitting grew: one plant, or the two or three of a bundle.
   *
   * Written once, when the offer is chosen, and never changed after — which is
   * what makes adding new art later safe, and what makes a garden someone has
   * been keeping draw the way they left it. Both halves are stored for that
   * reason: the species, because the same seed would hash differently once the
   * registry grows; and the dot, because position was array order once and
   * deriving it again would quietly rearrange a garden that has holes in it.
   *
   * Never empty. A completed sitting always leaves something in the ground, and
   * `recordCompletedSession` writes the first offer immediately so that stays
   * true even if the app dies before the user has picked.
   */
  plants: Planted[];
};

/** One plant, and the dot it stands in — counted across every garden. */
export type Planted = {
  key: string;
  slot: number;
};

/**
 * One thought, caught and put down.
 *
 * A note is not part of a sitting's record — a sitting's record is the plant.
 * It is the thing that turned up *during* one and would otherwise have been
 * carried for the next twenty minutes, so putting it somewhere is what lets it
 * be let go of. Nothing counts them and nothing is asked of them.
 *
 * One sitting leaves one note. A second thought caught in the same sitting is
 * added to it as a further line rather than minting another — see
 * `appendThought` in `domain/notes.ts` — which is what makes the join below a
 * lookup that answers with a note rather than with a list.
 */
export type Note = {
  id: string;
  /** What was written. Trimmed; a note is never blank — see `updateNote`. */
  body: string;
  createdAt: number;
  /** When it was last changed. Absent on a note nobody has been back to. */
  editedAt?: number;
  /**
   * The sitting it was caught during, named by when that sitting *began*.
   *
   * Not a session id, and that is forced rather than chosen: a session does not
   * exist yet at the moment a note is written. Ids are minted at completion, so
   * the only thing about the sitting that is already true — and already
   * permanent — is the wall-clock instant it started from. The link resolves
   * afterwards, against the session whose `startedAt` matches.
   *
   * It may never resolve. A sitting left early records nothing, so its note
   * stays here with nowhere to point, which is correct: the thought was still
   * the user's. Only the plant was ever conditional on finishing.
   *
   * Absent on a note written outside a sitting.
   */
  sittingStartedAt?: number;
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
  /**
   * The size of every garden the user has grown, in order.
   *
   * The last entry is the garden being filled and the only one that may still
   * change; everything before it is closed forever. Sizes are counts of dots,
   * never spans of time — a garden is finished when it is full.
   *
   * `[STARTER_GARDEN]` for a fresh user. Never empty.
   */
  gardens: number[];
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
  /**
   * Whether the developer shortcuts are on. Off by default, and off on a phone
   * nobody has deliberately turned it on with.
   *
   * It is a stored setting rather than a build flag because the states worth
   * looking at are the ones only a *release* build can reach — both
   * notification paths, and the hidden status bar — and `__DEV__` is false
   * there by construction. Anything gated on this ships; see `ui/DevPanel.tsx`,
   * which is the whole of what it unlocks, and `session/devClock.ts`, which is
   * the one thing it changes about how a sitting runs.
   */
  devMode: boolean;
};
