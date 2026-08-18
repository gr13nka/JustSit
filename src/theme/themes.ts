/**
 * The three palettes the app can wear, and the only place a hex literal lives.
 *
 * Karakuli allows an app exactly one accent, on the grounds that a system stays
 * coherent by keeping what an app may vary very small. This app spends that
 * licence three times instead of once, deliberately: the ground a plant is drawn
 * on changes how the drawing reads, and the answer was not obvious enough to
 * settle from a swatch. What is *not* negotiable is the structure — paper, ink,
 * one accent, colour earned by the garden alone. A theme moves values inside
 * that structure; it never adds a colour that means something new.
 */

export type ThemeId = 'ink' | 'butter' | 'prose';

/**
 * Every colour the interface can name. Screens never see this type — they ask
 * `useColor()` for the live one — but `ColorName` is what lets a component
 * accept "a token" rather than "a string that had better be a hex".
 */
export type Palette = {
  paper: string;
  paperDeep: string;
  ink: string;
  inkSoft: string;
  /** Empty dots, elapsed arc, dividers, placeholders. Never text a user must read. */
  inkFaint: string;
  /**
   * The app's one signature colour: the primary fill, the wobbly button's
   * border, the ring, and whichever marker is travelling. Ink in the quiet
   * theme, brick in the two loud ones.
   */
  accent: string;

  /** Growth. Plant strokes and large "something grew" marks. Never small text. */
  penGreen: string;
  /** The brights a bloom may take, and the onboarding hero's night sky. */
  penBlue: string;
  penOrange: string;
  penPink: string;

  /** Destructive actions only. Never the accent, or a warning stops being one. */
  danger: string;
};

export type ColorName = keyof Palette;

export type Theme = {
  id: ThemeId;
  /** Shown in the settings picker. Two words at most. */
  name: string;
  color: Palette;
};

/**
 * The canon garden pens, mixed for cream paper.
 *
 * A theme may deepen them but never abandon them: green still has to mean
 * growth, and a bloom still has to be the exception drawn on top of it.
 */
const CREAM_PENS = {
  penGreen: '#2E7D46',
  penBlue: '#2F3AC7',
  penOrange: '#E07A1F',
  penPink: '#D9569B',
} as const;

export const THEMES: Record<ThemeId, Theme> = {
  /** The app as it was first drawn: warm cream, accent = ink, colour earned. */
  ink: {
    id: 'ink',
    name: 'Ink',
    color: {
      paper: '#F7F3E9',
      paperDeep: '#EFE9DA',
      ink: '#26241F',
      inkSoft: '#6B665C',
      inkFaint: '#A9A294',
      accent: '#26241F',
      ...CREAM_PENS,
      danger: '#B3402F',
    },
  },

  /**
   * Butter ground, brick accent.
   *
   * The pens are re-mixed rather than reused: butter is a light warm ground and
   * the cream pens were not mixed for it — green turns olive on it and orange
   * all but disappears. Each drops a step in luminance and gains a little
   * saturation. Blue was already dark enough against butter and is untouched.
   */
  butter: {
    id: 'butter',
    name: 'Butter',
    color: {
      paper: '#F6ECC9',
      paperDeep: '#EFE0AF',
      ink: '#2A1A14',
      inkSoft: '#6E5A46',
      inkFaint: '#B4A47E',
      accent: '#B3402F',
      penGreen: '#1F6136',
      penBlue: '#2F3AC7',
      penOrange: '#A85A0E',
      penPink: '#B83B7D',
      // Brick is spent on the accent here, so danger drops to an oxblood that
      // is still unmistakably a warning and no longer the colour of a button.
      danger: '#8C2A1C',
    },
  },

  /**
   * A warm near-white editorial ground with brick as the accent — the paper and
   * the muted red of the Karakuli Prose sketch, and only those. That register's
   * serif body, justified setting and drop cap are a separate, still-deferred
   * decision, and nothing here should be read as having made it.
   *
   * Near-white, never #FFF: the system has no pure white anywhere.
   */
  prose: {
    id: 'prose',
    name: 'Prose',
    color: {
      paper: '#FBF9F4',
      paperDeep: '#F1EDE2',
      ink: '#231F1B',
      inkSoft: '#6A645B',
      inkFaint: '#B3ADA1',
      accent: '#B3402F',
      ...CREAM_PENS,
      danger: '#8C2A1C',
    },
  },
};

/** What a garden grown before there were themes comes back wearing. */
export const DEFAULT_THEME: ThemeId = 'ink';

export const THEME_ORDER: ThemeId[] = ['ink', 'butter', 'prose'];

/** True if a stored id is still one we have a palette for. */
export function isKnownTheme(id: string): id is ThemeId {
  return id in THEMES;
}
