import { TextStyle } from 'react-native';

/**
 * Two faces, with a hard boundary between them.
 *
 * M PLUS Rounded 1c carries everything a user reads: timer, nav, labels, stats,
 * buttons, and the teaching card. Its soft terminals keep even the clinical
 * copy from sounding severe, which is the whole reason it is here.
 *
 * Shantell Sans is a voice, not a reading face. It is for short felt lines —
 * the app name, a caption under the cat, an onboarding tagline — one line at a
 * time. A paragraph set in it stops being warm and starts being hard to read.
 */
export const font = {
  sans: 'MPLUSRounded1c_400Regular',
  sansMed: 'MPLUSRounded1c_500Medium',
  sansBold: 'MPLUSRounded1c_700Bold',
  hand: 'ShantellSans_400Regular',
} as const;

/**
 * The full type scale. Screens compose from these rather than declaring
 * fontSize/fontFamily inline, so the voice of the app stays in one file.
 */
export const type = {
  /** App name on the welcome screen — a scrawled logo, not a heading. */
  display: {
    fontFamily: font.hand,
    fontSize: 32,
  },

  /** Screen headers — "Your garden", "Session". */
  title: {
    fontFamily: font.sansBold,
    fontSize: 18,
    lineHeight: 23,
  },

  /** The countdown. The largest thing in the app, and deliberately plain. */
  timer: {
    fontFamily: font.sans,
    fontSize: 56,
    letterSpacing: 0,
  },

  /** Big numbers on stat cards. */
  stat: {
    fontFamily: font.sansBold,
    fontSize: 26,
    lineHeight: 33,
  },

  /** Small uppercase labels — "CURRENT STREAK", "STAGE ONE". */
  label: {
    fontFamily: font.sansMed,
    fontSize: 13,
    lineHeight: 17,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  body: {
    fontFamily: font.sansMed,
    fontSize: 15,
    lineHeight: 23,
  },

  caption: {
    fontFamily: font.sansMed,
    fontSize: 13,
    lineHeight: 18,
  },

  button: {
    fontFamily: font.sansBold,
    fontSize: 15,
    letterSpacing: 0.2,
  },

  /** Teaching card body — the long-form 400 weight, set airier than body. */
  teaching: {
    fontFamily: font.sans,
    fontSize: 18,
    lineHeight: 28,
  },

  /** A single felt line — a caption beside Батон, the onboarding tagline. */
  hand: {
    fontFamily: font.hand,
    fontSize: 18,
    lineHeight: 25,
  },
} satisfies Record<string, TextStyle>;

/**
 * Which token each variant is set in.
 *
 * Colour lives beside the scale rather than inside it: a variant is frozen at
 * import and the palette is not, so `Text` looks the value up per render. The
 * pairing is still a typographic decision — "a caption is quieter than body" —
 * and belongs in this file rather than scattered across screens.
 */
export const variantColor = {
  display: 'ink',
  title: 'ink',
  timer: 'ink',
  stat: 'ink',
  label: 'inkSoft',
  body: 'ink',
  caption: 'inkSoft',
  button: 'ink',
  teaching: 'ink',
  hand: 'ink',
} as const satisfies Record<keyof typeof type, string>;
