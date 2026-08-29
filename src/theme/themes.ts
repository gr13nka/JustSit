/** The one palette the app wears, and the only place a hex literal lives. */

export type ThemeId = 'ink';

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
  /** A warm sitting wash. Atmospheric only, never a signal or action colour. */
  amberVeil: string;

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
      amberVeil: '#8A5A24',
      ...CREAM_PENS,
      danger: '#B3402F',
    },
  },
};

/** What a garden grown before there were themes comes back wearing. */
export const DEFAULT_THEME: ThemeId = 'ink';

export const THEME_ORDER: ThemeId[] = ['ink'];

/** True if a stored id is still one we have a palette for. */
export function isKnownTheme(id: string): id is ThemeId {
  return id in THEMES;
}
